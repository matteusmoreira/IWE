import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/webhooks/mercadopago - Webhook do Mercado Pago
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    console.log('Mercado Pago webhook received:', body);

    // Mercado Pago envia tipo e ID do recurso
    const { type, data } = body;

    // Verificar se é uma notificação de pagamento
    if (type !== 'payment') {
      return NextResponse.json({ received: true });
    }

    const paymentId = data?.id;
    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID not found' }, { status: 400 });
    }

    // Verificar idempotência - se já processamos este evento
    const { data: existingEvent } = await supabase
      .from('payment_events')
      .select('id')
      .eq('event_id', paymentId)
      .eq('provider', 'mercadopago')
      .single();

    if (existingEvent) {
      console.log('Event already processed:', paymentId);
      return NextResponse.json({ received: true, message: 'Already processed' });
    }

    // Buscar detalhes do pagamento no Mercado Pago
    // Precisamos do access_token, mas não sabemos qual tenant ainda
    // Vamos buscar pelo external_reference depois de obter o pagamento

    // Por enquanto, registrar o evento como recebido
    const { data: eventRecord } = await supabase
      .from('payment_events')
      .insert({
        event_id: paymentId,
        provider: 'mercadopago',
        event_type: type,
        raw_payload: body,
      })
      .select()
      .single();

    // Processar de forma assíncrona (em produção, usar fila)
    processPaymentWebhook(paymentId, eventRecord?.id).catch(error => {
      console.error('Error processing payment webhook:', error);
    });

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('Webhook error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/webhooks/mercadopago - Endpoint de teste
export async function GET() {
  return NextResponse.json({ 
    status: 'Mercado Pago webhook endpoint is active',
    timestamp: new Date().toISOString() 
  });
}

// Função auxiliar para processar o webhook
type SubmissionRow = {
  id: string;
  tenant_id: string;
  tenants?: { name?: string } | null;
  tenant_name?: string | null;
  data: Record<string, unknown>;
  payment_amount?: number | null;
  payment_date?: string | null;
};

async function processPaymentWebhook(paymentId: string, eventId?: string) {
  try {
    // Buscar submission pelo payment_external_id
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('*, tenants(*)')
      .eq('payment_external_id', paymentId)
      .single();

    if (submissionError || !submission) {
      console.error('Submission not found for payment:', paymentId);
      
      // Atualizar evento como falha
      // Sem atualização de status pois a tabela não possui coluna de status
      return;
    }

    // Token do tenant quando disponível; fallback para variável de ambiente
    const { data: cfg } = await supabase
      .from('mercadopago_configs')
      .select('access_token, is_active')
      .eq('tenant_id', submission.tenant_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const accessToken = (cfg && cfg.is_active !== false && cfg.access_token)
      ? cfg.access_token
      : (process.env.MP_ACCESS_TOKEN || '');

    if (!accessToken || accessToken.trim() === '') {
      console.error('Credenciais do Mercado Pago não configuradas para processamento de webhook');
      if (eventId) {
        await supabase
          .from('payment_events')
          .update({ error_message: 'Credenciais do Mercado Pago não configuradas' })
          .eq('id', eventId);
      }
      return;
    }

    // Buscar detalhes do pagamento na API do Mercado Pago
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const payment = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error('Error fetching payment from MP:', payment);
      
      // Sem atualização de status; apenas log em console
      return;
    }

    // Mapear status do MP para nosso enum
    let paymentStatus = 'PENDENTE';
    if (payment.status === 'approved') {
      paymentStatus = 'PAGO';
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      paymentStatus = 'CANCELADO';
    }

    // Atualizar submission
    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        payment_status: paymentStatus,
        payment_date: payment.status === 'approved' ? new Date().toISOString() : null,
        payment_amount: payment.transaction_amount,
        metadata: {
          ...submission.metadata,
          mp_payment_id: payment.id,
          mp_status: payment.status,
          mp_status_detail: payment.status_detail,
          mp_payment_method: payment.payment_method_id,
          mp_payment_type: payment.payment_type_id,
        },
      })
      .eq('id', submission.id);

    if (updateError) {
      console.error('Error updating submission:', updateError);
      return;
    }

    // Atualizar evento como processado
    if (eventId) {
      await supabase
        .from('payment_events')
        .update({ 
          submission_id: submission.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', eventId);
    }

    // Se pagamento aprovado, disparar ações automáticas
    if (payment.status === 'approved') {
      // 1. Enviar WhatsApp (se configurado)
      await sendWhatsAppNotification(submission as SubmissionRow);

      // 2. Enviar para n8n/Moodle (se configurado)
      await sendToMoodle(submission as SubmissionRow);

      // 3. Enviar E-mail (Resend), se configurado
      await sendEmailNotification(submission as SubmissionRow);
    }

    console.log('Payment webhook processed successfully:', paymentId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in processPaymentWebhook:', message);
    // Sem atualização de status na payment_events (schema atual não possui coluna de status)
  }
}

// Função auxiliar para enviar WhatsApp
async function sendWhatsAppNotification(submission: SubmissionRow) {
  try {
    // Buscar configuração WhatsApp GLOBAL
    const { data: whatsappConfig } = await supabase
      .from('whatsapp_global_configs')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!whatsappConfig) {
      console.log('WhatsApp not configured for tenant:', submission.tenant_id);
      return;
    }

    // Buscar template de confirmação de pagamento
    // Usa a tabela message_templates com chave 'payment_approved' conforme seeds
    const { data: template } = await supabase
      .from('message_templates')
      .select('*')
      .is('tenant_id', null)
      .eq('key', 'payment_approved')
      .eq('is_active', true)
      .single();

    if (!template) {
      console.log('No payment confirmation template found');
      return;
    }

    // Extrair número de telefone
    const phone = String((submission.data as Record<string, unknown>).telefone ?? (submission.data as Record<string, unknown>).phone ?? '');
    if (!phone) {
      console.log('No phone number in submission');
      return;
    }

    // Preparar variáveis para o template (alinhado aos seeds)
    const sdata = submission.data as Record<string, unknown>;
    const variables: Record<string, unknown> = {
      nome_completo: (sdata.nome_completo as string) ?? (sdata.nome as string) ?? (sdata.name as string) ?? 'Aluno',
      curso: (sdata.curso as string) ?? (sdata.course as string) ?? '',
      polo: submission.tenants?.name ?? submission.tenant_name ?? '',
      valor: submission.payment_amount != null ? Number(submission.payment_amount).toFixed(2) : '0.00',
      ...sdata,
    };

    // Substituir variáveis no template usando util
    // Evita substituições quebradas e mantém placeholders não encontrados
    // import implícito: util fica no lado do cliente; replicamos logicamente aqui
    const message = template.content.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
      const v = variables as Record<string, unknown>;
      return v[key] !== undefined ? String(v[key]) : match;
    });

    // Normalizar telefone para Evolution API (E.164 simplificado)
    const cleaned = phone.replace(/\D/g, '');
    let number = cleaned;
    if (/^\d{11}$/.test(cleaned)) {
      // Telefone BR sem DDI, prefixar 55
      number = `55${cleaned}`;
    } else if (/^\d{13}$/.test(cleaned) && cleaned.startsWith('55')) {
      number = cleaned;
    }

    // Enviar via Evolution API v2 [formato do endpoint confirmado]
    const evoResp = await fetch(`${whatsappConfig.api_base_url}/message/sendText/${whatsappConfig.instance_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': whatsappConfig.token,
      },
      body: JSON.stringify({
        number,
        text: message,
      }),
    });

    if (!evoResp.ok) {
      const errText = await evoResp.text().catch(() => '');
      console.error('Evolution API error:', evoResp.status, errText);
      await supabase.from('message_logs').insert({
        tenant_id: submission.tenant_id,
        template_id: template.id,
        submission_id: submission.id,
        recipient_phone: phone,
        message_content: message,
        status: 'FAILED',
        error_message: `Evolution API ${evoResp.status}: ${errText?.slice(0, 300)}`,
      });
      return;
    }

    // Registrar log
    await supabase.from('message_logs').insert({
      tenant_id: submission.tenant_id,
      template_id: template.id,
      submission_id: submission.id,
      recipient_phone: phone,
      message_content: message,
      status: 'SENT',
      sent_at: new Date().toISOString(),
    });

    console.log('WhatsApp notification sent successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error sending WhatsApp:', message);
    try {
      await supabase.from('message_logs').insert({
        tenant_id: submission.tenant_id,
        submission_id: submission.id,
        recipient_phone: String((submission.data as Record<string, unknown>).telefone ?? (submission.data as Record<string, unknown>).phone ?? ''),
        message_content: 'Erro ao enviar mensagem',
        status: 'FAILED',
        error_message: message.slice(0, 300),
      });
    } catch {
      // evita crash em erro de log
    }
  }
}

// Função auxiliar para enviar E-mail via Resend
async function sendEmailNotification(submission: SubmissionRow) {
  try {
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
      // Não configurado, ignorar silenciosamente
      return;
    }

    // Extrair e-mail do aluno
    const sdata = submission.data as Record<string, unknown>;
    const email = String(sdata.email ?? sdata.contato_email ?? sdata['e-mail' as keyof typeof sdata] ?? sdata['email_contato' as keyof typeof sdata] ?? '');
    if (!email) {
      console.log('No email in submission');
      return;
    }

    // Buscar template de confirmação de pagamento para e-mail (se existir)
    const { data: template } = await supabase
      .from('message_templates')
      .select('*')
      .is('tenant_id', null)
      .eq('key', 'payment_approved_email')
      .eq('is_active', true)
      .single();

    const variables: Record<string, unknown> = {
      nome_completo: (sdata.nome_completo as string) ?? (sdata.nome as string) ?? (sdata.name as string) ?? 'Aluno',
      curso: (sdata.curso as string) ?? (sdata.course as string) ?? '',
      polo: submission.tenants?.name ?? submission.tenant_name ?? '',
      valor: submission.payment_amount != null ? Number(submission.payment_amount).toFixed(2) : '0.00',
      ...sdata,
    };

    const subject = template?.title || 'Confirmação de pagamento';
    const html = (template?.content || `
      <p>Olá, {{nome_completo}}!</p>
      <p>Seu pagamento de {{valor}} para o curso {{curso}} no polo {{polo}} foi aprovado.</p>
      <p>Em breve você receberá orientações de acesso.</p>
    `).replace(/\{\{(\w+)\}\}/g, (m: string, key: string) => variables[key] !== undefined ? String(variables[key]) : m);

    const replyTo = process.env.RESEND_REPLY_TO;
    await sendEmail({ to: email, subject, html, replyTo });

    // Registrar auditoria (não há tabela específica de e-mail logs)
    await supabase.from('audit_logs').insert({
      admin_id: null,
      tenant_id: submission.tenant_id,
      action: 'create',
      resource_type: 'email',
      resource_id: template?.id || null,
      details: { message: 'Email pós-pagamento enviado', to: '***' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error sending Email:', message.slice(0, 300));
  }
}

// Função auxiliar para enviar para Moodle via n8n
async function sendToMoodle(submission: SubmissionRow) {
  try {
    // Buscar configuração webhook
    const { data: webhookConfig } = await supabase
      .from('outbound_webhook_global_configs')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!webhookConfig) {
      console.log('Webhook not configured for tenant:', submission.tenant_id);
      return;
    }

    // Preparar payload
    const payload: Record<string, unknown> = {
      submission_id: submission.id,
      tenant_id: submission.tenant_id,
      tenant_name: submission.tenants?.name,
      student_data: submission.data as Record<string, unknown>,
      payment_amount: submission.payment_amount,
      payment_date: submission.payment_date,
    };

    // Enviar para n8n
    const response = await fetch(webhookConfig.enrollment_webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhookConfig.enrollment_webhook_token && {
          'Authorization': `Bearer ${webhookConfig.enrollment_webhook_token}`,
        }),
      },
      body: JSON.stringify(payload),
    });

    const success = response.ok;

    // Registrar log no padrão da tabela
    await supabase.from('enrollment_logs').insert({
      tenant_id: submission.tenant_id,
      submission_id: submission.id,
      status: success ? 'DONE' : 'FAILED',
      request_payload: payload,
      response_payload: {
        status: response.status,
        body: await response.text().catch(() => null),
      },
      attempt_count: 1,
      last_attempt_at: new Date().toISOString(),
      completed_at: success ? new Date().toISOString() : null,
    });

    console.log('Moodle enrollment webhook sent:', success ? 'SUCCESS' : 'FAILED');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error sending to Moodle:', message);
    
    // Registrar erro
    await supabase.from('enrollment_logs').insert({
      tenant_id: submission.tenant_id,
      submission_id: submission.id,
      status: 'FAILED',
      error_message: message || 'Unknown error',
      attempt_count: 1,
      last_attempt_at: new Date().toISOString(),
    });
  }
}
