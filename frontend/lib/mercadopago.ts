// Biblioteca de inicialização do Mercado Pago (uso exclusivo em rotas server)
// Não use tokens em código client. Leia sempre de variáveis de ambiente.

import { MercadoPagoConfig, Preference } from 'mercadopago';

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

export function maskToken(token?: string): string {
  if (!token) return '**********';
  const visible = 6;
  return token.length > visible
    ? `${token.slice(0, visible)}***`
    : '**********';
}