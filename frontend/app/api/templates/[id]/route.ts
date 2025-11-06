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
  const { name, message_template, trigger_event, is_active } = body;

  // Verificar se o template existe e se o admin tem permissão
  const { data: existingTemplate, error: fetchError } = await supabase
    .from('whatsapp_templates')
    .select('tenant_id, name')
    .eq('id', id)
    .single();

  if (fetchError || !existingTemplate) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const { data: adminData, error: adminError } = await supabase
    .from('admins')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('tenant_id', existingTemplate.tenant_id)
    .single();

  if (adminError || !adminData) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Validar trigger_event se fornecido
  if (trigger_event) {
    const validTriggers = ['payment_approved', 'submission_created', 'manual'];
    if (!validTriggers.includes(trigger_event)) {
      return NextResponse.json({ error: 'Invalid trigger_event' }, { status: 400 });
    }
  }

  // Atualizar template
  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (message_template !== undefined) updateData.message_template = message_template;
  if (trigger_event !== undefined) updateData.trigger_event = trigger_event;
  if (is_active !== undefined) updateData.is_active = is_active;

  const { data: template, error } = await supabase
    .from('whatsapp_templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    admin_id: user.id,
    tenant_id: existingTemplate.tenant_id,
    action: 'update',
    resource_type: 'whatsapp_template',
    resource_id: id,
    details: { message: `Template updated: ${existingTemplate.name}` },
  });

  return NextResponse.json({ template });
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

  // Verificar se o template existe e se o admin tem permissão
  const { data: existingTemplate, error: fetchError } = await supabase
    .from('whatsapp_templates')
    .select('tenant_id, name')
    .eq('id', id)
    .single();

  if (fetchError || !existingTemplate) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const { data: adminData, error: adminError } = await supabase
    .from('admins')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('tenant_id', existingTemplate.tenant_id)
    .single();

  if (adminError || !adminData) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Deletar template
  const { error } = await supabase
    .from('whatsapp_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    admin_id: user.id,
    tenant_id: existingTemplate.tenant_id,
    action: 'delete',
    resource_type: 'whatsapp_template',
    resource_id: id,
    details: { message: `Template deleted: ${existingTemplate.name}` },
  });

  return NextResponse.json({ success: true });
}
