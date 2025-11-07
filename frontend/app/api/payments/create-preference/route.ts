import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAppUrl, getPreferenceClient } from '@/lib/mercadopago';

// Usamos o client ADMIN para bypass de RLS no backend.
// Isso evita 404 por "submissão não encontrada" quando a política RLS bloqueia leitura com chave ANON.
const supabase = createAdminClient();

// POST /api/payments/create-preference - Criar preferência de pagamento no Mercado Pago
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { submission_id } = body;

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

    // Pagamento global: usamos o token de ambiente (MP_ACCESS_TOKEN) e não mais configuração por tenant.
    // Validação antecipada para evitar erro genérico mais adiante.
    if (!process.env.MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN.trim() === '') {
      return NextResponse.json(
        { error: 'MP_ACCESS_TOKEN não configurado', reason: 'NO_GLOBAL_MP_TOKEN' },
        { status: 500 }
      );
    }

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
    } catch (e: any) {
      return NextResponse.json(
        { error: 'APP_URL/NEXT_PUBLIC_APP_URL não configurado', reason: 'APP_URL_NOT_CONFIGURED', detail: String(e?.message || e) },
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

    // Usar SDK oficial com token global
    const preferenceClient = getPreferenceClient();
    let mpData: any;
    try {
      const result = await preferenceClient.create({ body: preferencePayload as any });
      mpData = result;
    } catch (sdkError: any) {
      console.error('Mercado Pago error (SDK):', sdkError);
      const detail = sdkError?.message || sdkError?.error || String(sdkError);
      const meta = {
        status: sdkError?.status,
        code: sdkError?.code,
        blocked_by: sdkError?.blocked_by,
      };
      return NextResponse.json(
        { error: 'Erro ao criar preferência de pagamento', reason: 'MP_PREFERENCE_ERROR', detail, meta },
        { status: 500 }
      );
    }

    // Atualizar submission com referência de pagamento
    await supabase
      .from('submissions')
      .update({
        payment_reference: mpData.id,
        payment_external_id: mpData.id,
        metadata: {
          ...submission.metadata,
          mp_preference_id: mpData.id,
          mp_init_point: mpData.init_point,
        },
      })
      .eq('id', submission_id);

    // Retornar URL de checkout
    return NextResponse.json({
      success: true,
      preference_id: mpData.id,
      init_point: mpData.init_point, // URL para web
      sandbox_init_point: mpData.sandbox_init_point, // URL para sandbox
    });
  } catch (error: any) {
    console.error('Error creating payment preference:', error);
    return NextResponse.json(
      { error: 'Erro ao processar pagamento', reason: 'UNEXPECTED_ERROR', detail: String(error?.message || error) },
      { status: 500 }
    );
  }
}
