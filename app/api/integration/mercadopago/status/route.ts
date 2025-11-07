import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPreferenceClient, getAppUrl, maskToken } from '@/lib/mercadopago'

// Verifica status da integração com Mercado Pago
// - Retorna token mascarado
// - Valida variáveis de ambiente essenciais
// - Executa um ping criando uma preferência de teste (binary_mode)
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }

    // Papel do usuário
    const { data: roleRow } = await supabase
      .from('users')
      .select('role')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    const role = roleRow?.role ?? 'user'
    if (role !== 'admin' && role !== 'superadmin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const accessToken = process.env.MP_ACCESS_TOKEN
    const appUrlServer = process.env.APP_URL
    const appUrlClient = process.env.NEXT_PUBLIC_APP_URL

    const env = {
      accessTokenConfigured: !!accessToken,
      tokenMasked: maskToken(accessToken),
      appUrlConfigured: !!(appUrlServer || appUrlClient),
      appUrl: (appUrlServer || appUrlClient) || null,
    }

    let test: any = { ok: false }

    // Se variáveis essenciais não estiverem configuradas, retornar mais cedo
    if (!env.accessTokenConfigured) {
      return NextResponse.json({ env, test: { ok: false, error: 'MP_ACCESS_TOKEN ausente' }, timestamp: new Date().toISOString() })
    }
    if (!env.appUrlConfigured) {
      return NextResponse.json({ env, test: { ok: false, error: 'APP_URL/NEXT_PUBLIC_APP_URL ausente' }, timestamp: new Date().toISOString() })
    }

    // Tenta criar uma preferência de teste
    try {
      const preference = getPreferenceClient()
      const appUrl = getAppUrl()

      const payload = {
        items: [
          { title: 'Integração - Teste', quantity: 1, unit_price: 1, currency_id: 'BRL' },
        ],
        payer: {
          email: 'test_user@example.com',
        },
        external_reference: 'integration-status-test',
        back_urls: {
          success: `${appUrl}/payments/test/success`,
          failure: `${appUrl}/payments/test/failure`,
          pending: `${appUrl}/payments/test/pending`,
        },
        notification_url: `${appUrl}/api/webhooks/mercadopago`,
        binary_mode: true,
        metadata: { source: 'integration-status' },
      }
      const result = await preference.create(payload as any)

      test = {
        ok: true,
        preference_id: result?.id ?? null,
        init_point: result?.init_point ?? null,
      }
    } catch (e: any) {
      // Captura erros comuns do SDK: status, message, cause, code
      test = {
        ok: false,
        error: e?.message ?? 'Erro ao criar preferência de teste',
        status: e?.status ?? null,
        code: e?.code ?? null,
        cause: e?.cause ?? null,
      }
    }

    return NextResponse.json({ env, test, timestamp: new Date().toISOString() })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unexpected_error' }, { status: 500 })
  }
}