import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Permissões: qualquer usuário autenticado com papel admin/superadmin pode listar templates globais
  const { data: roleRow } = await supabase
    .from('users')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();
  const role = roleRow?.role;
  if (!role || (role !== 'admin' && role !== 'superadmin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Buscar templates globais (tenant_id IS NULL)
  const { data: mtData, error } = await supabase
    .from('message_templates')
    .select('id, tenant_id, key, title, content, variables, is_active, created_at, form_definition_id')
    .is('tenant_id', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }

  // Mapear para formato neutro consumido por múltiplas UIs
  const templates = (mtData || []).map((t) => ({
    id: t.id,
    tenant_id: t.tenant_id,
    name: t.title,
    message_template: t.content,
    trigger_event: t.key,
    variables: t.variables ?? [],
    is_active: !!t.is_active,
    created_at: t.created_at,
    form_definition_id: t.form_definition_id,
  }));

  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  // Suportar ambas convenções: name/title e message_template/content
  const name = body.name ?? body.title;
  const message_template = body.message_template ?? body.content;
  const trigger_event = body.trigger_event ?? body.key;
  const is_active = body.is_active;
  const form_definition_id = body.form_definition_id ?? body.formDefinitionId ?? null;

  if (!name || !message_template || !trigger_event) {
    return NextResponse.json(
      { error: 'name/title, message_template/content e trigger_event são obrigatórios' },
      { status: 400 }
    );
  }

  // Validar trigger_event (expandido para suportar e-mail pós-pagamento e templates comuns)
  const validTriggers = ['payment_approved', 'payment_approved_email', 'payment_reminder', 'welcome', 'submission_created', 'manual'];
  if (!validTriggers.includes(trigger_event)) {
    return NextResponse.json({ error: 'Invalid trigger_event' }, { status: 400 });
  }

  // Verificar permissão: superadmin tem acesso global; admin precisa ser do tenant
  const { data: roleRowPost } = await supabase
    .from('users')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();

  // Templates globais: apenas superadmin pode criar/editar/deletar
  const isSuperAdminPost = roleRowPost?.role === 'superadmin';
  if (!isSuperAdminPost) {
    return NextResponse.json({ error: 'Apenas superadmin pode criar templates globais' }, { status: 403 });
  }

  // Criar template (tabela message_templates)
  const variables = Array.from((message_template as string).matchAll(/\{\{(\w+)\}\}/g)).map(m => m[1]);

  // Evitar duplicidade de chave global
  const { data: existingByKeyAndForm } = await supabase
    .from('message_templates')
    .select('id')
    .is('tenant_id', null)
    .eq('key', trigger_event)
    .eq('form_definition_id', form_definition_id)
    .maybeSingle();
  if (existingByKeyAndForm) {
    return NextResponse.json({ error: 'Já existe um template global com essa chave para este formulário.' }, { status: 409 });
  }
  const { data: templateRow, error } = await supabase
    .from('message_templates')
    .insert({
      tenant_id: null,
      key: trigger_event,
      title: name,
      content: message_template,
      variables,
      is_active: is_active !== false,
      form_definition_id,
    })
    .select('id, tenant_id, key, title, content, variables, is_active, created_at, form_definition_id')
    .single();

  if (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    tenant_id: null,
    action: 'create',
    resource_type: 'message_template',
    resource_id: templateRow.id,
    changes: { message: `Template global criado: ${name}` },
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
