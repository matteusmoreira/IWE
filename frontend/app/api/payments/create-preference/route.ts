import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/payments/create-preference - Criar preferência de pagamento no Mercado Pago
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { submission_id } = body;

    if (!submission_id) {
      return NextResponse.json(
        { error: 'submission_id é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar submissão
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
          title,
          settings
        )
      `)
      .eq('id', submission_id)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: 'Submissão não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se já tem pagamento pendente
    if (submission.payment_status !== 'PENDENTE') {
      return NextResponse.json(
        { error: 'Esta submissão não está pendente de pagamento' },
        { status: 400 }
      );
    }

    // Buscar configuração do Mercado Pago do tenant
    const { data: mpConfig, error: configError } = await supabase
      .from('mercadopago_configs')
      .select('*')
      .eq('tenant_id', submission.tenant_id)
      .eq('is_active', true)
      .single();

    if (configError || !mpConfig) {
      return NextResponse.json(
        { error: 'Mercado Pago não configurado para este polo' },
        { status: 400 }
      );
    }

    // Preparar dados do pagamento
    const amount = submission.payment_amount || submission.form_definitions.settings?.payment_amount || 0;
    
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Valor do pagamento inválido' },
        { status: 400 }
      );
    }

    // Extrair informações do comprador dos dados do formulário
    const payerName = submission.data.nome || submission.data.name || 'Comprador';
    const payerEmail = submission.data.email || 'sem-email@example.com';
    const payerPhone = submission.data.telefone || submission.data.phone || '';

    // Criar preferência no Mercado Pago
    const preferenceData = {
      items: [
        {
          title: submission.form_definitions.title,
          description: `Inscrição - ${submission.tenants.name}`,
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
        success: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?submission_id=${submission_id}`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL}/payment/failure?submission_id=${submission_id}`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL}/payment/pending?submission_id=${submission_id}`,
      },
      auto_return: 'approved',
      external_reference: submission_id,
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
      statement_descriptor: submission.tenants.name.substring(0, 22),
    };

    // Fazer request para Mercado Pago
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mpConfig.access_token}`,
      },
      body: JSON.stringify(preferenceData),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Mercado Pago error:', mpData);
      return NextResponse.json(
        { error: 'Erro ao criar preferência de pagamento' },
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
      { error: 'Erro ao processar pagamento' },
      { status: 500 }
    );
  }
}
