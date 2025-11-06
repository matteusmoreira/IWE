import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function fetchPayment(id: string) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN não configurado');
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao consultar pagamento ${id}: ${res.status} ${text}`);
  }
  return res.json();
}

function ok(payload?: any) {
  return new Response(JSON.stringify(payload ?? { ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const topic = params.get('topic') || params.get('type');
    const id = params.get('id') || params.get('data.id') || params.get('resource');
    if (!topic || !id) return badRequest('Parâmetros inválidos');
    if (topic !== 'payment') return ok({ ignored: true, topic });
    const payment = await fetchPayment(id);
    const admin = createAdminClient();
    const payload = {
      event_type: 'payment',
      mp_payment_id: String(payment?.id ?? id),
      mp_preference_id: payment?.order?.id ?? null,
      external_reference: payment?.external_reference ?? null,
      status: payment?.status ?? null,
      amount: payment?.transaction_amount ?? null,
      currency: payment?.currency_id ?? 'BRL',
      payer_email: payment?.payer?.email ?? null,
      payload: payment ?? {},
    };
    await admin.from('payment_events').insert(payload).then(() => {}).catch((e) => {
      console.error('[MP:webhook][GET] falha ao registrar evento:', e?.message || e);
    });
    console.log('[MP:webhook][GET] payment status:', payment?.status, 'id:', id);
    return ok({ status: payment?.status, id });
  } catch (err: any) {
    console.error('[MP:webhook][GET] erro:', err?.message || err);
    return ok(); // Responder 200 para evitar reenvio excessivo; analise logs para correções
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const topic = body?.topic || body?.type;
    const id = body?.data?.id || body?.id;
    if (!topic || !id) return badRequest('Body inválido');
    if (topic !== 'payment') return ok({ ignored: true, topic });
    const payment = await fetchPayment(String(id));
    const admin = createAdminClient();
    const payload = {
      event_type: 'payment',
      mp_payment_id: String(payment?.id ?? id),
      mp_preference_id: payment?.order?.id ?? null,
      external_reference: payment?.external_reference ?? null,
      status: payment?.status ?? null,
      amount: payment?.transaction_amount ?? null,
      currency: payment?.currency_id ?? 'BRL',
      payer_email: payment?.payer?.email ?? null,
      payload: payment ?? {},
    };
    await admin.from('payment_events').insert(payload).then(() => {}).catch((e) => {
      console.error('[MP:webhook][POST] falha ao registrar evento:', e?.message || e);
    });
    console.log('[MP:webhook][POST] payment status:', payment?.status, 'id:', id);
    return ok({ status: payment?.status, id });
  } catch (err: any) {
    console.error('[MP:webhook][POST] erro:', err?.message || err);
    return ok();
  }
}