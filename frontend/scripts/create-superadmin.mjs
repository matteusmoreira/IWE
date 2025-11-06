// Utilitário para criar um usuário superadmin no Supabase LOCAL usando Service Role
// Não expõe segredos: lê .env.local e mascara saídas.

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

function parseDotEnv(content) {
  const result = {}
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!m) continue
    const key = m[1]
    let val = m[2]
    // Strip optional quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    result[key] = val
  }
  return result
}

function mask(value) {
  if (!value) return ''
  if (value.length <= 8) return '*'.repeat(value.length)
  return value.slice(0, 4) + '...' + value.slice(-4)
}

async function main() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('Erro: .env.local não encontrado em', envPath)
    process.exit(1)
  }
  const env = parseDotEnv(fs.readFileSync(envPath, 'utf8'))
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    console.error('Erro: Variáveis NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local')
    process.exit(1)
  }

  // Parâmetros do superadmin padrão
  const email = process.env.SUPERADMIN_EMAIL || 'admin@iwe.com.br'
  const password = process.env.SUPERADMIN_PASSWORD || 'Admin@123'
  const name = process.env.SUPERADMIN_NAME || 'Super Admin'

  console.log('Conectando ao Supabase LOCAL: ', url)
  console.log('Service Role (mascarado): ', mask(serviceRoleKey))

  const adminClient = createClient(url, serviceRoleKey)

  // 1) Obter ou criar usuário no auth
  let authUserId = null
  {
    const { data: authCreate, error: authErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    })

    if (authErr) {
      console.warn('Aviso ao criar usuário no auth:', authErr.message)
      // Tentar localizar usuário já existente por email
      try {
        const { data: listUsers, error: listErr } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 })
        if (listErr) throw listErr
        const existing = listUsers?.users?.find((u) => u?.email?.toLowerCase() === email.toLowerCase())
        if (!existing) {
          console.error('Usuário não localizado no auth e criação falhou. Abortando.')
          process.exit(1)
        }
        authUserId = existing.id
      } catch (e) {
        console.error('Falha ao localizar usuário existente no auth:', e?.message)
        process.exit(1)
      }
    } else {
      authUserId = authCreate?.user?.id || null
    }
  }

  console.log('Usuário auth id:', mask(authUserId))

  // 2) Upsert na tabela public.users como superadmin (idempotente via email)
  const { data: userUpsert, error: userErr } = await adminClient
    .from('users')
    .upsert({
      auth_user_id: authUserId,
      email,
      name,
      role: 'superadmin',
      is_active: true
    }, { onConflict: 'email' })
    .select()
    .single()

  if (userErr) {
    console.error('Falha ao upsert na tabela users:', userErr.message)
    process.exit(1)
  }

  console.log('Superadmin garantido (upsert) com sucesso:')
  console.log('- users.id:', mask(userUpsert.id))
  console.log('- users.email:', email)
  console.log('- users.role:', userUpsert.role)
}

main().catch((e) => {
  console.error('Erro inesperado:', e?.message)
  process.exit(1)
})