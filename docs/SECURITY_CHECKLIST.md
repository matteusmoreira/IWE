# Checklist de Segurança

Este documento consolida práticas recomendadas de segurança para o SaaS IWE.

## Segredos e Variáveis de Ambiente
- Nunca commitar segredos no repositório.
- Usar variáveis de ambiente para tokens/API keys e mascarar valores em logs.
- Rotacionar segredos periodicamente.

## Banco de Dados e RLS
- Habilitar Row Level Security (RLS) em tabelas sensíveis.
- Validar políticas por papel (superadmin, admin, user) e por tenant.
- Minimizar dados pessoais retornados por endpoints públicos.

## Storage
- Restringir acesso por bucket e tenant.
- Validar uploads (tipo, tamanho) e aplicar antivírus quando aplicável.

## Auditoria
- Habilitar logs de acesso e ações administrativas.
- Não logar dados pessoais completos; mascarar quando necessário.

## Integrações e Webhooks
- Validar payload/assinatura de webhooks (ex.: MercadoPago) e armazenar apenas o mínimo necessário.
- Usar timeouts e retries exponenciais para chamadas externas.

### ViaCEP (consulta de CEP)
- Sem segredos/tokens — chamadas feitas no cliente.
- Sanitização: aceitar apenas 8 dígitos; aplicar máscara `#####-###`.
- Tratar falhas de rede com fallback silencioso (não bloquear submissões).
- Debounce/disparo somente ao completar 8 dígitos (reduz requisições).
- Não logar CEP completo; mascarar em logs, se necessário.
- Verificar CORS e usar HTTPS.

### Resend (E-mail)
- `RESEND_API_KEY` configurada apenas no servidor (sem `NEXT_PUBLIC_`).
- Domínio de envio verificado com SPF e DKIM.
- Endereço `RESEND_FROM` usa domínio verificado.
- Logs e auditoria não expõem e-mails completos (mascarar quando necessário) nem tokens.
- Variáveis de ambiente definidas em produção e desenvolvimento (valores reais apenas nos ambientes, nunca no repositório).
- Rotas internas (`/api/emails/send`) exigem sessão válida e verificação de admin por tenant.

## Frontend
- Validar entradas no cliente e no servidor.
- Bloquear XSS via sanitização, escaping e CSP adequada.
- Evitar exposição de stack traces em produção.

## Build/Deploy
- Diferenciar configs de dev e prod.
- Habilitar HTTPS e HSTS em produção.

## Testes e Cobertura
- Manter testes verdes para caminhos críticos (autenticação, edição de formulário, submissão pública).
- Cobrir validações de CPF, CEP e telefone.