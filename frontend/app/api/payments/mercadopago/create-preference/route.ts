import { NextResponse } from 'next/server';
import { getPreferenceClient, getAppUrl } from '@/lib/mercadopago';

type CreatePreferenceBody = {
  title: string;
  quantity: number;
  unit_price: number; // BRL
  email: string;
  external_reference?: string;
};

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<CreatePreferenceBody>;
    if (!body) return badRequest('Body inválido');

    const title = body.title?.trim();
    const quantity = Number(body.quantity ?? 1);
    const unit_price = Number(body.unit_price ?? 0);
    const email = body.email?.trim();

    if (!title) return badRequest('title é obrigatório');
    if (!email || !email.includes('@')) return badRequest('email inválido');
    if (!Number.isFinite(quantity) || quantity <= 0) return badRequest('quantity deve ser > 0');
    if (!Number.isFinite(unit_price) || unit_price <= 0) return badRequest('unit_price deve ser > 0');

    const preference = getPreferenceClient();
    const appUrl = getAppUrl();

    const back_urls = {
      success: `${appUrl}/form/pagamento/sucesso`,
      failure: `${appUrl}/form/pagamento/falha`,
      pending: `${appUrl}/form/pagamento/pendente`,
    };
    // Alguns ambientes (localhost/http) podem causar erro 400 com auto_return.
    // Só definimos auto_return quando a URL for pública (https).
    const isHttpsPublic = appUrl.startsWith('https://');

    const notification_url = `${appUrl}/api/webhooks/mercadopago`;

    const created = await preference.create({
      body: {
        items: [
          {
            id: `ITEM-${Date.now()}`,
            title,
            quantity,
            unit_price,
            currency_id: 'BRL',
          },
        ],
        payer: {
          email,
        },
        external_reference: body.external_reference,
        back_urls,
        ...(isHttpsPublic ? { auto_return: 'approved' as const } : {}),
        binary_mode: true,
        notification_url,
      },
    });

    // Resposta simplificada para o client redirecionar
    const createdRec = created as Record<string, unknown>;
    const initPoint = typeof createdRec.init_point === 'string'
      ? createdRec.init_point
      : (typeof createdRec.sandbox_init_point === 'string' ? createdRec.sandbox_init_point : undefined);

    return NextResponse.json(
      { id: createdRec.id, init_point: initPoint },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error('[MP:create-preference] erro:', err);
    const detail = err instanceof Error ? err.message : String(err);
    const meta = typeof err === 'object' && err !== null
      ? {
          status: (err as Record<string, unknown>).status,
          code: (err as Record<string, unknown>).code,
          blocked_by: (err as Record<string, unknown>).blocked_by,
        }
      : {};
    return NextResponse.json(
      { error: 'Falha ao criar preferência', detail, meta },
      { status: 500 }
    );
  }
}