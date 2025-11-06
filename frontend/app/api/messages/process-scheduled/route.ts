import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseTemplateVariables } from '@/lib/utils';
import { sendEmail } from '@/lib/resend';

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

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const now = new Date().toISOString();

    // RLS limita aos tenants do usuário automaticamente
    const { data: jobs, error } = await supabase
      .from('schedule_jobs')
      .select('*')
      .lte('scheduled_for', now)
      .eq('status', 'PENDING')
      .order('scheduled_for', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let processed = 0;
    for (const job of jobs || []) {
      const channel = job.metadata?.channel || 'whatsapp';
      try {
        if (channel === 'whatsapp') {
          // Buscar config WhatsApp
          const { data: whatsappConfig } = await supabase
            .from('whatsapp_configs')
            .select('*')
            .eq('tenant_id', job.tenant_id)
            .eq('is_active', true)
            .single();
          if (!whatsappConfig) throw new Error('WhatsApp não configurado');

          // Montar conteúdo
          let content = job.metadata?.message || '';
          let templateId: string | null = null;
          const templateKey = job.metadata?.template_key;
          if (templateKey) {
            const { data: template } = await supabase
              .from('message_templates')
              .select('*')
              .eq('tenant_id', job.tenant_id)
              .eq('key', templateKey)
              .eq('is_active', true)
              .single();
            if (!template) throw new Error('Template não encontrado');
            templateId = template.id;
            content = parseTemplateVariables(template.content, job.metadata?.variables || {});
          }
          if (!content) throw new Error('Conteúdo vazio');

          // Enviar para cada telefone do job
          for (const raw of job.recipient_phones || []) {
            const normalized = normalizePhone(String(raw));
            const resp = await fetch(`${whatsappConfig.api_base_url}/message/sendText/${whatsappConfig.instance_id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': whatsappConfig.token },
              body: JSON.stringify({ number: normalized, text: content }),
            });
            if (!resp.ok) {
              const errText = await resp.text().catch(() => '');
              await supabase.from('message_logs').insert({
                tenant_id: job.tenant_id,
                template_id: templateId,
                submission_id: null,
                recipient_phone: String(raw),
                message_content: content,
                status: 'FAILED',
                error_message: `Evolution API ${resp.status}: ${errText?.slice(0, 300)}`,
              });
            } else {
              await supabase.from('message_logs').insert({
                tenant_id: job.tenant_id,
                template_id: templateId,
                submission_id: null,
                recipient_phone: String(raw),
                message_content: content,
                status: 'SENT',
                sent_at: new Date().toISOString(),
              });
            }
          }
        } else if (channel === 'email') {
          // Montar email
          const to: string[] = job.metadata?.to || [];
          if (!to.length) throw new Error('Destinatários vazios');
          let subject: string = job.metadata?.subject || 'Mensagem';
          let html: string = job.metadata?.html || job.metadata?.message || '';
          const key = job.metadata?.template_key;
          if (key) {
            const { data: template } = await supabase
              .from('message_templates')
              .select('*')
              .eq('tenant_id', job.tenant_id)
              .eq('key', key)
              .eq('is_active', true)
              .single();
            if (template) {
              subject = template.title || subject;
              html = parseTemplateVariables(template.content, job.metadata?.variables || {});
            }
          }

          for (const email of to) {
            try {
              await sendEmail({ to: email, subject, html, replyTo: process.env.RESEND_REPLY_TO });
              await supabase.from('audit_logs').insert({
                tenant_id: job.tenant_id,
                action: 'CREATE',
                resource_type: 'email',
                resource_id: null,
                details: { message: 'Email agendado enviado', to: '***' },
              });
            } catch (e) {
              await supabase.from('audit_logs').insert({
                tenant_id: job.tenant_id,
                action: 'CREATE',
                resource_type: 'email',
                resource_id: null,
                details: { message: 'Email agendado falhou', to: '***', error: String(e).slice(0, 300) },
              });
            }
          }
        }

        // Atualiza job para EXECUTED
        await supabase
          .from('schedule_jobs')
          .update({ status: 'EXECUTED', executed_at: new Date().toISOString() })
          .eq('id', job.id);
        processed++;
      } catch (e) {
        // Marca como FAILED
        await supabase
          .from('schedule_jobs')
          .update({ status: 'FAILED', executed_at: new Date().toISOString(), metadata: { ...job.metadata, last_error: String(e).slice(0, 300) } })
          .eq('id', job.id);
      }
    }

    return NextResponse.json({ processed });
  } catch (error: any) {
    console.error('Process scheduled error:', error);
    return NextResponse.json({ error: 'Falha ao processar agendamentos' }, { status: 500 });
  }
}