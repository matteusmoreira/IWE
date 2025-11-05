import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/webhooks/mercadopago - Webhook do Mercado Pago
export async function POST(request: NextRequest) {
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
      .eq('external_id', paymentId)
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
        external_id: paymentId,
        provider: 'mercadopago',
        event_type: type,
        payload: body,
        status: 'PROCESSANDO',
      })
      .select()
      .single();

    // Processar de forma assíncrona (em produção, usar fila)
    processPaymentWebhook(paymentId, eventRecord?.id).catch(error => {
      console.error('Error processing payment webhook:', error);
    });

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
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
      if (eventId) {
        await supabase
          .from('payment_events')
          .update({ status: 'ERRO', error_message: 'Submission not found' })
          .eq('id', eventId);
      }
      return;
    }

    // Buscar config do Mercado Pago do tenant
    const { data: mpConfig } = await supabase
      .from('mercadopago_configs')
      .select('*')
      .eq('tenant_id', submission.tenant_id)
      .eq('is_active', true)
      .single();

    if (!mpConfig) {
      console.error('Mercado Pago config not found for tenant:', submission.tenant_id);
      
      if (eventId) {
        await supabase
          .from('payment_events')
          .update({ status: 'ERRO', error_message: 'MP config not found' })
          .eq('id', eventId);
      }
      return;
    }

    // Buscar detalhes do pagamento na API do Mercado Pago
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${mpConfig.access_token}`,
      },
    });

    const payment = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error('Error fetching payment from MP:', payment);
      
      if (eventId) {
        await supabase
          .from('payment_events')
          .update({ 
            status: 'ERRO', 
            error_message: 'Failed to fetch payment from MP',
            metadata: payment 
          })
          .eq('id', eventId);
      }
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
      
      if (eventId) {
        await supabase
          .from('payment_events')
          .update({ 
            status: 'ERRO', 
            error_message: updateError.message 
          })
          .eq('id', eventId);
      }
      return;
    }

    // Atualizar evento como processado
    if (eventId) {
      await supabase
        .from('payment_events')
        .update({ 
          status: 'PROCESSADO',
          metadata: payment,
          submission_id: submission.id,
        })
        .eq('id', eventId);
    }

    // Se pagamento aprovado, disparar ações automáticas
    if (payment.status === 'approved') {
      // 1. Enviar WhatsApp (se configurado)
      await sendWhatsAppNotification(submission);

      // 2. Enviar para n8n/Moodle (se configurado)
      await sendToMoodle(submission);
    }

    console.log('Payment webhook processed successfully:', paymentId);
  } catch (error) {
    console.error('Error in processPaymentWebhook:', error);
    
    if (eventId) {
      await supabase
        .from('payment_events')
        .update({ 
          status: 'ERRO', 
          error_message: error instanceof Error ? error.message : 'Unknown error' 
        })
        .eq('id', eventId);
    }
  }
}

// Função auxiliar para enviar WhatsApp
async function sendWhatsAppNotification(submission: any) {
  try {
    // Buscar configuração WhatsApp
    const { data: whatsappConfig } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .eq('tenant_id', submission.tenant_id)
      .eq('is_active', true)
      .single();

    if (!whatsappConfig) {
      console.log('WhatsApp not configured for tenant:', submission.tenant_id);
      return;
    }

    // Buscar template de confirmação de pagamento
    const { data: template } = await supabase
      .from('message_templates')
      .select('*')
      .eq('tenant_id', submission.tenant_id)
      .eq('event_type', 'PAYMENT_CONFIRMED')
      .eq('is_active', true)
      .single();

    if (!template) {
      console.log('No payment confirmation template found');
      return;
    }

    // Extrair número de telefone
    const phone = submission.data.telefone || submission.data.phone || '';
    if (!phone) {
      console.log('No phone number in submission');
      return;
    }

    // Preparar variáveis para o template
    const variables = {
      nome: submission.data.nome || submission.data.name || 'Aluno',
      polo: submission.tenants.name,
      valor: submission.payment_amount?.toFixed(2) || '0.00',
      ...submission.data,
    };

    // Substituir variáveis no template
    let message = template.content;
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    });

    // Enviar via Evolution API
    await fetch(`${whatsappConfig.api_url}/message/sendText/${whatsappConfig.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': whatsappConfig.api_key,
      },
      body: JSON.stringify({
        number: phone.replace(/\D/g, ''),
        text: message,
      }),
    });

    // Registrar log
    await supabase.from('message_logs').insert({
      tenant_id: submission.tenant_id,
      template_id: template.id,
      submission_id: submission.id,
      recipient_phone: phone,
      message_content: message,
      status: 'ENVIADO',
    });

    console.log('WhatsApp notification sent successfully');
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
  }
}

// Função auxiliar para enviar para Moodle via n8n
async function sendToMoodle(submission: any) {
  try {
    // Buscar configuração webhook
    const { data: webhookConfig } = await supabase
      .from('outbound_webhook_configs')
      .select('*')
      .eq('tenant_id', submission.tenant_id)
      .eq('is_active', true)
      .single();

    if (!webhookConfig) {
      console.log('Webhook not configured for tenant:', submission.tenant_id);
      return;
    }

    // Preparar payload
    const payload = {
      submission_id: submission.id,
      tenant_id: submission.tenant_id,
      tenant_name: submission.tenants.name,
      student_data: submission.data,
      payment_amount: submission.payment_amount,
      payment_date: submission.payment_date,
      form_title: submission.form_definitions?.title,
    };

    // Enviar para n8n
    const response = await fetch(webhookConfig.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhookConfig.auth_token && {
          'Authorization': `Bearer ${webhookConfig.auth_token}`,
        }),
      },
      body: JSON.stringify(payload),
    });

    const success = response.ok;

    // Registrar log
    await supabase.from('enrollment_logs').insert({
      tenant_id: submission.tenant_id,
      submission_id: submission.id,
      webhook_config_id: webhookConfig.id,
      payload: payload,
      response_status: response.status,
      response_body: await response.text().catch(() => null),
      success,
    });

    console.log('Moodle enrollment webhook sent:', success ? 'SUCCESS' : 'FAILED');
  } catch (error) {
    console.error('Error sending to Moodle:', error);
    
    // Registrar erro
    await supabase.from('enrollment_logs').insert({
      tenant_id: submission.tenant_id,
      submission_id: submission.id,
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
