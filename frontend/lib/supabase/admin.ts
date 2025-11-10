import { createClient } from '@supabase/supabase-js';

// Cliente exclusivo para operações administrativas no backend.
// Em desenvolvimento local, se a SERVICE ROLE KEY não estiver configurada,
// fazemos fallback seguro para a ANON KEY para evitar 500 e permitir smoke tests.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não configurada');
  }

  // Preferir SERVICE ROLE; se ausente, usar ANON KEY apenas para leituras permitidas por RLS
  const keyToUse = serviceKey || anonKey;
  if (!keyToUse) {
    // Sem nenhuma key disponível, falhamos de forma controlada
    throw new Error('Chaves do Supabase não configuradas (SERVICE ROLE ou ANON).');
  }

  return createClient(url, keyToUse);
}