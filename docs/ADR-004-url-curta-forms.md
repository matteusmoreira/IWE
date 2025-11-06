# ADR-004 — URLs curtas para Formulários e Redirecionamento

Status: Aceito
Data: 2025-11-06

## Contexto
- Usuários compartilham links de formulários com frequência; URLs com UUID são longas e pouco amigáveis.
- Há necessidade de exibir e copiar rapidamente links públicos no Dashboard.
- O frontend já possui rota pública `/form/[id]` que exibe o formulário por ID.

## Decisão
1. Introduzir `slug` opcional no modelo de formulário (frontend types) e expor o campo pelo endpoint público por ID.
2. Criar rota curta `/f/[slug]` para acesso público ao formulário.
3. Implementar redirecionamento automático de `/form/[id]` para `/f/[slug]` quando o formulário possuir slug.
4. Ajustar a ação de copiar link no Dashboard para priorizar a URL curta e exibir o slug sob o título.
5. Documentar contrato OpenAPI e README; adicionar testes automatizados para comportamentos críticos.

## Alternativas consideradas
- Manter apenas `/form/[id]`: rejeitado pela baixa usabilidade e estética.
- Usar querystring `?slug=` em vez de rota dedicada: rejeitado por SEO/compartilhamento e clareza de contrato.

## Impacto
- Backend: sem mudanças no banco no escopo atual. Campo `slug` é retornado pelo endpoint público e utilizado no frontend.
- Frontend: ajustes nas páginas e UI de compartilhamento; redirecionamento leve.
- Documentação: atualização do OpenAPI e README.

## Implementação
- Arquivos modificados:
  - `frontend/app/api/public/forms/[id]/route.ts` — incluir `slug` no payload quando disponível.
  - `frontend/lib/form-field-types.ts` — adicionar `slug?: string` em `Form`.
  - `frontend/app/dashboard/forms/page.tsx` — usar `/f/[slug]` no copiar e exibir link curto na UI.
  - `frontend/app/form/[id]/page.tsx` — redirecionar para `/f/[slug]` se houver slug.
  - `docs/openapi.yaml` — adicionar `slug` ao schema `PublicFormDefinition` e a rota `GET /api/public/forms/by-slug/{slug}`.

## Segurança
- Nenhuma credencial exposta. Uso exclusivo de variáveis de ambiente em rotas server-side.
- Logs e documentação não exibem segredos; placeholders mascarados quando necessário.

## Testes (Definition of Done)
- Unit/integration:
  - `GET /api/public/forms/{id}` inclui `slug` (quando houver).
  - Página `/form/[id]` redireciona para `/f/[slug]`.
  - A ação de copiar no Dashboard usa a URL curta.
- Docs atualizados (README e OpenAPI); Checklist de segurança revisado.

## Rollback Plan
- Reverter patches dos arquivos listados em Implementação.
- Remover o campo `slug` do schema em `docs/openapi.yaml` e a rota por slug.

## Métricas de Sucesso
- Taxa de compartilhamento com links curtos em crescimento.
- Redução de dúvidas de usuários sobre qual link usar.