import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Permissão: admin e superadmin podem visualizar configuração global
  const { data: roleRow } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  const role = roleRow?.role;
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Buscar configuração GLOBAL
  const { data: config, error } = await supabase
    .from('whatsapp_global_configs')
    .select('*')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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
    instance_name, // legacy naming
    instance_id,
    api_url, // legacy naming
    api_base_url,
    api_key, // legacy naming
    token,
    default_sender,
    is_active,
  } = body;

  if (!instance_name && !instance_id) {
    return NextResponse.json(
      { error: 'instance_name or instance_id is required' },
      { status: 400 }
    );
  }
  if (!api_url && !api_base_url) {
    return NextResponse.json(
      { error: 'api_url or api_base_url is required' },
      { status: 400 }
    );
  }
  if (!api_key && !token) {
    return NextResponse.json(
      { error: 'api_key or token is required' },
      { status: 400 }
    );
  }

  // Apenas superadmin pode escrever configuração global
  const { data: roleRowPost } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (roleRowPost?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Se já existir, atualizar; caso contrário, criar
  const { data: existing } = await supabase
    .from('whatsapp_global_configs')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    instance_id: instance_id ?? instance_name,
    api_base_url: api_base_url ?? api_url,
    token: token ?? api_key,
    default_sender: default_sender ?? null,
    is_active: is_active !== false,
  };

  let config: any = null;
  if (existing?.id) {
    const { data: updated, error } = await supabase
      .from('whatsapp_global_configs')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) {
      console.error('Error updating WhatsApp global config:', error);
      return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
    }
    config = updated;
  } else {
    const { data: created, error } = await supabase
      .from('whatsapp_global_configs')
      .insert(payload)
      .select()
      .single();
    if (error) {
      console.error('Error creating WhatsApp global config:', error);
      return NextResponse.json({ error: 'Failed to create configuration' }, { status: 500 });
    }
    config = created;
  }

  // Audit log (sem tenant)
  await supabase.from('audit_logs').insert({
    user_id: roleRowPost?.id ?? null,
    tenant_id: null,
    action: 'CREATE',
    resource_type: 'whatsapp_global_config',
    resource_id: config.id,
    changes: { created_by_auth_user_id: user.id },
  });

  return NextResponse.json({ config });
}
