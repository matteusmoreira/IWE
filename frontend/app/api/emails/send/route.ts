import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resend, sendEmail } from '@/lib/resend';
import { parseTemplateVariables } from '@/lib/utils';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Body esperado:
  // {
  //   tenant_id: string,
  //   to: string | string[],
  //   subject?: string,
  //   html?: string,
  //   template_key?: string, // ex.: 'payment_approved_email' ou 'manual'
  //   variables?: Record<string,string>,
  //   submission_id?: string, // opcional para preencher variáveis com dados da submissão
  // }
  const body = await request.json();
  const { tenant_id, to, subject, html, template_key, variables = {}, submission_id, reply_to, bcc } = body;

  if (!tenant_id || !to) {
    return NextResponse.json({ error: 'tenant_id e to são obrigatórios' }, { status: 400 });
  }

  // Verificar permissão do admin
  const { data: adminData, error: adminError } = await supabase
    .from('admins')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('tenant_id', tenant_id)
    .single();

  if (adminError || !adminData) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Validar envs Resend
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    return NextResponse.json({ error: 'Resend não configurado (RESEND_API_KEY/RESEND_FROM)' }, { status: 500 });
  }

  // Renderizar HTML
  let finalHtml = html as string | undefined;
  let finalSubject = subject as string | undefined;
  let usedTemplateId: string | null = null;

  // Se tiver submission_id, buscar para enriquecer variáveis
  let submission: any = null;
  if (submission_id) {
    const { data: sub } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submission_id)
      .single();
    submission = sub;
  }

  // Se template_key informado, buscar template
  if (template_key) {
    const { data: template, error: tmplError } = await supabase
      .from('message_templates')
      .select('*')
      .is('tenant_id', null)
      .eq('key', template_key)
      .eq('is_active', true)
      .single();
    if (tmplError || !template) {
      return NextResponse.json({ error: 'Template global não encontrado ou inativo' }, { status: 404 });
    }
    usedTemplateId = template.id;
    // Preparar variáveis: combinar corpo + submissão
    const v = {
      nome_completo: submission?.data?.nome_completo || submission?.data?.nome || submission?.data?.name,
      curso: submission?.data?.curso || submission?.data?.course,
      polo: submission?.tenant_name || '',
      valor: submission?.payment_amount != null ? String(submission.payment_amount) : undefined,
      ...submission?.data,
      ...variables,
    } as Record<string, any>;
    finalHtml = parseTemplateVariables(template.content, v);
    finalSubject = finalSubject || template.title;
  }

  if (!finalHtml || !finalSubject) {
    return NextResponse.json({ error: 'Informe html+subject ou um template_key válido' }, { status: 400 });
  }

  try {
    const result = await sendEmail({ to, subject: finalSubject, html: finalHtml, replyTo: reply_to, bcc });
    // Registrar auditoria (sem expor segredos)
    await supabase.from('audit_logs').insert({
      admin_id: user.id,
      tenant_id,
      action: 'create',
      resource_type: 'email',
      resource_id: usedTemplateId, // pode ser null quando html custom
      details: { message: 'Email enviado via Resend', to_count: Array.isArray(to) ? to.length : 1 },
    });
    return NextResponse.json({ id: (result as any)?.data?.id || null, success: true });
  } catch (err: any) {
    console.error('Erro ao enviar e-mail:', String(err).slice(0, 300));
    return NextResponse.json({ error: 'Falha ao enviar e-mail' }, { status: 500 });
  }
}