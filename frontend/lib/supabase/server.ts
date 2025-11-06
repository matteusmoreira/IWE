import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/lib/supabase/client';

// Helper para rotas de API usando cookies de sessão (compatível com Next 15)
// Evita chamada direta ao cookies() síncrono dentro da lib passando um cookieStore já resolvido
export async function createClient() {
  const cookieStore = await cookies();
  return createRouteHandlerClient<Database>({ cookies: () => cookieStore });
}