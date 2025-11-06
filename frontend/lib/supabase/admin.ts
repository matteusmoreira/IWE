import { createClient } from '@supabase/supabase-js';

// Cliente exclusivo para operações administrativas no backend.
// Usa a SERVICE ROLE KEY (NUNCA exposta ao cliente) para permitir chamadas a supabase.auth.admin
// e bypass de RLS quando necessário.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não configurada');
  }

  if (!serviceKey) {
    // Não mostramos segredo; apenas mensagem genérica.
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente. Configure a variável de ambiente no servidor.');
  }

  return createClient(url, serviceKey);
}