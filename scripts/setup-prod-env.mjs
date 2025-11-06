// Setup .env.local para usar PRODUÇÃO do Supabase sem expor segredos em logs.
// Lê valores de Supabase.txt no diretório raiz.
// Uso: chamado antes de iniciar o Next.js.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const supabaseTxtPath = path.resolve(rootDir, 'Supabase.txt');
const envLocalPath = path.resolve(rootDir, 'frontend', '.env.local');

function mask(value) {
  if (!value) return 'N/A';
  const len = value.length;
  if (len <= 10) return '**********';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function parseSupabaseData(text) {
  // URL direta do Supabase
  const urlMatch = text.match(/https?:\/\/[^\s]+\.supabase\.co/);
  // REF do projeto (ex.: bhbnkleaepzdjqgmbyhe)
  const refMatch = text.match(/ref["']?\s*[:=]\s*["']?([a-z0-9-]+)["']?/i);
  // Chave anon
  // Suporta: "anon:", "anon key:", "anon public:", "anon_public:" etc.
  const anonMatch = text.match(/anon(?:\s*(?:key|public))?\s*[:=]\s*([A-Za-z0-9._-]+)/i);
  // Service role (será usado somente no servidor)
  const serviceRoleMatch = text.match(/service\s*role\s*[:=]\s*([A-Za-z0-9._-]+)/i);

  const url = urlMatch ? urlMatch[0] : (refMatch ? `https://${refMatch[1]}.supabase.co` : null);
  const anonKey = anonMatch ? anonMatch[1] : null;
  const serviceRoleKey = serviceRoleMatch ? serviceRoleMatch[1] : null;

  return { url, anonKey, serviceRoleKey };
}

try {
  if (!fs.existsSync(supabaseTxtPath)) {
    console.warn(`[setup-prod-env] Supabase.txt não encontrado em: ${supabaseTxtPath}`);
    console.warn('[setup-prod-env] Criaremos .env.local com placeholders. Atualize manualmente depois.');
    const placeholder = [
      'NEXT_PUBLIC_SUPABASE_URL=https://<PROD_PROJECT_REF>.supabase.co',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY=**********',
      'NEXT_PUBLIC_APP_URL=http://localhost:3000',
      // NÃO expor no cliente; valor sem NEXT_PUBLIC
      '# SUPABASE_SERVICE_ROLE_KEY=**********',
      '',
    ].join('\n');
    fs.writeFileSync(envLocalPath, placeholder, { encoding: 'utf8' });
    console.log('[setup-prod-env] .env.local gerado com placeholders.');
    process.exit(0);
  }

  const text = fs.readFileSync(supabaseTxtPath, 'utf8');
  const { url, anonKey, serviceRoleKey } = parseSupabaseData(text);

  const lines = [];
  lines.push(`NEXT_PUBLIC_SUPABASE_URL=${url ?? 'https://<PROD_PROJECT_REF>.supabase.co'}`);
  lines.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey ?? '**********'}`);
  lines.push('NEXT_PUBLIC_APP_URL=http://localhost:3000');
  if (serviceRoleKey) {
    // USO EXCLUSIVO NO SERVIDOR; não é exposto ao cliente.
    lines.push(`SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`);
  } else {
    lines.push('# SUPABASE_SERVICE_ROLE_KEY=**********');
  }
  lines.push('');

  fs.writeFileSync(envLocalPath, lines.join('\n'), { encoding: 'utf8' });

  // Logs mascarados
  console.log('[setup-prod-env] .env.local atualizado para PRODUÇÃO.');
  console.log(`[setup-prod-env] URL: ${mask(url ?? 'N/A')}`);
  console.log(`[setup-prod-env] ANON: ${mask(anonKey ?? 'N/A')}`);
  if (serviceRoleKey) console.log(`[setup-prod-env] SERVICE_ROLE: ${mask(serviceRoleKey)}`);
  console.log('[setup-prod-env] Observação: SUPABASE_SERVICE_ROLE_KEY não é exposta ao cliente.');
} catch (err) {
  console.error('[setup-prod-env] Erro ao configurar .env.local:', err?.message || err);
  process.exit(1);
}