import { Resend } from 'resend';

// Cliente Resend único para o servidor. Não expor API Key em logs.
// A chave deve estar em RESEND_API_KEY (env do servidor).
const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  // Evitar crash em build: apenas warn. As rotas validarão em runtime.
  console.warn('[Resend] RESEND_API_KEY não configurada. Envio de e-mails ficará indisponível.');
}

export const resend = new Resend(apiKey ?? '');

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  bcc?: string[];
};

export async function sendEmail(input: SendEmailInput) {
  const from = process.env.RESEND_FROM;
  if (!from) {
    throw new Error('RESEND_FROM não configurado');
  }
  return resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    reply_to: input.replyTo,
    bcc: input.bcc,
  });
}