import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
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
    .from('whatsapp_configs')
    .select('*')
    .eq('tenant_id', tenant_id)
    .single();

  if (error) {
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

  const body = await request.json();
  const {
    tenant_id,
    instance_name, // legacy naming
    instance_id,
    api_url, // legacy naming
    api_base_url,
    api_key, // legacy naming
    token,
    default_sender,
    is_active,
  } = body;

  if (!tenant_id || !instance_name || !api_url || !api_key) {
    return NextResponse.json(
      { error: 'tenant_id, instance_name, api_url, and api_key are required' },
      { status: 400 }
    );
  }

  // Verificar permissão: superadmin tem acesso global, admin precisa ser do tenant
  const { data: roleRowPost } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (roleRowPost?.role !== 'superadmin') {
    const { data: isAdmin } = await supabase
      .rpc('is_admin_of_tenant', { tenant_uuid: tenant_id });
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Criar configuração
  const { data: config, error } = await supabase
    .from('whatsapp_configs')
    .insert({
      tenant_id,
      instance_id: instance_id ?? instance_name,
      api_base_url: api_base_url ?? api_url,
      token: token ?? api_key,
      default_sender: default_sender ?? null,
      is_active: is_active !== false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating WhatsApp config:', error);
    return NextResponse.json({ error: 'Failed to create configuration' }, { status: 500 });
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: roleRowPost?.id ?? null,
    tenant_id,
    action: 'CREATE',
    resource_type: 'whatsapp_config',
    resource_id: config.id,
    changes: { created_by_auth_user_id: user.id },
  });

  return NextResponse.json({ config });
}
