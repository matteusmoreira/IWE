import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseTemplateVariables } from '@/lib/utils';

type SendWhatsAppBody = {
  tenant_id: string;
  to: string[] | string; // números no formato 11999999999 ou 5511999999999
  template_key?: string;
  message?: string; // conteúdo bruto se não usar template
  variables?: Record<string, any>;
  submission_id?: string; // opcional para log
};

function normalizePhone(input: string): string {
  const cleaned = String(input).replace(/\D/g, '');
  let number = cleaned;
  if (/^\d{11}$/.test(cleaned)) {
    number = `55${cleaned}`;
  } else if (/^\d{13}$/.test(cleaned) && cleaned.startsWith('55')) {
    number = cleaned;
  }
  return number;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SendWhatsAppBody = await request.json();
    const { tenant_id, to, template_key, message, variables = {}, submission_id } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id é obrigatório' }, { status: 400 });
    }
    const recipients = Array.isArray(to) ? to : [to];
    if (!recipients?.length) {
      return NextResponse.json({ error: 'Destinatários são obrigatórios' }, { status: 400 });
    }

  // Verificar se usuário é admin do tenant (via RLS e policies)
  const { data: userRow } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();
  if (!userRow) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Permissão: superadmin tem acesso global; admin precisa ser do tenant
  if (userRow.role !== 'superadmin') {
    const { data: isAdmin } = await supabase.rpc('is_admin_of_tenant', { tenant_uuid: tenant_id });
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

    // Buscar configuração GLOBAL do WhatsApp (unificada)
    const { data: whatsappConfig } = await supabase
      .from('whatsapp_global_configs')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!whatsappConfig) {
      return NextResponse.json({ error: 'WhatsApp não configurado' }, { status: 400 });
    }

    // Montar mensagem: template ou texto
    let content = message || '';
    let templateId: string | null = null;
    if (template_key) {
      const { data: template } = await supabase
        .from('message_templates')
        .select('*')
        .is('tenant_id', null)
        .eq('key', template_key)
        .eq('is_active', true)
        .single();
      if (!template) {
        return NextResponse.json({ error: 'Template global não encontrado' }, { status: 404 });
      }
      templateId = template.id;
      content = parseTemplateVariables(template.content, variables);
    }
    if (!content) {
      return NextResponse.json({ error: 'Conteúdo da mensagem é obrigatório' }, { status: 400 });
    }

    let success = 0;
    let failures = 0;
    for (const raw of recipients) {
      const normalized = normalizePhone(raw);
      // Enviar via Evolution API
      const resp = await fetch(`${whatsappConfig.api_base_url}/message/sendText/${whatsappConfig.instance_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': whatsappConfig.token,
        },
        body: JSON.stringify({ number: normalized, text: content }),
      });

      if (!resp.ok) {
        failures++;
        const errText = await resp.text().catch(() => '');
        await supabase.from('message_logs').insert({
          tenant_id,
          template_id: templateId,
          submission_id: submission_id || null,
          recipient_phone: String(raw),
          message_content: content,
          status: 'FAILED',
          error_message: `Evolution API ${resp.status}: ${errText?.slice(0, 300)}`,
        });
        continue;
      }

      success++;
      await supabase.from('message_logs').insert({
        tenant_id,
        template_id: templateId,
        submission_id: submission_id || null,
        recipient_phone: String(raw),
        message_content: content,
        status: 'SENT',
        sent_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success, failures });
  } catch (error: any) {
    console.error('WhatsApp send error:', error);
    return NextResponse.json({ error: 'Falha ao enviar WhatsApp' }, { status: 500 });
  }
}