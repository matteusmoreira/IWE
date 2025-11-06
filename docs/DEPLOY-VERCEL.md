# Deploy na Vercel — SaaS IWE

Este guia descreve como publicar o projeto na Vercel com segurança, usando o diretório `frontend/` como raiz de build. Nenhum segredo deve ser versionado; use variáveis de ambiente.

## Resumo

- Diretório raiz (Root Directory): `frontend`
- Framework: Next.js (App Router)
- Build e Output: padrão do Next
- Variáveis de ambiente: definidas na Vercel (Production/Preview)
- Segurança: Service Role Key somente no servidor; nunca em variáveis `NEXT_PUBLIC_*`

## Passo a passo

1) Vincular o repositório GitHub
   - Acesse Vercel > New Project > Import Git Repository.
   - Selecione o repositório `matteusmoreira/IWE`.

2) Configurar Root Directory
   - Em “Framework Preset”: Next.js.
   - Em “Root Directory”: selecione `frontend`.
   - Build Command: `next build` (padrão da Vercel).
   - Output Directory: `.next` (padrão).

3) Definir variáveis de ambiente (Vercel > Settings > Environment Variables)
   - Em “Production” (e “Preview”, se desejar deploy em PRs), adicione:
     - `NEXT_PUBLIC_SUPABASE_URL=HTTPS://<SEU_PROJECT_REF>.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY=**********` (chave pública anon)
     - `NEXT_PUBLIC_APP_URL=https://<SEU_DOMINIO_NA_VERCEL>`
     - `SUPABASE_SERVICE_ROLE_KEY=**********` (apenas servidor)

   Observações importantes:
   - Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no cliente. Essa variável **não** deve começar com `NEXT_PUBLIC_`.
   - Essa chave é usada exclusivamente por rotas server-side (ex.: `frontend/app/api/public/*`, `frontend/app/api/users/*`, `frontend/app/api/webhooks/*`).

4) Deploy
   - Clique “Deploy”.
   - Após finalizar, acesse o domínio gerado para validar páginas:
     - `/` (home)
     - `/auth/login` (login)
     - `/dashboard` (após autenticação)

5) Usuário inicial (opcional para testes)
   - Localmente, você pode criar um superadmin de teste via script: `cd frontend && node scripts/create-superadmin.mjs`.
   - Em produção, use somente usuários de teste e nunca publique credenciais reais.

## Integrações externas

### Mercado Pago — Webhooks
- Endpoint: `POST /api/webhooks/mercadopago`.
- O sistema usa `SUPABASE_SERVICE_ROLE_KEY` para registrar eventos e atualizar submissões.
- A busca dos detalhes do pagamento é feita com `access_token` do tenant (guardado em `mercadopago_configs`).

### WhatsApp (Evolution API)
- O envio usa `whatsapp_configs` por tenant (token e base URL armazenados no banco).
- Não coloque tokens de WhatsApp em `.env`. Eles devem ficar na tabela de configuração.

### n8n / Moodle
- O envio de matrícula usa `outbound_webhook_configs` com URL e token do webhook.
- Tokens e URLs são armazenados por tenant, não em `.env`.

## Segurança

- `.env.local` e `Supabase.txt` estão ignorados pelo Git (`.gitignore`).
- Nunca copie segredos para documentação ou commits.
- Service Role Key somente em rotas server-side; no cliente use apenas `NEXT_PUBLIC_*` públicos.

## Rollback

- Se precisar voltar a uma configuração anterior de imagens do Supabase, edite `frontend/next.config.ts` para restaurar o domínio fixo.
- Se o deploy falhar por variáveis ausentes, ajuste em Vercel > Settings > Environment Variables e redeploy.

## Aceitação (Given–When–Then)

- Given o projeto vinculado à Vercel com Root Directory `frontend`, When as variáveis de ambiente são definidas conforme este guia, Then o build conclui com sucesso e o site abre no domínio da Vercel.
- Given as rotas públicas de formulário, When `SUPABASE_SERVICE_ROLE_KEY` está definido apenas no servidor, Then os endpoints em `frontend/app/api/public/*` respondem sem expor segredos ao cliente.
- Given o webhook de pagamento do Mercado Pago, When uma notificação `payment` é recebida, Then o sistema registra `payment_events` e atualiza `submissions.payment_status` conforme o status do pagamento.

## Próximo passo mínimo

- Validar o primeiro deploy na Vercel e ajustar `NEXT_PUBLIC_APP_URL` para o domínio real do projeto.