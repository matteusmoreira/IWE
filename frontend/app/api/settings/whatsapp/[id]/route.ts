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
  const body = await request.json();
  const { instance_name, instance_id, api_url, api_base_url, api_key, token, default_sender, is_active } = body;

  // Verificar se a config GLOBAL existe e se tem permissão
  const { data: existingConfig, error: fetchError } = await supabase
    .from('whatsapp_global_configs')
    .select('id')
    .eq('id', id)
    .single();
  if (fetchError || !existingConfig) {
    const fe = fetchError as unknown as { code?: string; message?: string; hint?: string } | null;
    const code = fe?.code;
    const message = fe?.message;
    const hint = fe?.hint;
    if (code === 'PGRST205' || /Could not find the table/i.test(String(message))) {
      return NextResponse.json(
        {
          error:
            'Tabela whatsapp_global_configs não encontrada. Execute as migrações do Supabase antes de salvar (20251107123000_global_settings.sql).',
          hint,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
  }

  // Permissão: apenas superadmin pode alterar config global
  const { data: roleRow } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (roleRow?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Atualizar configuração
  const updateData: Record<string, unknown> = {};
  if (instance_id !== undefined || instance_name !== undefined) updateData.instance_id = instance_id ?? instance_name;
  if (api_base_url !== undefined || api_url !== undefined) updateData.api_base_url = api_base_url ?? api_url;
  if (token !== undefined || api_key !== undefined) updateData.token = token ?? api_key;
  if (default_sender !== undefined) updateData.default_sender = default_sender;
  if (is_active !== undefined) updateData.is_active = is_active;

  const { data: config, error } = await supabase
    .from('whatsapp_global_configs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('Error updating WhatsApp global config:', error);
    const er = error as unknown as { code?: string; message?: string; hint?: string } | null;
    const code = er?.code;
    const message = er?.message;
    const hint = er?.hint;
    if (code === 'PGRST205' || /Could not find the table/i.test(String(message))) {
      return NextResponse.json(
        {
          error:
            'Tabela whatsapp_global_configs não encontrada. Execute as migrações do Supabase antes de salvar (20251107123000_global_settings.sql).',
          hint,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: roleRow?.id ?? null,
    tenant_id: null,
    action: 'UPDATE',
    resource_type: 'whatsapp_global_config',
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

  // Verificar se a config GLOBAL existe e se tem permissão
  const { data: existingConfig, error: fetchError } = await supabase
    .from('whatsapp_global_configs')
    .select('id')
    .eq('id', id)
    .single();
  if (fetchError || !existingConfig) {
    const fe = fetchError as unknown as { code?: string; message?: string; hint?: string } | null;
    const code = fe?.code;
    const message = fe?.message;
    const hint = fe?.hint;
    if (code === 'PGRST205' || /Could not find the table/i.test(String(message))) {
      return NextResponse.json(
        {
          error:
            'Tabela whatsapp_global_configs não encontrada. Execute as migrações do Supabase antes de deletar (20251107123000_global_settings.sql).',
          hint,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
  }

  // Permissão: apenas superadmin pode deletar config global
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
    .from('whatsapp_global_configs')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('Error deleting WhatsApp global config:', error);
    const er = error as unknown as { code?: string; message?: string; hint?: string } | null;
    const code = er?.code;
    const message = er?.message;
    const hint = er?.hint;
    if (code === 'PGRST205' || /Could not find the table/i.test(String(message))) {
      return NextResponse.json(
        {
          error:
            'Tabela whatsapp_global_configs não encontrada. Execute as migrações do Supabase antes de deletar (20251107123000_global_settings.sql).',
          hint,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Failed to delete configuration' }, { status: 500 });
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: roleRowDel?.id ?? null,
    tenant_id: null,
    action: 'DELETE',
    resource_type: 'whatsapp_global_config',
    resource_id: id,
    changes: { deleted_by_auth_user_id: user.id },
  });

  return NextResponse.json({ success: true });
}
