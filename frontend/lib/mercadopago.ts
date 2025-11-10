// Biblioteca de inicialização do Mercado Pago (uso exclusivo em rotas server)
// Não use tokens em código client. Leia sempre de variáveis de ambiente.

import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createAdminClient } from '@/lib/supabase/admin';

function getMandatoryEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`${name} não configurado. Defina em .env.local ou variáveis do ambiente de produção.`);
  }
  return value;
}

export function getAppUrl(): string {
  // Prefira APP_URL (server) e caia para NEXT_PUBLIC_APP_URL (client) somente se necessário
  const serverUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!serverUrl) {
    throw new Error('APP_URL/NEXT_PUBLIC_APP_URL não configurado.');
  }
  return serverUrl.replace(/\/$/, '');
}

export function getPreferenceClient(): Preference {
  const accessToken = getMandatoryEnv('MP_ACCESS_TOKEN');
  const client = new MercadoPagoConfig({ accessToken });
  return new Preference(client);
}

// Busca o access_token do Mercado Pago para um tenant específico na tabela mercadopago_configs.
// Retorna null se não houver configuração ativa para o tenant.
export async function getAccessTokenForTenant(tenantId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: cfg, error } = await admin
    .from('mercadopago_configs')
    .select('access_token, is_active')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[MP] Erro ao buscar configuração do tenant:', error.message);
  }

  if (!cfg) return null;
  if (cfg.is_active === false) return null;
  return cfg.access_token ?? null;
}

// Busca credenciais globais salvas no banco (escopo 'global').
export async function getGlobalAccessToken(): Promise<string | null> {
  const admin = createAdminClient();
  const { data: cfg, error } = await admin
    .from('mercadopago_global_configs')
    .select('access_token, is_active')
    .eq('scope', 'global')
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[MP] Erro ao buscar configuração global:', error.message);
  }
  if (!cfg) return null;
  if (cfg.is_active === false) return null;
  return cfg.access_token ?? null;
}

// Cria um client Preference priorizando credenciais globais; depois tenant; por fim variável de ambiente.
export async function getPreferenceClientForTenant(tenantId?: string): Promise<Preference> {
  let token: string | null = null;
  try {
    token = await getGlobalAccessToken();
  } catch {
    console.warn('[MP] Falha ao obter token global, tentando tenant/env');
  }
  if (!token && tenantId) {
    try {
      token = await getAccessTokenForTenant(tenantId);
    } catch {
      console.warn('[MP] Falha ao obter token do tenant, usando fallback de ambiente');
    }
  }
  const accessToken = token ?? getMandatoryEnv('MP_ACCESS_TOKEN');
  const client = new MercadoPagoConfig({ accessToken });
  return new Preference(client);
}

export function maskToken(token?: string): string {
  if (!token) return '**********';
  const visible = 6;
  return token.length > visible
    ? `${token.slice(0, visible)}***`
    : '**********';
}