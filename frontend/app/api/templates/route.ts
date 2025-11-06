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

  // Buscar templates
  const { data: templates, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }

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

  // Criar template
  const { data: template, error } = await supabase
    .from('whatsapp_templates')
    .insert({
      tenant_id,
      name,
      message_template,
      trigger_event,
      is_active: is_active !== false,
    })
    .select()
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
    resource_type: 'whatsapp_template',
    resource_id: template.id,
    details: { message: `Template created: ${name}` },
  });

  return NextResponse.json({ template });
}
