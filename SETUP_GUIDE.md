# 🚀 Guia Completo de Setup - SaaS IWE

Este guia descreve todos os passos necessários para configurar e rodar o sistema completo.

## 📋 Pré-requisitos

- Node.js 22.x ou superior
- Conta no Supabase (já configurada)
- Git

## 🔧 Passo 1: Instalar Dependências

```bash
cd "C:\Users\Matteus\Desktop\Saas IWE"

# Instalar dependências raiz
npm install

# Instalar dependências do frontend
cd frontend
npm install
cd ..
```

## 🗄️ Passo 2: Configurar o Banco de Dados

### 2.1 Acessar o Supabase

1. Acesse: https://app.supabase.com
2. Selecione seu projeto (bhbnkleaepzdjqgmbyhe)
3. Vá em **SQL Editor** no menu lateral

### 2.2 Executar Migrations

Execute os scripts SQL na seguinte ordem:

**Migration 001 - Schema Inicial:**
Copie e execute todo o conteúdo de: `database/migrations/001_initial_schema.sql`

**Migration 002 - Dados Iniciais:**
Copie e execute todo o conteúdo de: `database/migrations/002_seed_data.sql`

### 2.3 Criar Usuário Superadmin

Execute no SQL Editor:

```sql
-- 1. Criar usuário no auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@iwe.com.br',
  crypt('Admin@123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Super Admin"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
) RETURNING id;

-- 2. Copie o ID retornado acima e use na query abaixo:
-- ATENÇÃO: Substitua 'SEU-UUID-AQUI' pelo ID retornado acima
INSERT INTO users (auth_user_id, email, name, role, is_active)
VALUES (
  '9e53ba90-1be6-4634-b242-651a11ae3619',  -- <-- SUBSTITUIR AQUI
  'admin@iwe.com.br',
  'Super Admin',
  'superadmin',
  true
);
```

**Credenciais do Superadmin:**
- Email: `admin@iwe.com.br`
- Senha: `Admin@123`

## 🎨 Passo 3: Configurar Variáveis de Ambiente

