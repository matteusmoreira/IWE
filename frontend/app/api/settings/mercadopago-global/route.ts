import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { maskToken } from '@/lib/mercadopago';

// GET /api/settings/mercadopago-global
// Retorna configuração global (sem expor tokens completos)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Papel do usuário
  const { data: roleRow } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  const role = roleRow?.role;
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: cfg } = await supabase
    .from('mercadopago_global_configs')
    .select('*')
    .eq('scope', 'global')
    .limit(1)
    .maybeSingle();

  if (!cfg) {
    return NextResponse.json({ config: null });
  }

  return NextResponse.json({
    config: {
      id: cfg.id,
      is_production: !!cfg.is_production,
      is_active: cfg.is_active !== false,
      masked_access_token: maskToken(cfg.access_token),
      masked_public_key: maskToken(cfg.public_key || ''),
      masked_webhook_secret: maskToken(cfg.webhook_secret || ''),
      updated_at: cfg.updated_at,
    }
  });
}

// POST /api/settings/mercadopago-global
// Upsert credenciais globais. Somente superadmin pode escrever.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: roleRow } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (roleRow?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { access_token, public_key, webhook_secret, is_production, is_active } = body;

  if (!access_token || typeof access_token !== 'string') {
    return NextResponse.json({ error: 'access_token is required' }, { status: 400 });
  }

  const { data: saved, error } = await supabase
    .from('mercadopago_global_configs')
    .upsert({
      scope: 'global',
      access_token,
      public_key: public_key || null,
      webhook_secret: webhook_secret || null,
      is_production: !!is_production,
      is_active: is_active !== false,
    }, { onConflict: 'scope' })
    .select()
    .single();

  if (error) {
    console.error('[MP Global] Erro ao salvar config:', error);
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: roleRow?.id ?? null,
    tenant_id: null,
    action: 'UPSERT',
    resource_type: 'mercadopago_global_config',
    resource_id: saved.id,
    changes: { updated_by_auth_user_id: user.id },
  });

  return NextResponse.json({ success: true, id: saved.id });
}