import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function decodeJwt(token: string | undefined): { sub?: string; email?: string } {
  try {
    if (!token) return {}
    const parts = token.split('.')
    if (parts.length < 2) return {}
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
    return { sub: payload?.sub, email: payload?.email }
  } catch {
    return {}
  }
}

// Garante que exista um registro em public.users vinculado ao usuário autenticado.
// Usa Service Role no backend (NUNCA exposta ao cliente) para bypass de RLS quando necessário.
export async function POST(req: Request) {
  try {
    // Tentar obter user via cookie; se não vier, usar Authorization Bearer
    const supabase = await createClient()
    const {
      data: { user: cookieUser },
    } = await supabase.auth.getUser()

    // Normaliza usuário para evitar 'any' no acesso aos campos
    let user: { id: string; email: string | null; user_metadata?: Record<string, unknown> } | null =
      cookieUser ? { id: cookieUser.id, email: cookieUser.email, user_metadata: (cookieUser as unknown as { user_metadata?: Record<string, unknown> }).user_metadata } : null
    if (!user) {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
      const bearer = authHeader?.startsWith('Bearer ')
        ? authHeader.substring('Bearer '.length)
        : undefined
      const claims = decodeJwt(bearer)
      if (claims?.sub) {
        user = { id: claims.sub, email: claims.email ?? null }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Upsert idempotente por email: garante criação/atualização do vínculo auth_user_id
    const { data: ensured, error: upsertErr } = await admin
      .from('users')
      .upsert({
        auth_user_id: user.id,
        email: user.email!,
        // Extrai nome de forma segura a partir de metadados
        name:
          (typeof user.user_metadata?.name === 'string'
            ? (user.user_metadata?.name as string)
            : (user.email?.split('@')[0] ?? 'Usuário')),
        is_active: true,
      }, { onConflict: 'email' })
      .select()
      .single()

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: ensured.id })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unexpected_error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}