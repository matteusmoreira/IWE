import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
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

  if (roleRow?.role !== 'admin' && roleRow?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Buscar configuração GLOBAL
  const { data: config, error } = await supabase
    .from('outbound_webhook_global_configs')
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

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const webhook_url = typeof body.webhook_url === 'string' ? body.webhook_url : '';
  const auth_token = typeof body.auth_token === 'string' ? body.auth_token : null;
  const timeout_seconds = typeof body.timeout_seconds === 'number' ? body.timeout_seconds : undefined;
  const timeout_ms = typeof body.timeout_ms === 'number' ? body.timeout_ms : undefined;
  const max_retries = typeof body.max_retries === 'number' ? body.max_retries : undefined;
  const retries = typeof body.retries === 'number' ? body.retries : undefined;
  const is_active = typeof body.is_active === 'boolean' ? body.is_active : undefined;

  if (!webhook_url) {
    return NextResponse.json({ error: 'webhook_url is required' }, { status: 400 });
  }

  // Permissão: apenas superadmin pode escrever configuração global
  const { data: roleRowPost } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (roleRowPost?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Upsert configuração GLOBAL na tabela outbound_webhook_global_configs
  const timeoutCalculated =
    typeof timeout_ms === 'number'
      ? timeout_ms
      : typeof timeout_seconds === 'number'
        ? timeout_seconds * 1000
        : 30000; // default 30s

  const { data: existing } = await supabase
    .from('outbound_webhook_global_configs')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    enrollment_webhook_url: webhook_url,
    enrollment_webhook_token: auth_token ?? null,
    timeout_ms: timeoutCalculated,
    retries: typeof retries === 'number' ? retries : (typeof max_retries === 'number' ? max_retries : 3),
    is_active: is_active !== false,
  };

  let finalConfig: Record<string, unknown> | null = null;
  if (existing?.id) {
    const { data: updated, error } = await supabase
      .from('outbound_webhook_global_configs')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) {
      console.error('Error updating n8n global config:', error);
      return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
    }
    finalConfig = updated as Record<string, unknown>;
  } else {
    const { data: created, error } = await supabase
      .from('outbound_webhook_global_configs')
      .insert(payload)
      .select()
      .single();
    if (error) {
      console.error('Error creating n8n global config:', error);
      return NextResponse.json({ error: 'Failed to create configuration' }, { status: 500 });
    }
    finalConfig = created as Record<string, unknown>;
  }

  // sucesso

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: roleRowPost?.id ?? null,
    tenant_id: null,
    action: 'CREATE',
    resource_type: 'outbound_webhook_global_config',
    resource_id: (finalConfig as { id?: unknown })?.id ?? null,
    changes: { created_by_auth_user_id: user.id },
  });

  return NextResponse.json({ config: finalConfig });
}
