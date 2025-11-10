import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAppUrl, getPreferenceClientForTenant } from '@/lib/mercadopago';

// Usamos o client ADMIN para bypass de RLS no backend.
// Isso evita 404 por "submissão não encontrada" quando a política RLS bloqueia leitura com chave ANON.
const supabase = createAdminClient();

// POST /api/payments/create-preference - Criar preferência de pagamento no Mercado Pago
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const submission_id = (typeof body.submission_id === 'string' || typeof body.submission_id === 'number')
      ? body.submission_id
      : null;

    if (!submission_id) {
      return NextResponse.json(
        { error: 'submission_id é obrigatório', reason: 'MISSING_SUBMISSION_ID' },
        { status: 400 }
      );
    }

    // Buscar submissão (bypass RLS com Service Role)
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select(`
        *,
        tenants (
          id,
          name,
          slug
        ),
        form_definitions (
          id,
          name,
          settings
        )
      `)
      .eq('id', submission_id)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: 'Submissão não encontrada', reason: 'SUBMISSION_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verificar se já tem pagamento pendente
    if (submission.payment_status !== 'PENDENTE') {
      return NextResponse.json(
        { error: 'Esta submissão não está pendente de pagamento', reason: 'NOT_PENDING' },
        { status: 400 }
      );
    }

    // Agora usamos credenciais por tenant quando disponíveis, com fallback para variável de ambiente.

    // Preparar dados do pagamento
    const amount = submission.payment_amount || submission.form_definitions.settings?.payment_amount || 0;
    
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Valor do pagamento inválido', reason: 'INVALID_AMOUNT' },
        { status: 400 }
      );
    }

    // Extrair informações do comprador dos dados do formulário
    const payerName = submission.data.nome || submission.data.name || 'Comprador';
    const payerEmail = submission.data.email || 'sem-email@example.com';
    const payerPhone = submission.data.telefone || submission.data.phone || '';

    // Criar preferência no Mercado Pago (global)
    // Base URL da aplicação (preferir APP_URL do servidor; cair para NEXT_PUBLIC_APP_URL se necessário)
    let appUrl: string;
    try {
      appUrl = getAppUrl();
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: 'APP_URL/NEXT_PUBLIC_APP_URL não configurado', reason: 'APP_URL_NOT_CONFIGURED', detail },
        { status: 500 }
      );
    }

    const descriptor = (process.env.MP_STATEMENT_DESCRIPTOR || 'IWE').substring(0, 22);
    const isHttpsPublic = appUrl.startsWith('https://');
    const preferencePayload = {
      items: [
        {
          title: submission.form_definitions.name,
          description: `Inscrição`,
          quantity: 1,
          unit_price: amount,
          currency_id: 'BRL',
        },
      ],
      payer: {
        name: payerName,
        email: payerEmail,
        phone: {
          number: payerPhone.replace(/\D/g, ''),
        },
      },
      back_urls: {
        success: `${appUrl}/form/pagamento/sucesso?submission_id=${submission_id}`,
        failure: `${appUrl}/form/pagamento/falha?submission_id=${submission_id}`,
        pending: `${appUrl}/form/pagamento/pendente?submission_id=${submission_id}`,
      },
      // Evitar erro 400 em ambientes locais com http
      ...(isHttpsPublic ? { auto_return: 'approved' as const } : {}),
      external_reference: submission_id,
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
      statement_descriptor: descriptor,
      binary_mode: true,
    };

    // Usar SDK oficial com token do tenant quando disponível
    const preferenceClient = await getPreferenceClientForTenant((submission as Record<string, unknown>)?.tenants?.id);
    let mpData: Record<string, unknown>;
    try {
      const result = await preferenceClient.create({ body: preferencePayload as Record<string, unknown> });
      mpData = result as Record<string, unknown>;
    } catch (sdkError: unknown) {
      console.error('Mercado Pago error (SDK):', sdkError);
      const detail = sdkError instanceof Error ? sdkError.message : String(sdkError);
      const meta = typeof sdkError === 'object' && sdkError !== null
        ? {
            status: (sdkError as Record<string, unknown>).status,
            code: (sdkError as Record<string, unknown>).code,
            blocked_by: (sdkError as Record<string, unknown>).blocked_by,
          }
        : {};
      return NextResponse.json(
        { error: 'Erro ao criar preferência de pagamento', reason: 'MP_PREFERENCE_ERROR', detail, meta },
        { status: 500 }
      );
    }

    // Atualizar submission com referência de pagamento
    const mpId = (mpData.id as string | number | undefined) ?? null;
    const initPoint = (mpData.init_point as string | undefined) ?? null;
    const sandboxInitPoint = (mpData.sandbox_init_point as string | undefined) ?? null;

    await supabase
      .from('submissions')
      .update({
        payment_reference: mpId,
        payment_external_id: mpId,
        metadata: {
          ...submission.metadata,
          mp_preference_id: mpId,
          mp_init_point: initPoint,
        },
      })
      .eq('id', submission_id);

    // Retornar URL de checkout
    return NextResponse.json({
      success: true,
      preference_id: mpId,
      init_point: initPoint, // URL para web
      sandbox_init_point: sandboxInitPoint, // URL para sandbox
    });
  } catch (error: unknown) {
    console.error('Error creating payment preference:', error);
    return NextResponse.json(
      { error: 'Erro ao processar pagamento', reason: 'UNEXPECTED_ERROR', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
