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
✅ Máscaras e validações: telefone, CPF (algoritmo), CEP com auto-preenchimento de endereço  

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
# Opcional e apenas no servidor (não expor ao cliente!). Necessário para rotas administrativas e webhooks.
SUPABASE_SERVICE_ROLE_KEY=********************************
```

**Backend:**
Supabase gerencia o backend automaticamente. Não exponha segredos no repositório; use variáveis de ambiente (por exemplo, `SUPABASE_URL`, `SUPABASE_ANON_KEY`) e mantenha valores mascarados em logs e documentos.

Notas de segurança sobre Service Role:
- O SUPABASE_SERVICE_ROLE_KEY concede acesso sem RLS. Use apenas em rotas server-side (ex.: `frontend/app/api/admins` e `frontend/app/api/webhooks/*`).
- Nunca disponibilize essa chave no bundle do cliente nem em variáveis que comecem com `NEXT_PUBLIC_`.
- No repositório, utilize placeholders mascarados e instruções no README/SETUP_GUIDE. Os valores reais devem estar apenas em `.env.local` e em variáveis do ambiente de deploy.

### 3. Migrações (unificadas)

As migrações oficiais agora residem em `supabase/migrations/`. O diretório legado `database/migrations/` foi arquivado em `database/migrations_archived_2025-11-05/`.

Opções de aplicação:
- Remoto (SQL Editor): copie e execute os arquivos de `supabase/migrations/` na ordem.
- Local (CLI):
  - Requer Docker Desktop.
  - Comando de validação do schema (dump): `supabase db dump --schema public > supabase/schema_public.sql` e `supabase db dump --schema storage > supabase/schema_storage.sql`.
  - Para subir migrações no ambiente local: `supabase start` e `supabase migration up`.

#### Correção: enum `field_type` (CEP/CPF/Radio)
- Problema: erro `invalid input value for enum field_type: "cep"` ao criar campos.
- Solução: aplicar a migração `supabase/migrations/20251106130008_field_type_add_cpf_cep_radio.sql`.
- Passos:
  1) Execute a migração no Supabase (SQL Editor) ou via CLI.
  2) Gere dumps atualizados:
     - `supabase db dump --schema public > supabase/schema_public.sql`
     - `supabase db dump --schema storage > supabase/schema_storage.sql`
  3) Reinicie o servidor (`npm run dev`) e valide a criação de formulário com campo `cep`.

#### Correção: normalização de opções (strings → objetos)
- Problema: opções de `select/radio/checkbox` salvas como strings faziam a UI não exibir o texto (`option.label`).
- Solução: aplicar a migração `supabase/migrations/20251107170013_field_options_normalization.sql`, que converte todas as opções para o formato `{ label, value }` e cria a função `slugify_label` para gerar valores limpos.
- Passos:
  1) Execute a migração no Supabase (SQL Editor) ou via CLI:
     - CLI local: `supabase start && supabase migration up`
  2) Consultas de verificação (opcionais):
     - `SELECT count(*) FROM form_fields WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(options) e WHERE jsonb_typeof(e) = 'string');`
     - `SELECT id, type, options FROM form_fields WHERE type IN ('select','radio','checkbox') LIMIT 10;`
  3) Reinicie o servidor (`npm run dev`) e valide os formulários públicos. As opções devem aparecer corretamente.


### 2.4 E-mails transacionais (Resend)

Para habilitar envio de e-mails transacionais, configure as variáveis no `frontend/.env.local` (não commitar valores reais):

```env
# -- Resend (E-mail) --
# API Key (APENAS NO SERVIDOR). NÃO exponha no cliente ou logs.
RESEND_API_KEY=**********
# Remetente padrão de e-mails (domínio verificado no Resend)
RESEND_FROM=no-reply@seu-dominio.com.br
# Opcional: reply-to padrão
RESEND_REPLY_TO=atendimento@seu-dominio.com.br
```

Notas:
- Verifique o domínio no Resend (SPF/DKIM) e use um endereço de remetente do domínio verificado.
- Nunca exponha `RESEND_API_KEY` no cliente. Utilize apenas em rotas server-side.
- Logs e auditorias devem mascarar endereços sensíveis; não gravar tokens.

Uso da API interna (Next.js):
- `POST /api/emails/send` — Envia e-mail via Resend com HTML custom ou usando um template de `message_templates`.
  - Body:
    - `tenant_id` (string, obrigatório)
    - `to` (string | string[], obrigatório)
    - `subject` (string) e `html` (string), ou `template_key` (string)
    - `variables` (objeto) — placeholders `{{variavel}}` do template
    - `submission_id` (string, opcional) — enriquece variáveis com dados da submissão
    - `reply_to` (string, opcional) e `bcc` (string[], opcional)
- Autenticação: sessão válida; o usuário deve ser admin do `tenant_id`.
- Documentação do contrato: `docs/openapi.yaml`.


### 4. Usuário inicial

Use usuários de teste definidos em seeds/fixtures. Não publique credenciais reais em documentos. Consulte os seeds em `supabase/migrations/20251105120003_seed_data.sql`.

### 5. Rodar o projeto

```bash
npm run dev
```

Acesse: http://localhost:3000

Observação: não publique credenciais em arquivos de documentação. Utilize variáveis de ambiente e usuários de teste definidos em seeds.

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
├── supabase/
│   ├── migrations/           # Migrações oficiais (fonte única de verdade)
│   ├── schema_public.sql     # Dump automatizado do schema public
│   └── schema_storage.sql    # Dump automatizado do schema storage
└── docs/                     # Documentação (ADR, OpenAPI, Checklist de Segurança)

## ✅ Validação automática do schema

Para validar que o schema esperado está presente, execute:

```bash
node scripts/validate-schema.js
```

O script verifica tabelas-chave (`tenants`, `submissions`, `message_templates`, `file_uploads`), funções (`is_admin_of_tenant`, `get_file_url`), a view `dashboard_metrics`, RLS habilitado e políticas de Storage para o bucket `form-submissions`.

## 🔐 Segurança

- Nunca exponha tokens/segredos em arquivos públicos. Use variáveis de ambiente.
- RLS habilitado nas tabelas sensíveis.
- Políticas de acesso ao Storage limitadas ao bucket `form-submissions` e ao tenant do usuário.
- Chamadas externas (ViaCEP) são realizadas no cliente, sem segredos; erros são silenciosos e a submissão não depende do auto-preenchimento.

## 🧭 Documentação complementar

- ADR: `docs/ADR-001-unificacao-migracoes.md`
- OpenAPI: `docs/openapi.yaml`
- ADR: `docs/ADR-005-email-resend.md`
- Checklist de Segurança: `docs/SECURITY_CHECKLIST.md`
- Deploy na Vercel: `docs/DEPLOY-VERCEL.md`

## 📊 Atualização do Dashboard (Nov/2025)

Simplificamos temporariamente o Dashboard para focar no indicador crítico "Total de Inscrições" com filtro mensal:

- Mantido apenas o card "Total de Inscrições".
- Filtro por mês/ano e tenant disponíveis no topo.
- Endpoint atualizado para refletir filtro mensal: `GET /api/metrics` (Next.js API). Contrato documentado em `docs/openapi.yaml`.

Arquivos alterados:
- `frontend/app/dashboard/page.tsx` — UI do Dashboard (filtro mensal e card único).
- `frontend/app/api/metrics/route.ts` — Cálculo de métricas usando `public.submissions`.

Motivação:
- Reduzir ruído visual na fase inicial e garantir confiabilidade da métrica principal.
- Validar filtro mensal com RLS e papéis de usuário.

Rollback:
- Reverter alterações nos arquivos acima (ou restaurar branch anterior) para reexibir os demais cartões e gráficos.

Notas:
- Nenhum segredo exposto. Todas as credenciais continuam em variáveis de ambiente e só no servidor.
 - Acessibilidade: os filtros (Mês, Ano, Polo) receberam estilos consistentes no modo escuro (`bg-card` + `text-foreground`) para garantir contraste adequado.

## 🔗 URLs curtas de Formulários e Redirecionamento

Para facilitar o compartilhamento, formulários públicos podem ter `slug` opcional. Quando presente:
- A URL curta é acessível em `/f/[slug]`.
- A página `/form/[id]` redireciona automaticamente para a rota curta.
- No Dashboard (Lista de Formulários), a ação "Copiar link público" usa a URL curta; o link curto também é exibido abaixo do título.

Contratos de API (OpenAPI):
- `GET /api/public/forms/{id}` — agora inclui `slug` no payload quando disponível.
- `GET /api/public/forms/by-slug/{slug}` — retorna o mesmo payload da consulta por ID.

Aceitação (Given–When–Then):
- Given um formulário com `slug="matricula-2025"`, When o usuário acessa `/form/<ID_DO_FORM>`, Then ocorre redirecionamento 302 para `/f/matricula-2025`.
- Given a lista em `/dashboard/forms`, When o usuário clica em "Copiar link público" de um formulário com slug, Then `https://localhost:3000/f/matricula-2025` é copiado para a área de transferência.
- Given `GET /api/public/forms/{id}`, When o formulário possui slug, Then a resposta contém o campo `slug` (string).

Definição de Pronto (DoD):
- Testes automatizados verdes (unit e integração) para redirecionamento, cópia de URL curta e inclusão do slug na API.
- Documentação atualizada: `docs/openapi.yaml` e ADR específico.
- Checklist de segurança revisado (sem exposição de segredos; uso de variáveis de ambiente).

Rollback:
- Remover o redirecionamento em `frontend/app/form/[id]/page.tsx` e reverter a função de copiar em `frontend/app/dashboard/forms/page.tsx` para usar `/form/[id]`.
- Retirar o campo `slug` do schema `PublicFormDefinition` em `docs/openapi.yaml` e a rota por slug.

## 🖼️ Assets e Logo IWE

- O arquivo da logo fica em `frontend/public/logo.png` e é servido estaticamente em `/logo.png`.
- Componente reutilizável disponível em `frontend/components/ui/logo.tsx`:

```tsx
import Logo from '@/components/ui/logo';

// Exemplo de uso no login
<Logo size="lg" />

// Exemplo de uso no sidebar
<Logo size="md" />
```

Aceitação (Given–When–Then):
- Given o servidor rodando em `http://localhost:3000`, When o usuário acessa `/auth/login`, Then a logo de arquivo `/logo.png` é exibida acima do formulário.
- Given um usuário autenticado acessando `/dashboard`, When o menu lateral é renderizado, Then a logo `/logo.png` aparece no topo ao lado do título "IWE System".

## 🛠️ Troubleshooting: "User not found" após login

Sintoma: após credenciais válidas, a UI exibe erro "User not found" e/ou rotas internas retornam 404/403.

Possíveis causas e correções:
- Variáveis de ambiente ausentes no frontend:
  - Verifique `frontend/.env.local` e preencha:
    - `NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT>.supabase.co`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY=***` (chave pública)
    - `SUPABASE_SERVICE_ROLE_KEY=***` (apenas servidor; não usar no cliente)
  - Reinicie o servidor (`npm run dev`). NUNCA publique valores reais no repositório; use placeholders mascarados.
- Usuário não registrado na tabela `public.users`:
  - A rota `POST /api/users/ensure` registra/atualiza o usuário autenticado. Ela exige sessão válida (cookies) e Service Role no servidor.
  - Teste no navegador: faça login e aguarde redirecionamento; a UI dispara `/api/users/ensure` e depois `/api/users/me`.
- Políticas RLS impedindo leitura do próprio registro:
  - As migrações adicionam a policy "Users can read own user record" em `public.users` e policies de leitura em `public.admin_tenants`. Confirme que estão aplicadas no seu projeto Supabase.

Passos mínimos de verificação (pós-login):
1) `/api/users/ensure` responde 200.
2) `/api/users/me` responde 200 e retorna `role` e `status` do usuário.
3) `/api/tenants` responde 200 (para superadmin: lista global; para admin: apenas polos administrados). Caso contrário, verifique RLS e vínculos em `admin_tenants`.
4) `/api/forms` responde 200 (superadmin: todos; admin: do(s) polo(s) e globais).

Checklist de segurança:
- Nenhum segredo em logs/console; usar variáveis de ambiente.
- Service Role só no servidor (rotas em `frontend/app/api/*`).
- RLS habilitada e policies presentes.

Acceptance Criteria (Given–When–Then) — Login e Dashboard:
- Given um usuário com e-mail e senha válidos, When clica "Entrar" na página `/auth/login`, Then a aplicação realiza login no Supabase, registra/atualiza o usuário em `/api/users/ensure` e navega para `/dashboard`.
- Given um usuário válido sem registro prévio em `public.users`, When conclui login, Then `/api/users/ensure` cria o registro (`auth_user_id`, `email`, `role='user'`) e `/api/users/me` retorna 200 com os dados do usuário.
- Given um usuário com papel `superadmin`, When acessa `/dashboard/tenants`, Then vê todos os polos e consegue criar novo polo via `POST /api/tenants`.
- Given um usuário com papel `admin` vinculado a polos, When acessa `/dashboard/tenants`, Then vê apenas os polos vinculados e não pode criar novos (botões ocultos; API responde 403 em tentativas diretas).
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

## 🧾 Máscaras e Validações de Formulário (Público)

Implementações atuais na página pública do formulário (`frontend/app/form/[id]/page.tsx`):

- Telefone: máscara fixa `(##) #####-####` e validação de 11 dígitos.
- CPF: máscara `###.###.###-##` e validação algorítmica dos dígitos verificadores.
- CEP: máscara `#####-###` e, ao completar 8 dígitos, consulta automática ao ViaCEP para preencher campos de endereço se existirem no formulário (ex.: `logradouro`/`endereco`, `bairro`, `cidade`/`localidade`, `estado`/`uf`).

Acceptance Criteria (Given–When–Then):
- Given um campo do tipo `phone`, When o usuário digita 11 dígitos, Then o valor é exibido como `(99) 99999-9999` e a validação exige 11 dígitos.
- Given um campo do tipo `cpf`, When o usuário finaliza 11 dígitos, Then o valor é exibido como `999.999.999-99` e a validação rejeita CPFs com dígitos verificadores incorretos.
- Given um campo do tipo `cep`, When o usuário insere 8 dígitos válidos, Then o campo é formatado `99999-999` e, se o formulário possuir campos de endereço, eles são preenchidos automaticamente via ViaCEP.

Notas:
- Nenhum segredo é usado para ViaCEP; se a consulta falhar, a submissão do formulário continua funcionando e o usuário pode preencher manualmente.
- Os nomes de campos de endereço são detectados por convenção; se não existirem, nada é alterado.
- Templates WhatsApp

**Usuário (Aluno):**
- Preenchimento de formulário público
- Visualização de status de pagamento

### RBAC de Polos (Tenants)
- Apenas `superadmin` pode criar, editar e excluir polos.
- Usuários com papel `admin` têm acesso somente de leitura aos polos que gerenciam (via `admin_tenants`).
- UI do Dashboard respeita RBAC: a página `frontend/app/dashboard/tenants/page.tsx` oculta botões de "Novo Polo", "Editar" e "Excluir" quando `role !== 'superadmin'`, e remove a coluna "Ações" para admins.
- Backend: rotas `POST /api/tenants`, `PATCH /api/tenants/{id}` e `DELETE /api/tenants/{id}` exigem `superadmin` (ver `frontend/app/api/tenants/*`).
- Banco: políticas RLS em `tenants` permitem `FOR ALL` apenas para `superadmin` (ver `supabase/migrations/20251105120001_initial_schema.sql`).

Acceptance Criteria (Given–When–Then):
- Given um usuário com papel admin, When acessa `/dashboard/tenants`, Then não vê os botões de "Novo Polo", "Editar" e "Excluir", e a coluna "Ações" não aparece.
- Given um usuário com papel admin, When tenta criar/editar/excluir polo via ação direta, Then o frontend bloqueia com toast e a API responde `403`.
- Given um usuário com papel superadmin, When acessa `/dashboard/tenants`, Then vê e consegue usar "Novo Polo", "Editar" e "Excluir".
- Given RLS ativa em `tenants`, When um usuário não-superadmin tenta `POST/PATCH/DELETE` diretamente no banco, Then a operação é negada.

## 🔗 Integrações

## 🧩 Formulários: Globais vs. por Polo

Comportamento atualizado para suportar formulários globais (sem vínculo de polo) e formulários vinculados a um polo específico:

- Criação:
  - Admin: deve selecionar um polo (tenant_id) ao criar; não pode criar formulário global.
  - Superadmin: pode criar formulário global (omitindo tenant_id) ou vincular a um polo específico.
- Edição:
  - Admin: pode editar apenas formulários do(s) polo(s) que administra; não pode alterar tenant_id.
  - Superadmin: pode alterar o tenant_id (incluindo definir nulo para tornar global).
- Listagem:
  - Admin: vê formulários do(s) polo(s) que administra e também formulários globais; quando não houver vínculo, exibe “— sem polo —”.
  - Superadmin: vê todos os formulários.
- Submissão Pública:
  - Formulário vinculado (tenant_id não nulo): `tenant_id` no payload é opcional; se informado, deve coincidir com o do formulário.
  - Formulário global (tenant_id nulo): `tenant_id` no payload é obrigatório e o polo deve estar ativo.

Checklist de segurança e configuração:
- `tenant_id` em `form_definitions` agora é opcional (migração `supabase/migrations/20251105120006_global_forms_nullable_and_policies.sql`).
- Índice único parcial para `slug` quando `tenant_id IS NULL`.
- RLS atualizada para permitir que admins visualizem formulários globais e campos (apenas SELECT), mantendo criação/edição restritas conforme papel.

Acceptance Criteria (Given–When–Then):
- Given um admin autenticado, When acessa `/dashboard/forms`, Then vê formulários do seu polo e globais, com “— sem polo —” para globais.
- Given um admin na página “Novo Formulário”, When tenta salvar sem selecionar polo, Then a API responde 400 e a UI instrui a selecionar um polo.
- Given um superadmin na página “Novo Formulário”, When cria sem `tenant_id`, Then o formulário é criado como global e aparece com “— sem polo —” na listagem.
- Given um formulário global ativo, When um usuário público preenche e seleciona um polo ativo, Then a submissão é aceita e vinculada ao polo.
- Given um formulário vinculado a um polo, When um usuário público envia sem `tenant_id`, Then a submissão é aceita e vinculada ao polo do formulário.

Definition of Done:
- Testes verdes (unit/integration no frontend para criação e submissão; validação mínima de RLS integrada via rotas).
- Documentação atualizada (README, OpenAPI com `tenant_id` opcional e regras por papel).
- Cobertura dos caminhos críticos: criação de formulário, submissão pública.
- Checklist de segurança revisada: sem segredos expostos; variáveis de ambiente usadas; RLS aplicada.

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

### Rotas internas (Next.js API)

As rotas internas do Next.js são usadas para operações administrativas e agregações com relacionamentos. Elas executam no servidor e podem utilizar Service Role quando necessário (nunca exposto ao cliente).

- `GET /api/admins` — Lista admins com polos vinculados.
  - Uso: Página `/dashboard/admins`.
  - Autorização: requer sessão de usuário com papel `superadmin`.
  - Implementação: usa `adminClient` (Service Role) no servidor para leitura completa de `admin_tenants` e `tenants`.
  - Observação: políticas RLS de `public.admin_tenants` foram adicionadas via migração `supabase/migrations/20251105120004_admin_tenants_policies.sql`.

- `PATCH /api/admins/[id]` — Atualiza dados do admin e seus vínculos com polos.
  - Autorização: `superadmin`.
  - Implementação: executa operações de escrita com Service Role.

Para detalhes do contrato, consulte `docs/openapi.yaml` (seção `/api/admins`).

### Rotas públicas (Next.js API)

Essas rotas são consumidas pela página de formulário público e não exigem autenticação do usuário. Executam no servidor e utilizam Service Role quando necessário para contornar RLS, expondo apenas campos seguros:

- `GET /api/public/tenants` — Lista polos ativos (id, name, slug).
- `GET /api/public/forms/{id}` — Retorna a definição do formulário (apenas ativo) e seus campos.
- `POST /api/public/submissions` — Cria uma submissão vinculada a um polo. Obrigatório enviar `tenant_id`.

Contrato detalhado em `docs/openapi.yaml`.

Aceitação (Given–When–Then):
- Given a página pública de formulário `/form/{id}`, When o usuário acessa a página, Then é exibido um campo "Polo" obrigatório com a lista de polos ativos.
- Given que o usuário não selecionou um polo, When tenta enviar o formulário, Then a submissão é bloqueada com mensagem "Selecione um polo".
- Given que o usuário selecionou um polo e preencheu os campos obrigatórios, When envia o formulário, Then a API `POST /api/public/submissions` cria a submissão com `tenant_id` e `polo` (nome) e retorna `201` com o `id` da submissão.

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
