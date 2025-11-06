import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenant_id');
  const monthParam = searchParams.get('month');
  const yearParam = searchParams.get('year');

  try {
    // Buscar role e relação com tenants
    const { data: userData } = await supabase
      .from('users')
      .select('role, admin_tenants(tenant_id)')
      .eq('auth_user_id', user.id)
      .single();

    const isSuperAdmin = userData?.role === 'superadmin';
    const adminTenantIds = userData?.admin_tenants?.map((at: any) => at.tenant_id) || [];

    // Definir intervalo de datas por mês/ano
    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam) : (now.getMonth() + 1);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1); // exclusivo

    // Total submissions
    let submissionsCountQuery = supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString());

    // Filtrar por tenant se informado; caso contrário, RLS e papel definem visibilidade
    if (tenantId) {
      submissionsCountQuery = submissionsCountQuery.eq('tenant_id', tenantId);
    } else if (!isSuperAdmin && adminTenantIds.length > 0) {
      submissionsCountQuery = submissionsCountQuery.in('tenant_id', adminTenantIds);
    }

    const { count: totalSubmissions } = await submissionsCountQuery;

    // Total revenue (approved payments)
    let paymentsQuery = supabase
      .from('submissions')
      .select('payment_amount, payment_status, created_at, tenant_id')
      .eq('payment_status', 'PAGO')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString());

    if (tenantId) {
      paymentsQuery = paymentsQuery.eq('tenant_id', tenantId);
    } else if (!isSuperAdmin && adminTenantIds.length > 0) {
      paymentsQuery = paymentsQuery.in('tenant_id', adminTenantIds);
    }

    const { data: paymentsData } = await paymentsQuery;
    const totalRevenue = paymentsData?.reduce((sum, p) => sum + (Number(p.payment_amount) || 0), 0) || 0;

    // Active forms
    let activeFormsQuery = supabase
      .from('form_definitions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    if (tenantId) {
      activeFormsQuery = activeFormsQuery.eq('tenant_id', tenantId);
    } else if (!isSuperAdmin && adminTenantIds.length > 0) {
      activeFormsQuery = activeFormsQuery.in('tenant_id', adminTenantIds);
    }
    const { count: activeForms } = await activeFormsQuery;

    // Submissions by day
    let submissionsByDayQuery = supabase
      .from('submissions')
      .select('created_at, tenant_id')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())
      .order('created_at');
    if (tenantId) {
      submissionsByDayQuery = submissionsByDayQuery.eq('tenant_id', tenantId);
    } else if (!isSuperAdmin && adminTenantIds.length > 0) {
      submissionsByDayQuery = submissionsByDayQuery.in('tenant_id', adminTenantIds);
    }
    const { data: submissionsByDay } = await submissionsByDayQuery;

    // Process submissions by day
    const dayMap = new Map<string, number>();
    submissionsByDay?.forEach(s => {
      const date = new Date(s.created_at).toISOString().split('T')[0];
      dayMap.set(date, (dayMap.get(date) || 0) + 1);
    });

    const submissionsByDayArray = Array.from(dayMap.entries()).map(([date, count]) => ({
      date,
      count,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Revenue by day
    let revenueByDayQuery = supabase
      .from('submissions')
      .select('created_at, payment_amount, payment_status, tenant_id')
      .eq('payment_status', 'PAGO')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())
      .order('created_at');
    if (tenantId) {
      revenueByDayQuery = revenueByDayQuery.eq('tenant_id', tenantId);
    } else if (!isSuperAdmin && adminTenantIds.length > 0) {
      revenueByDayQuery = revenueByDayQuery.in('tenant_id', adminTenantIds);
    }
    const { data: revenueByDayData } = await revenueByDayQuery;

    const revenueDayMap = new Map<string, number>();
    revenueByDayData?.forEach(s => {
      const date = new Date(s.created_at).toISOString().split('T')[0];
      revenueDayMap.set(date, (revenueDayMap.get(date) || 0) + (s.payment_amount || 0));
    });

    const revenueByDayArray = Array.from(revenueDayMap.entries()).map(([date, amount]) => ({
      date,
      amount,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Form performance
    let formPerfQuery = supabase
      .from('form_definitions')
      .select(`
        id,
        name,
        submissions!inner (
          id,
          payment_status,
          created_at,
          tenant_id
        )
      `)
      .eq('is_active', true)
      .gte('submissions.created_at', startDate.toISOString())
      .lt('submissions.created_at', endDate.toISOString());
    if (tenantId) {
      formPerfQuery = formPerfQuery.eq('tenant_id', tenantId);
    } else if (!isSuperAdmin && adminTenantIds.length > 0) {
      formPerfQuery = formPerfQuery.in('tenant_id', adminTenantIds);
    }
    const { data: formData } = await formPerfQuery;

    const formPerformance = formData?.map((form: any) => {
      const submissions = form.submissions || [];
      const approved = submissions.filter((s: any) => s.payment_status === 'PAGO').length;
      return {
        formId: form.id,
        formTitle: form.name,
        submissions: submissions.length,
        conversions: approved,
        conversionRate: submissions.length > 0 ? (approved / submissions.length) * 100 : 0,
      };
    }) || [];

    // Payment stats
    let paymentStatsQuery = supabase
      .from('submissions')
      .select('payment_status, created_at, tenant_id')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString());
    if (tenantId) {
      paymentStatsQuery = paymentStatsQuery.eq('tenant_id', tenantId);
    } else if (!isSuperAdmin && adminTenantIds.length > 0) {
      paymentStatsQuery = paymentStatsQuery.in('tenant_id', adminTenantIds);
    }
    const { data: paymentStatsData } = await paymentStatsQuery;

    const paymentStats = {
      approved: paymentStatsData?.filter(p => p.payment_status === 'PAGO').length || 0,
      pending: paymentStatsData?.filter(p => p.payment_status === 'PENDENTE').length || 0,
      failed: paymentStatsData?.filter(p => p.payment_status === 'CANCELADO' || p.payment_status === 'REEMBOLSADO').length || 0,
    };

    // Conversion rate
    const totalWithPayment = paymentStatsData?.length || 0;
    const conversionRate = totalWithPayment > 0 
      ? (paymentStats.approved / totalWithPayment) * 100 
      : 0;

    return NextResponse.json({
      totalSubmissions: totalSubmissions || 0,
      totalRevenue,
      conversionRate,
      activeForms: activeForms || 0,
      submissionsByDay: submissionsByDayArray,
      revenueByDay: revenueByDayArray,
      formPerformance,
      paymentStats,
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
