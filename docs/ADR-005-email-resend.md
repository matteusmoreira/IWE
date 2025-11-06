# ADR-005 — Integração de E-mail Transacional com Resend

Status: Aceito
Data: 2025-11-06

## Contexto
- Precisamos enviar e-mails transacionais (ex.: confirmação de pagamento, instruções pós-inscrição) de forma confiável, com domínio verificado e baixa complexidade operacional.
- A aplicação roda em Next.js (App Router) com rotas internas autenticadas e integrações externas (Mercado Pago, WhatsApp, n8n/Moodle).
- Não há infraestrutura de SMTP própria nem equipe dedicada para manutenção de serviços de e-mail.

## Decisão
- Adotar o provedor Resend para envio de e-mails transacionais no frontend (server-side):
  - Criar cliente reutilizável em `frontend/lib/resend.ts`.
  - Expor rota interna `POST /api/emails/send` em `frontend/app/api/emails/send/route.ts` com autenticação por sessão e verificação de admin por tenant.
  - Reutilizar `message_templates` para conteúdo com placeholders `{{variavel}}` e enriquecer variáveis via `submission_id` quando disponível.
  - Integrar envio pós-pagamento no webhook do Mercado Pago (`frontend/app/api/webhooks/mercadopago/route.ts`).
  - Documentar contrato em `docs/openapi.yaml`.

## Trade-offs
Prós:
- Simplicidade de integração (SDK oficial) e alta entregabilidade com domínio verificado.
- Evita gerenciar SMTP, filas e reputação manualmente.
- Integração direta com templates já existentes.

Contras:
- Dependência de provedor externo e custo por volume de envio.
- Exige verificação de domínio (SPF/DKIM) e gestão de reputação.

## Segurança
- Variáveis de ambiente: `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO` apenas no servidor; nunca expor com `NEXT_PUBLIC_`.
- Mascarar endereços e tokens em logs e auditoria.
- Checklist atualizado em `docs/SECURITY_CHECKLIST.md`.

## Rollback
- Alternativa: trocar para SMTP via Nodemailer/Provider (ex.: Amazon SES, SendGrid).
- Ações:
  1. Desativar uso de `frontend/lib/resend.ts` e substituir por cliente SMTP.
  2. Atualizar `POST /api/emails/send` para usar transporte SMTP (mantendo contrato).
  3. Atualizar documentação e variáveis de ambiente.

## Definição de Pronto (DoD)
- OpenAPI atualizado (`/api/emails/send`).
- README/SETUP com variáveis de ambiente do Resend.
- Segurança: checklist atualizado e domínio verificado (SPF/DKIM).
- Testes de fluxo crítico realizados (envio manual com template e com HTML custom), sem expor segredos.