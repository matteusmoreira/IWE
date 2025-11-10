IWE Frontend — Pagamentos Mercado Pago Globais

O que está em vigor
- Os pagamentos NÃO são por polo/tenant. Existe um único conjunto de credenciais válido para todo o sistema.
- A UI em Dashboard > Configurações > Mercado Pago exibe o STATUS das variáveis de ambiente globais (sem formulário de gravação por tenant).
- O teste cria uma preferência mínima usando MP_ACCESS_TOKEN global e APP_URL para back_urls e notification_url.

Variáveis de ambiente (globais)
- APP_URL: Obrigatório. Base para back_urls e notification_url.
- NEXT_PUBLIC_APP_URL: Opcional para uso em cliente.
- MP_ACCESS_TOKEN: Obrigatório (servidor). Token privado da aplicação do Mercado Pago.
- MP_PUBLIC_KEY: Opcional. Chave pública para uso em componentes client (ex.: JS SDK).
- MP_STATEMENT_DESCRIPTOR: Opcional. Texto na fatura (máx. 22 caracteres). Padrão: "IWE".

Fluxo de pagamento (global)
1. Após enviar o formulário com require_payment habilitado e valor válido (> 0), a API /api/payments/create-preference cria a preferência no Mercado Pago usando MP_ACCESS_TOKEN global.
2. O usuário é redirecionado para init_point.
3. O Mercado Pago envia o webhook para /api/webhooks/mercadopago.
4. O sistema atualiza o status da submissão e dispara notificações (WhatsApp/E-mail), conforme configuração.

Como testar (local)
- Configure .env.local conforme .env.local.example.
- Inicie o servidor: npm run dev (ou via Node se houver restrição de PowerShell, veja abaixo).
- Submeta um formulário com require_payment=true e payment_amount>0.
- Verifique o redirecionamento para a página de checkout (init_point).

Observações
- Configurações de WhatsApp/Moodle continuam por tenant, mas o Mercado Pago é GLOBAL.

Supabase — Clientes e segurança
- Server helper: usamos `createServerComponentClient` (lib/supabase/server.ts) para rotas autenticadas, lendo cookies do Next.
- Admin client seguro: `lib/supabase/admin.ts` prefere `SUPABASE_SERVICE_ROLE_KEY`; em desenvolvimento, faz fallback para `NEXT_PUBLIC_SUPABASE_ANON_KEY` apenas para leituras públicas (evitar 500 durante smoke test). Nunca expomos a Service Role no cliente.
- Rotas públicas: criamos `GET /api/public/tenants` para listar polos ativos (id, name, slug) sem autenticação, usando o admin client com filtro `status=true`.

Execução em monorepo (workspace)
- Em ambientes com política do PowerShell restrita, rode via Node:
  - `node ../node_modules/next/dist/bin/next dev -p 3020` (cwd: frontend)
- Porta padrão 3000; se estiver ocupada, use `-p 3020` ou outra.
- Variáveis necessárias (arquivo `.env.local`):
  - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Opcional para leituras públicas robustas: `SUPABASE_SERVICE_ROLE_KEY` (apenas servidor)
  - `APP_URL` e `NEXT_PUBLIC_APP_URL` (ex.: http://localhost:3020)

Smoke test rápido
- Acesse: `/`, `/auth/login`, `/f/{slug}`, `/form/{id}`.
- Esperado: páginas carregam sem erro 500; formulários retornam 404 quando não há dados seed.
- Se precisar, use MCP Playwright para navegar e capturar screenshots.

WhatsApp — Teste de Conexão (Evolution API)
1) Variáveis de ambiente (veja .env.local.example)
- EVOLUTION_API_URL: URL base da Evolution API (sem barra no final)
- EVOLUTION_API_KEY: API Key (servidor)
- EVOLUTION_INSTANCE_NAME: Nome da instância (opcional)

2) Teste via UI
- Vá em Dashboard > Configurações > WhatsApp
- Preencha instance_name, api_url e api_key
- Clique em “Testar Conexão” para ver instâncias e estado da conexão

4) Mostrar QR Code (pareamento)
- Na mesma tela (Dashboard > Configurações > WhatsApp), clique em “Mostrar QR Code”.
- O sistema chama o endpoint interno POST /api/settings/whatsapp/qrcode com api_url, api_key e instance_name.
- Quando a instância está em estado de pareamento (qrcode), o QR é exibido (PNG base64). Se já estiver conectada (open), informa que não há QR disponível.

3) Teste via script Node (alternativa)
- Rode: node frontend/scripts/test-evolution-api.mjs (com EVOLUTION_* no ambiente)
- O script faz GET /instance/fetchInstances e /instance/connectionState/{instance}
- Header usado: apikey (não exposto em logs)

Importante
- Erros comuns: 404 ao usar baseUrl com barra final + path com barra inicial (//), 401 quando o header apikey não é enviado.
 - Endpoints usados: GET /instance/fetchInstances, GET /instance/connectionState/{instance}, GET /instance/qrcode/{instance} (fallback GET /instance/connect/{instance}).

Deploy na Vercel (CLI)
- Pré-requisitos: conta Vercel e autenticação via CLI (interativo com `vercel login` ou variável de ambiente `VERCEL_TOKEN` para uso não-interativo). Nunca exponha tokens em logs/commits.
- Em ambientes Windows com política de execução restrita, use o binário do Next e Vercel via Node diretamente:
  - Link do projeto (cwd: `frontend/`):
    - `node ../node_modules/vercel/dist/index.js link --scope <org> --confirm`
    - Cria `.vercel/project.json` com o ID do projeto e organização.
  - Deploy de Preview (cwd: `frontend/`):
    - `node ../node_modules/vercel/dist/index.js deploy --confirm`
  - Deploy de Produção (cwd: `frontend/`):
    - `node ../node_modules/vercel/dist/index.js deploy --prod --confirm`

Variáveis de ambiente na Vercel
- Defina para Production e Preview (no dashboard ou via CLI):
  - `APP_URL`: URL base do backend/servidor para compor back_urls e notification_url. Ex.: `https://seu-domínio.com`.
  - `NEXT_PUBLIC_APP_URL`: URL pública da aplicação (usada no cliente). Ex.: `https://seu-domínio.com`.
  - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (cliente)
  - `SUPABASE_SERVICE_ROLE_KEY` (servidor)
  - `MP_ACCESS_TOKEN` (servidor) e `MP_PUBLIC_KEY` (opcional)
  - `MP_STATEMENT_DESCRIPTOR` (opcional)
  - `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO` (e-mail)
  - `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME` (WhatsApp)

Notas de roteamento/compatibilidade (Next 15)
- Handlers em `app/api/**/[...]/route.ts` usam `context: { params: Promise<{...}> }` e extraem com `const { id } = await context.params;`, compatível com a tipagem do Next 15.
- Páginas de formulário público (`/f/[slug]`) retornam 404 quando o formulário está inativo ou não existe.

Checklist de Deploy
- [ ] Projeto linkado (`.vercel/` presente no diretório `frontend/`).
- [ ] Variáveis de ambiente configuradas em Production e Preview (sem expor segredos).
- [ ] Deploy de Preview criado e validado (URL abre sem erro 500).
- [ ] Deploy de Produção criado.
- [ ] `NEXT_PUBLIC_APP_URL` aponta para o domínio final.
- [ ] Smoke test executado nas rotas principais.