Configure o arquivo `frontend/.env.local` (não commitar valores reais):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=**********
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Chave de Service Role (USO EXCLUSIVO NO SERVIDOR). Nunca expor no cliente.
SUPABASE_SERVICE_ROLE_KEY=**********
```

Notas:
- `SUPABASE_SERVICE_ROLE_KEY` é usada apenas em rotas server-side que exigem bypass de RLS (ex.: `/api/admins`, `/api/webhooks/*`).
- Nunca exponha a chave de Service Role no cliente nem em variáveis iniciadas com `NEXT_PUBLIC_`.
- Em produção, configure essas variáveis no ambiente de deploy (Vercel/Netlify) e mantenha logs com valores mascarados.

## 🚀 Passo 4: Iniciar o Servidor de Desenvolvimento

```bash
cd frontend
npm run dev
```

Acesse: **http://localhost:3000**

### 4.1 Iniciar Dev apontando para PRODUÇÃO

Para sempre subir o frontend local usando o banco de PRODUÇÃO do Supabase, usamos um script que lê os dados de produção do arquivo `Supabase.txt` na raiz e popula `frontend/.env.local` automaticamente (sem expor segredos). Execute:

```bash
cd frontend
npm run dev:prod
```

Formato esperado do arquivo `Supabase.txt` (exemplos):

```
url: https://<PROJECT_REF>.supabase.co
anon: <ANON_KEY>
service role: <SERVICE_ROLE_KEY>
```

Notas importantes:
- `service role` NUNCA é exposta ao cliente; é gravada em `.env.local` sem prefixo `NEXT_PUBLIC_` para uso exclusivo em rotas server-side.
- Não versionar `Supabase.txt` (já está no `.gitignore`).
- Garanta, no projeto de produção do Supabase, que `http://localhost:3000` está permitido em Auth > URL settings (site_url e additional_redirect_urls), senão o login local será bloqueado.

## 🔐 Passo 5: Fazer Login

1. Será redirecionado automaticamente para `/auth/login`
2. Use as credenciais do superadmin:
   - **Email:** `admin@iwe.com.br`
   - **Senha:** `Admin@123`

## 🏢 Passo 6: Criar um Polo (Tenant)

Após o login, você precisa criar polos. Como a interface ainda não está completa, use o SQL Editor:

```sql
INSERT INTO tenants (name, slug, status)
VALUES 
  ('Polo Teste', 'polo-teste', true);
```

## 📝 Passo 7: Criar um Admin para o Polo

```sql
-- 1. Criar usuário admin no auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin.polo@iwe.com.br',
  crypt('Admin@123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Admin Polo Teste"}',
  now(),
  now()
) RETURNING id;

-- 2. Criar registro na tabela users (substitua o UUID)
INSERT INTO users (auth_user_id, email, name, role, is_active)
VALUES (
  'UUID-DO-PASSO-1',  -- <-- SUBSTITUIR
  'admin.polo@iwe.com.br',
  'Admin Polo Teste',
  'admin',
  true
) RETURNING id;

-- 3. Vincular admin ao polo (substitua os UUIDs)
INSERT INTO admin_tenants (user_id, tenant_id)
VALUES (
  'UUID-DO-USER',      -- <-- ID da tabela users
  'UUID-DO-TENANT'     -- <-- ID do polo criado no Passo 6
);
```

## 📋 Próximos Passos

O sistema base está funcionando! Agora você pode:

### ✅ Funcionalidades Implementadas:
1. ✅ Autenticação completa
2. ✅ Dashboard com métricas
3. ✅ Modo escuro funcional
4. ✅ Layout responsivo com sidebar
5. ✅ Multi-tenant configurado (RLS)
6. ✅ Estrutura do banco completa

### 🚧 Funcionalidades a Implementar:

Para completar o sistema, você ainda precisará implementar:

1. **CRUD de Polos** (interface visual para criar/editar polos)
2. **CRUD de Admins** (gerenciar usuários admin)
3. **Form Builder** (criar formulários personalizados)
4. **Formulário Público** (endpoint para usuários preencherem)
5. **Integração Mercado Pago** (webhook + checkout)
6. **Integração Evolution API** (disparos WhatsApp)
7. **Integração n8n** (webhook para Moodle)
8. **Gestão de Submissions** (visualizar, filtrar, editar, CSV)
9. **Templates WhatsApp** (gerenciar templates)
10. **Auditoria** (logs de ações)

## 🔗 APIs REST Necessárias

### Você precisará criar estas rotas (Next.js API Routes):

```
frontend/app/api/
├── tenants/
│   ├── route.ts         # GET (listar), POST (criar)
│   └── [id]/
│       └── route.ts     # GET, PATCH, DELETE
├── forms/
│   ├── route.ts         # GET, POST
│   └── [id]/
│       └── route.ts     # GET, PATCH, DELETE
├── submissions/
│   ├── route.ts         # GET, POST
│   ├── [id]/
│   │   └── route.ts     # GET, PATCH, DELETE
│   └── export/
│       └── route.ts     # GET (exportar CSV)
├── webhooks/
│   ├── mercadopago/
│   │   └── route.ts     # POST (webhook MP)
│   └── enrollment/
│       └── route.ts     # POST (n8n)
└── whatsapp/
    ├── send/
    │   └── route.ts     # POST (enviar mensagem)
    └── templates/
        └── route.ts     # GET, POST
```

## 🐛 Troubleshooting

### Erro: "relation does not exist"
- Execute as migrations novamente na ordem correta

### Erro de autenticação
- Verifique se o usuário foi criado corretamente em `auth.users` e `users`
- Confirme que `auth_user_id` está correto

### Dark mode não funciona
- Verifique se `localStorage` está disponível
- Atualize a página após trocar o modo

### RLS Policy Errors
- Certifique-se de que o usuário logado tem a role correta
- Verifique as policies no Supabase Dashboard

## 📚 Documentação Adicional

- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **shadcn/ui:** https://ui.shadcn.com

## 🆘 Suporte

Para dúvidas ou problemas:
1. Verifique os logs do console (F12 no navegador)
2. Consulte a documentação do Supabase
3. Revise este guia completamente

---

**Status do Projeto:** ✅ Base funcional implementada | 🚧 Funcionalidades avançadas pendentes

**Desenvolvido com ❤️ para IWE - Instituto Palavra da Fé**
