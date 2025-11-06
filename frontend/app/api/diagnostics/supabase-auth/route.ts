import { NextRequest } from 'next/server'

// Pequeno diagnóstico para validar a ANON KEY do Supabase sem expor segredos.
// Faz um GET em /auth/v1/settings usando o apikey do ambiente e retorna apenas o status.
export async function GET(_req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    return Response.json(
      {
        ok: false,
        status: 500,
        error: 'Variáveis de ambiente ausentes: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY',
      },
      { status: 500 }
    )
  }

  try {
    const authSettingsUrl = `${url}/auth/v1/settings`
    const resp = await fetch(authSettingsUrl, {
      headers: {
        apikey: anon,
        'X-Client-Info': 'diagnostics',
      },
    })

    // Não retornamos o payload bruto para não vazar informações.
    return Response.json(
      {
        ok: resp.ok,
        status: resp.status,
        note: 'Se ok=false e status=401/403, normalmente a ANON KEY está inválida ou não corresponde ao projeto.',
      },
      { status: resp.ok ? 200 : 200 }
    )
  } catch (e: any) {
    return Response.json(
      {
        ok: false,
        status: 500,
        error: e?.message || 'Falha ao contatar Supabase Auth',
      },
      { status: 500 }
    )
  }
}