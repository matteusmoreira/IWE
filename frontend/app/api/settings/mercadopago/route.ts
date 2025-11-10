import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tenant_id = searchParams.get('tenant_id');

  if (!tenant_id) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
  }

  // Verificar permissão: superadmin tem acesso global, admin precisa ser do tenant
  const { data: roleRow } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (roleRow?.role !== 'superadmin') {
    const { data: isAdmin } = await supabase
      .rpc('is_admin_of_tenant', { tenant_uuid: tenant_id });
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Buscar configuração
  const { data: config, error } = await supabase
    .from('mercadopago_configs')
    .select('*')
    .eq('tenant_id', tenant_id)
    .single();

  if (error) {
    // Se não existe, retornar sem erro
    return NextResponse.json({ config: null });
  }

  return NextResponse.json({ config });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const tenant_id = typeof body.tenant_id === 'string' || typeof body.tenant_id === 'number' ? body.tenant_id : null;
  const access_token = typeof body.access_token === 'string' ? body.access_token : null;
  const public_key = typeof body.public_key === 'string' ? body.public_key : null;
  const webhook_secret = typeof body.webhook_secret === 'string' ? body.webhook_secret : null;
  const is_production = typeof body.is_production === 'boolean' ? body.is_production : undefined;
  const is_active = typeof body.is_active === 'boolean' ? body.is_active : undefined;

  if (!tenant_id || !access_token) {
    return NextResponse.json({ error: 'tenant_id and access_token are required' }, { status: 400 });
  }

  // Verificar permissão: superadmin tem acesso global, admin precisa ser do tenant
  const { data: roleRow } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (roleRow?.role !== 'superadmin') {
    const { data: isAdmin } = await supabase
      .rpc('is_admin_of_tenant', { tenant_uuid: tenant_id });
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Criar configuração
  const { data: config, error } = await supabase
    .from('mercadopago_configs')
    .insert({
      tenant_id,
      access_token,
      public_key: public_key ?? null,
      webhook_secret: webhook_secret ?? null,
      // Mapear corretamente para o schema (is_production). Padrão seguro: false.
      is_production: typeof is_production === 'boolean' ? is_production : false,
      is_active: is_active !== false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating Mercado Pago config:', error);
    return NextResponse.json({ error: 'Failed to create configuration' }, { status: 500 });
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: roleRow?.id ?? null,
    tenant_id,
    action: 'CREATE',
    resource_type: 'mercadopago_config',
    resource_id: config.id,
    changes: { created_by_auth_user_id: user.id },
  });

  return NextResponse.json({ config });
}
