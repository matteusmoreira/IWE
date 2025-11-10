import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  const access_token = typeof body.access_token === 'string' ? body.access_token : undefined;
  const public_key = typeof body.public_key === 'string' ? body.public_key : undefined;
  const webhook_secret = typeof body.webhook_secret === 'string' ? body.webhook_secret : undefined;
  const is_sandbox = typeof body.is_sandbox === 'boolean' ? body.is_sandbox : undefined;
  const is_production = typeof body.is_production === 'boolean' ? body.is_production : undefined;
  const is_active = typeof body.is_active === 'boolean' ? body.is_active : undefined;

  // Verificar se a config existe e se o admin tem permissão
  const { data: existingConfig, error: fetchError } = await supabase
    .from('mercadopago_configs')
    .select('tenant_id')
    .eq('id', id)
    .single();

  if (fetchError || !existingConfig) {
    return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
  }

  // Verificar permissão: superadmin tem acesso global, admin precisa ser do tenant
  const { data: roleRow } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (roleRow?.role !== 'superadmin') {
    const { data: isAdmin } = await supabase
      .rpc('is_admin_of_tenant', { tenant_uuid: existingConfig.tenant_id });
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Atualizar configuração
  const updateData: Record<string, unknown> = {};
  if (access_token !== undefined) updateData.access_token = access_token;
  if (public_key !== undefined) updateData.public_key = public_key ?? null;
  if (webhook_secret !== undefined) updateData.webhook_secret = webhook_secret ?? null;
  if (is_production !== undefined) {
    updateData.is_production = is_production;
  } else if (is_sandbox !== undefined) {
    updateData.is_production = !is_sandbox;
  }
  if (is_active !== undefined) updateData.is_active = is_active;

  const { data: config, error } = await supabase
    .from('mercadopago_configs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating Mercado Pago config:', error);
    return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: roleRow?.id ?? null,
    tenant_id: existingConfig.tenant_id,
    action: 'UPDATE',
    resource_type: 'mercadopago_config',
    resource_id: id,
    changes: { updated_by_auth_user_id: user.id },
  });

  return NextResponse.json({ config });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  // Verificar se a config existe e se o admin tem permissão
  const { data: existingConfig, error: fetchError } = await supabase
    .from('mercadopago_configs')
    .select('tenant_id')
    .eq('id', id)
    .single();

  if (fetchError || !existingConfig) {
    return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
  }

  // Verificar permissão: superadmin tem acesso global, admin precisa ser do tenant
  const { data: roleRowDel } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (roleRowDel?.role !== 'superadmin') {
    const { data: isAdminDel } = await supabase
      .rpc('is_admin_of_tenant', { tenant_uuid: existingConfig.tenant_id });
    if (!isAdminDel) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Deletar configuração
  const { error } = await supabase
    .from('mercadopago_configs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting Mercado Pago config:', error);
    return NextResponse.json({ error: 'Failed to delete configuration' }, { status: 500 });
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: roleRowDel?.id ?? null,
    tenant_id: existingConfig.tenant_id,
    action: 'DELETE',
    resource_type: 'mercadopago_config',
    resource_id: id,
    changes: { deleted_by_auth_user_id: user.id },
  });

  return NextResponse.json({ success: true });
}
