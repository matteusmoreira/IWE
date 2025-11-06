# ADR-002 — Listagem de Admins usando Service Role temporariamente

Data: 2025-11-05

Status: Aceito (com plano de rollback)

## Contexto

Foi identificado que, na página `/dashboard/admins`, a coluna “Polos Vinculados” não exibia os polos corretamente após editar um admin. A causa raiz foi a leitura da tabela `public.admin_tenants` sob RLS sem políticas `SELECT` adequadas, resultando em array vazio mesmo para `superadmin`.

## Decisão

1. Aplicar um "quick fix" na rota `GET /api/admins` (arquivo `frontend/app/api/admins/route.ts`) para utilizar o `adminClient` (Service Role), garantindo a leitura completa de `admin_tenants` e `tenants`.
2. Criar e aplicar migração adicionando políticas RLS `SELECT` em `public.admin_tenants`:
   - Superadmins podem ler todos os vínculos.
   - Admins podem ler apenas vínculos do próprio usuário.
   Arquivo: `supabase/migrations/20251105120004_admin_tenants_policies.sql`.

## Consequências

- Segurança: o uso de Service Role bypassa RLS. Deve ser restrito a rotas server-side e jamais exposto ao cliente. A chave é configurada via `SUPABASE_SERVICE_ROLE_KEY` no ambiente do servidor (mascarada em logs e arquivos).
- Observabilidade: facilita a listagem com relacionamentos, reduzindo complexidade no frontend.
- Manutenibilidade: enquanto as políticas RLS amadurecem, o Service Role evita bloqueios e inconsistências.

## Plano de Rollback

Quando as políticas RLS estiverem estáveis e validadas:

1. Alterar `GET /api/admins` para usar o cliente com sessão do usuário (sem Service Role).
2. Garantir que as políticas RLS de `admin_tenants` e `tenants` permitam leitura consistente para `superadmin` e `admin` (testes cobrindo cenários de listagem e edição).
3. Executar testes end-to-end mínimos para validação da coluna “Polos Vinculados”.

## Relacionados

- `docs/openapi.yaml` — Documentação adicionada para `/api/admins` (GET/PATCH), com nota sobre uso de Service Role.
- `frontend/app/api/admins/route.ts` — Rota atualizada para usar `adminClient` no GET.
- `supabase/migrations/20251105120004_admin_tenants_policies.sql` — Migração com políticas RLS `SELECT` em `public.admin_tenants`.