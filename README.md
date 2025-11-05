# 🎓 SaaS IWE - Plataforma de Educação Multi-tenant

Sistema completo de gestão de matrículas com integração Mercado Pago, WhatsApp (Evolution API) e Moodle (via n8n).

## 🏗️ Arquitetura

**Monorepo Structure:**
- `frontend/` - Next.js 14 + Tailwind CSS + shadcn/ui
- `backend/` - Supabase (PostgreSQL + Auth + Storage)
- `database/` - SQL migrations e schemas

## 🚀 Funcionalidades

✅ Multi-tenant (gestão de polos)  
✅ Formulário público personalizável  
✅ Checkout Mercado Pago integrado  
✅ WhatsApp automático via Evolution API  
✅ Integração Moodle via n8n  
✅ Dashboard moderno com dark mode  
✅ Gestão completa de alunos  
✅ Auditoria e logs  

## 🎨 Design System

**Cores da Marca IWE:**
- Primária: `#141B4D`
- Neutra: `#DBE2E9`
- Acento: `#E73C3E`

**Tipografia:** Montserrat

## ⚙️ Setup Inicial

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env.local` em cada workspace e preencha:

**Frontend (.env.local):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://bhbnkleaepzdjqgmbyhe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Backend:**
Supabase gerencia o backend automaticamente.

### 3. Executar migrations no Supabase

1. Acesse o Supabase Dashboard: https://app.supabase.com
2. Vá em **SQL Editor**
3. Execute os scripts em `database/migrations/` na ordem

### 4. Criar primeiro superadmin

Execute no SQL Editor do Supabase:

```sql
-- Criar superadmin inicial
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'admin@iwe.com.br',
  crypt('SenhaSegura123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Super Admin"}',
  now(),
  now()
);

-- Criar registro na tabela users
INSERT INTO users (email, name, role, is_active)
VALUES ('admin@iwe.com.br', 'Super Admin', 'superadmin', true);
```

### 5. Rodar o projeto

```bash
npm run dev
```

Acesse: http://localhost:3000

**Credenciais iniciais:**
- Email: `admin@iwe.com.br`
- Senha: `SenhaSegura123!`

## 📁 Estrutura de Pastas

```
saas-iwe/
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router
│   │   ├── components/       # Componentes React
│   │   ├── lib/              # Utilidades e configs
│   │   └── styles/           # CSS global
│   └── public/               # Assets estáticos
├── backend/
│   └── src/                  # Edge Functions (Supabase)
├── database/
│   ├── migrations/           # SQL migrations
│   └── seeds/                # Dados iniciais
└── docs/                     # Documentação
```

## 🔐 Papéis e Permissões

**Superadmin:**
- Gestão total de polos e admins
- Visualização global de métricas
- Auditoria completa

**Admin (Polo):**
- Gestão de formulários
- Configurações de integração
- Gestão de alunos do seu polo
- Templates WhatsApp

**Usuário (Aluno):**
- Preenchimento de formulário público
- Visualização de status de pagamento

## 🔗 Integrações

### Mercado Pago
Configure em: **Dashboard > Configurações > Pagamentos**
- Access Token
- Webhook URL: `https://seu-dominio.com/api/webhooks/mercadopago`

### Evolution API (WhatsApp)
Configure em: **Dashboard > Configurações > WhatsApp**
- Base URL
- Instance ID
- Token

### n8n (Moodle)
Configure em: **Dashboard > Configurações > Integrações**
- Webhook URL (endpoint do n8n)
- Token de autenticação

## 📖 Documentação da API

Swagger disponível em: `/api/docs` (após autenticação)

## 🧪 Testes

```bash
npm run test
```

## 🚢 Deploy

### Vercel (Frontend)
```bash
npm run build
vercel --prod
```

### Supabase (Backend)
Já está em produção automaticamente.

## 📝 Licença

© 2025 Instituto Palavra da Fé (IWE). Todos os direitos reservados.
