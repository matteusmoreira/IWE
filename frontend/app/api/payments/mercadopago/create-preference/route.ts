import { NextRequest } from 'next/server';
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

export async function POST(req: NextRequest) {
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

    const notification_url = `${appUrl}/api/payments/mercadopago/webhook`;

    const created = await preference.create({
      body: {
        items: [
          {
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
        auto_return: 'approved',
        binary_mode: true,
        notification_url,
      },
    });

    // Resposta simplificada para o client redirecionar
    return new Response(
      JSON.stringify({ id: created.id, init_point: (created as any).init_point ?? (created as any).sandbox_init_point }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[MP:create-preference] erro:', err?.message || err);
    return new Response(JSON.stringify({ error: 'Falha ao criar preferência' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}