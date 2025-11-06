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

  // Verificar permissão
  const { data: adminData, error: adminError } = await supabase
    .from('admins')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('tenant_id', tenant_id)
    .single();

  if (adminError || !adminData) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Buscar templates (tabela message_templates)
  const { data: mtData, error } = await supabase
    .from('message_templates')
    .select('id, tenant_id, key, title, content, is_active, created_at')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }

  // Mapear para o formato esperado pela UI de Templates WhatsApp
  const templates = (mtData || []).map((t) => ({
    id: t.id,
    tenant_id: t.tenant_id,
    name: t.title,
    message_template: t.content,
    trigger_event: t.key as 'payment_approved' | 'submission_created' | 'manual',
    is_active: !!t.is_active,
    created_at: t.created_at,
  }));

  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { tenant_id, name, message_template, trigger_event, is_active } = body;

  if (!tenant_id || !name || !message_template || !trigger_event) {
    return NextResponse.json(
      { error: 'tenant_id, name, message_template, and trigger_event are required' },
      { status: 400 }
    );
  }

  // Validar trigger_event
  const validTriggers = ['payment_approved', 'submission_created', 'manual'];
  if (!validTriggers.includes(trigger_event)) {
    return NextResponse.json({ error: 'Invalid trigger_event' }, { status: 400 });
  }

  // Verificar permissão
  const { data: adminData, error: adminError } = await supabase
    .from('admins')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('tenant_id', tenant_id)
    .single();

  if (adminError || !adminData) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Criar template (tabela message_templates)
  const variables = Array.from((message_template as string).matchAll(/\{\{(\w+)\}\}/g)).map(m => m[1]);
  const { data: templateRow, error } = await supabase
    .from('message_templates')
    .insert({
      tenant_id,
      key: trigger_event,
      title: name,
      content: message_template,
      variables,
      is_active: is_active !== false,
    })
    .select('id, tenant_id, key, title, content, is_active, created_at')
    .single();

  if (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    admin_id: user.id,
    tenant_id,
    action: 'create',
    resource_type: 'message_template',
    resource_id: templateRow.id,
    details: { message: `Template created: ${name}` },
  });

  // Responder no formato esperado pela UI
  return NextResponse.json({ template: {
    id: templateRow.id,
    tenant_id: templateRow.tenant_id,
    name: templateRow.title,
    message_template: templateRow.content,
    trigger_event: templateRow.key as 'payment_approved' | 'submission_created' | 'manual',
    is_active: !!templateRow.is_active,
    created_at: templateRow.created_at,
  } });
}
