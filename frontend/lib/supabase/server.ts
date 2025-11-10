import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/lib/supabase/client';

// Client para Server Components/App Router.
// Usa cookies do request atual sem executar cookies() manualmente.
// Evita erros de "contexto pages" e funciona em layouts/SSR.
export function createClient() {
  return createServerComponentClient<Database>({ cookies });
}