import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/client';

// GET /api/tenants - Listar todos os tenants
export async function GET() {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar dados do usuário para verificar role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Buscar tenants (RLS vai filtrar automaticamente)
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });

    if (tenantsError) {
      return NextResponse.json({ error: tenantsError.message }, { status: 500 });
    }

    return NextResponse.json({ tenants, role: userData.role });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('Error fetching tenants:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/tenants - Criar novo tenant
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é superadmin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    type UserBasic = Pick<Database['public']['Tables']['users']['Row'], 'id' | 'role'>;
    const userBasic = userData as UserBasic;
    if (userError || userBasic?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse do body
    const body = await request.json();
    const { name, slug, status, settings } = body;

    // Validações
    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Criar tenant
    const { data: tenant, error: createError } = await supabase
      .from('tenants')
      .insert({
        name,
        slug,
        status: status !== undefined ? status : true,
        settings: settings || {},
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Registrar auditoria
    await supabase.from('audit_logs').insert({
      tenant_id: tenant.id,
      user_id: userBasic.id,
      action: 'CREATE',
      resource_type: 'tenant',
      resource_id: tenant.id,
      changes: { name, slug, status, settings },
    });

    return NextResponse.json({ tenant }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('Error creating tenant:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
