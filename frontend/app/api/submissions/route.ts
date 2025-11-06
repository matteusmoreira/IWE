import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Garantir que a rota seja sempre dinâmica (sem cache)
export const dynamic = 'force-dynamic';

// GET /api/submissions - Listar submissões com filtros
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar usuário
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, admin_tenants(tenant_id)')
      .eq('auth_user_id', user.id)
      .single();

    if (userError) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Obter parâmetros de query
    const { searchParams } = new URL(request.url);
    const tenant_id = searchParams.get('tenant_id');
    const form_id = searchParams.get('form_id');
    const payment_status = searchParams.get('payment_status');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query base
    let query = supabase
      .from('submissions')
      .select(`
        *,
        tenants (
          id,
          name,
          slug
        ),
        form_definitions (
          id,
          name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrar por tenants se não for superadmin
    if (userData.role !== 'superadmin') {
      const tenantIds = userData.admin_tenants?.map((at: any) => at.tenant_id) || [];
      if (tenantIds.length === 0) {
        return NextResponse.json({ submissions: [], total: 0 });
      }
      query = query.in('tenant_id', tenantIds);
    }

    // Aplicar filtros
    if (tenant_id) {
      query = query.eq('tenant_id', tenant_id);
    }
    if (form_id) {
      query = query.eq('form_definition_id', form_id);
    }
    if (payment_status) {
      query = query.eq('payment_status', payment_status);
    }

    // Busca por texto (busca nos dados JSONB)
    if (search) {
      // Nota: Esta busca é simplificada. Para produção, considere usar full-text search
      query = query.or(`data->>'email'.ilike.%${search}%,data->>'nome'.ilike.%${search}%,data->>'name'.ilike.%${search}%`);
    }

    const { data: submissions, error: submissionsError, count } = await query;

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError);
      return NextResponse.json({ error: submissionsError.message }, { status: 500 });
    }

    return NextResponse.json({
      submissions: submissions || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error in submissions GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
