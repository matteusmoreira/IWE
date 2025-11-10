import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAppUrl, getPreferenceClientForTenant, getAccessTokenForTenant, getGlobalAccessToken, maskToken } from '@/lib/mercadopago';

// GET /api/integration/mercadopago/status
// Checa rapidamente se as variáveis de ambiente estão configuradas e
// tenta criar uma preferência mínima para validar acesso ao Mercado Pago.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verificar papel do usuário: permitido para admin e superadmin
  const { data: roleRow } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  const role = roleRow?.role;
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Identificar tenant opcionalmente via query string
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenant_id') || undefined;

  // Admin só pode consultar tenants aos quais possui acesso
  if (tenantId && role === 'admin') {
    const { data: allowedTenants } = await supabase
      .from('tenants')
      .select('id');
    const allowedIds = (allowedTenants || []).map(t => t.id);
    if (!allowedIds.includes(tenantId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Coleta de token: global (banco) > tenant > ambiente
  const fromGlobal = await getGlobalAccessToken();
  const fromTenant = tenantId ? (await getAccessTokenForTenant(tenantId)) : null;
  const rawToken = fromGlobal ?? fromTenant ?? process.env.MP_ACCESS_TOKEN ?? '';
  const tokenMasked = maskToken(rawToken);

  let appUrl = '';
  let appUrlError: string | null = null;
  try {
    appUrl = getAppUrl();
  } catch (e: any) {
    appUrlError = String(e?.message || e);
  }

  const env = {
    app_url_configured: !!appUrl && !appUrlError,
    mp_token_configured: !!rawToken && rawToken.trim() !== '',
  };

  // Tentar criar uma preferência mínima para validar acesso ao MP
  let testPreference: any = null;
  try {
    const preference = await getPreferenceClientForTenant(tenantId);
    const back_urls = {
      success: `${appUrl}/form/pagamento/sucesso`,
      failure: `${appUrl}/form/pagamento/falha`,
      pending: `${appUrl}/form/pagamento/pendente`,
    };

    const isHttpsPublic = appUrl.startsWith('https://');
    const result = await preference.create({
      body: {
        items: [
          {
            title: 'Ping IWE',
            quantity: 1,
            unit_price: 1,
            currency_id: 'BRL',
          },
        ],
        payer: { email: 'teste@iwe.local' },
        external_reference: `status-check-${Date.now()}`,
        back_urls,
        ...(isHttpsPublic ? { auto_return: 'approved' as const } : {}),
        binary_mode: true,
        notification_url: `${appUrl}/api/webhooks/mercadopago`,
      },
    });

    testPreference = {
      success: true,
      id: (result as any)?.id,
      init_point: (result as any)?.init_point ?? (result as any)?.sandbox_init_point,
    };
  } catch (sdkError: any) {
    testPreference = {
      success: false,
      error: 'Erro ao criar preferência de teste',
      detail: sdkError?.message || sdkError?.error || String(sdkError),
      meta: {
        status: sdkError?.status,
        code: sdkError?.code,
        blocked_by: sdkError?.blocked_by,
      },
    };
  }

  return NextResponse.json({
    env,
    app_url: appUrl || null,
    app_url_error: appUrlError,
    mp_token_masked: tokenMasked,
    test_preference: testPreference,
    // Compatibilidade com UI atual
    has_app_url: env.app_url_configured,
    has_mp_access_token: env.mp_token_configured,
    masked_mp_access_token: tokenMasked,
    preference_test: testPreference,
  });
}