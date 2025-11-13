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
  // Aceitar aliases (name/title, message_template/content)
  const name = body.name ?? body.title;
  const message_template = body.message_template ?? body.content;
  const trigger_event = body.trigger_event ?? body.key;
  const is_active = body.is_active;
  const form_definition_id = body.form_definition_id ?? body.formDefinitionId;

  // Verificar se o template existe e se o admin tem permissão (tabela message_templates)
  const { data: existingTemplate, error: fetchError } = await supabase
    .from('message_templates')
    .select('tenant_id, title')
    .eq('id', id)
    .single();

  if (fetchError || !existingTemplate) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  // Verificar permissão: superadmin tem acesso global; admin precisa ser do tenant
  const { data: roleRow } = await supabase
    .from('users')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();
  const isSuperAdmin = roleRow?.role === 'superadmin';
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Apenas superadmin pode editar templates globais' }, { status: 403 });
  }

  // Validar trigger_event se fornecido (expandido)
  if (trigger_event) {
    const validTriggers = ['payment_approved', 'payment_approved_email', 'payment_reminder', 'welcome', 'submission_created', 'manual'];
    if (!validTriggers.includes(trigger_event)) {
      return NextResponse.json({ error: 'Invalid trigger_event' }, { status: 400 });
    }
  }

  // Atualizar template (tabela message_templates)
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.title = name;
  if (message_template !== undefined) {
    updateData.content = message_template;
    // Atualizar variáveis dinamicamente conforme placeholders
    const variables = Array.from((message_template as string).matchAll(/\{\{(\w+)\}\}/g)).map(m => m[1]);
    updateData.variables = variables;
  }
  if (trigger_event !== undefined) updateData.key = trigger_event;
  if (form_definition_id !== undefined) updateData.form_definition_id = form_definition_id || null;
  if (is_active !== undefined) updateData.is_active = is_active;

  const { data: templateRow, error } = await supabase
    .from('message_templates')
    .update(updateData)
    .eq('id', id)
    .select('id, tenant_id, key, title, content, variables, is_active, created_at, form_definition_id')
    .single();

  if (error) {
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    tenant_id: null,
    action: 'update',
    resource_type: 'message_template',
    resource_id: id,
    changes: { message: `Template global atualizado: ${existingTemplate.title}` },
  });

  // Responder no formato esperado pela UI
  return NextResponse.json({ template: {
    id: templateRow.id,
    tenant_id: templateRow.tenant_id,
    name: templateRow.title,
    message_template: templateRow.content,
    trigger_event: templateRow.key,
    variables: templateRow.variables ?? [],
    is_active: !!templateRow.is_active,
    created_at: templateRow.created_at,
    form_definition_id: templateRow.form_definition_id,
  } });
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

  // Verificar se o template existe e se o admin tem permissão (tabela message_templates)
  const { data: existingTemplate, error: fetchError } = await supabase
    .from('message_templates')
    .select('tenant_id, title')
    .eq('id', id)
    .single();

  if (fetchError || !existingTemplate) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  // Verificar permissão: superadmin tem acesso global; admin precisa ser do tenant
  const { data: roleRowDel } = await supabase
    .from('users')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();
  const isSuperAdminDel = roleRowDel?.role === 'superadmin';
  if (!isSuperAdminDel) {
    return NextResponse.json({ error: 'Apenas superadmin pode excluir templates globais' }, { status: 403 });
  }

  // Deletar template (tabela message_templates)
  const { error } = await supabase
    .from('message_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    tenant_id: null,
    action: 'delete',
    resource_type: 'message_template',
    resource_id: id,
    changes: { message: `Template global excluído: ${existingTemplate.title}` },
  });

  return NextResponse.json({ success: true });
}
