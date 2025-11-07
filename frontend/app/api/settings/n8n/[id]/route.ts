import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const { webhook_url, auth_token, timeout_seconds, timeout_ms, max_retries, retries, is_active } = body;

  // Verificar se a config GLOBAL existe
  const { data: existingConfig, error: fetchError } = await supabase
    .from('outbound_webhook_global_configs')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchError || !existingConfig) {
    return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
  }

  // Permissão: apenas superadmin pode atualizar configuração global
  const { data: roleRow } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (roleRow?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Atualizar configuração
  const updateData: any = {};
  if (webhook_url !== undefined) updateData.enrollment_webhook_url = webhook_url;
  if (auth_token !== undefined) updateData.enrollment_webhook_token = auth_token || null;
  if (timeout_ms !== undefined) updateData.timeout_ms = timeout_ms;
  if (timeout_seconds !== undefined) updateData.timeout_ms = timeout_seconds * 1000;
  if (retries !== undefined) updateData.retries = retries;
  if (max_retries !== undefined) updateData.retries = max_retries;
  if (is_active !== undefined) updateData.is_active = is_active;

  const { data: config, error } = await supabase
    .from('outbound_webhook_global_configs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating n8n config:', error);
    return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: roleRow?.id ?? null,
    tenant_id: null,
    action: 'UPDATE',
    resource_type: 'outbound_webhook_global_config',
    resource_id: id,
    changes: { updated_by_auth_user_id: user.id },
  });

  return NextResponse.json({ config });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  // Verificar se a config GLOBAL existe
  const { data: existingConfig, error: fetchError } = await supabase
    .from('outbound_webhook_global_configs')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchError || !existingConfig) {
    return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
  }

  // Permissão: apenas superadmin pode excluir configuração global
  const { data: roleRowDel } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (roleRowDel?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Deletar configuração
  const { error } = await supabase
    .from('outbound_webhook_global_configs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting n8n config:', error);
    return NextResponse.json({ error: 'Failed to delete configuration' }, { status: 500 });
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: roleRowDel?.id ?? null,
    tenant_id: null,
    action: 'DELETE',
    resource_type: 'outbound_webhook_global_config',
    resource_id: id,
    changes: { deleted_by_auth_user_id: user.id },
  });

  return NextResponse.json({ success: true });
}
