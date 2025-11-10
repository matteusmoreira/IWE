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

// Retorna o próprio usuário autenticado (registro de public.users)
// Usa Service Role no backend para garantir leitura idempotente sem depender de RLS
export async function GET(req: Request) {
  try {
    // 1) Obter usuário via cookie; fallback para Authorization: Bearer <access_token>
    const supabase = await createClient()
    const {
      data: { user: cookieUser },
    } = await supabase.auth.getUser()

    let user = cookieUser as { id: string; email: string | null } | null
    if (!user) {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
      const bearer = authHeader?.startsWith('Bearer ')
        ? authHeader.substring('Bearer '.length)
        : undefined
      const claims = decodeJwt(bearer)
      if (claims?.sub) {
        user = { id: claims.sub!, email: claims.email ?? null }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }

    const admin = createAdminClient()

    // 2) Tentar localizar por auth_user_id primeiro
    let { data: userRow } = await admin
      .from('users')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    // 3) Fallback por email, se disponível
    if (!userRow && user.email) {
      const { data: byEmail, error: byEmailErr } = await admin
        .from('users')
        .select('*')
        .eq('email', user.email)
        .maybeSingle()

      if (byEmailErr) {
        return NextResponse.json({ error: byEmailErr.message }, { status: 500 })
      }
      if (byEmail) userRow = byEmail
    }

    if (!userRow) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
    }

    return NextResponse.json({ user: userRow })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unexpected_error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}