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

    let user = cookieUser
    if (!user) {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
      const bearer = authHeader?.startsWith('Bearer ')
        ? authHeader.substring('Bearer '.length)
        : undefined
      const claims = decodeJwt(bearer)
      if (claims?.sub) {
        user = { id: claims.sub, email: claims.email ?? null } as any
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
        name: (user as any)?.user_metadata?.name ?? (user.email?.split('@')[0] ?? 'Usuário'),
        is_active: true,
      }, { onConflict: 'email' })
      .select()
      .single()

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: ensured.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unexpected_error' }, { status: 500 })
  }
}