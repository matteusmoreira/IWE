# ADR-003: Simplificação temporária do Dashboard e filtro mensal

Status: Accepted  
Data: 2025-11-05

## Contexto

O Dashboard apresentava múltiplos cartões e gráficos (receita, conversão, performance por formulário) enquanto o requisito imediato do negócio é acompanhar "Total de Inscrições" por mês e por polo (tenant). Havia divergência de nomes de tabelas e status de pagamento, e a métrica principal precisava ser confiável antes de ampliar a visualização.

## Decisão

1. Simplificar a UI para exibir apenas o card "Total de Inscrições".
2. Introduzir filtro por Mês/Ano e manter filtro por Tenant.
3. Atualizar o endpoint `GET /api/metrics` (Next.js API) para aplicar intervalo mensal usando `public.submissions` e status de pagamento `PAGO | PENDENTE | CANCELADO | REEMBOLSADO`.
4. Documentar o contrato em `docs/openapi.yaml` e o racional desta decisão neste ADR.

## Consequências

- Menos ruído visual, foco na métrica crítica e validação do filtro mensal com RLS.
- As demais métricas continuam disponíveis no endpoint, mas não são exibidas na UI por ora.
- Pequena dívida técnica: revisar agregações de performance por formulário para refletir os novos nomes de tabelas/relacionamentos quando reativarmos os cartões.
 - Acessibilidade: reforçado contraste dos componentes de filtro (selects) no modo escuro usando tokens `bg-card` e `text-foreground` do design system.

## Arquivos afetados

- `frontend/app/dashboard/page.tsx` — UI: filtros e exibição apenas de "Total de Inscrições".
- `frontend/app/api/metrics/route.ts` — API: cálculo mensal e adequação aos nomes de tabelas/status.
- `docs/openapi.yaml` — OpenAPI: documentação do novo contrato.
- `README.md` — Nota de atualização do Dashboard.

## Rollback

- Reverter alterações nestes arquivos para reexibir os demais KPIs e gráficos quando necessário.
- Alternativamente, criar feature flags para ativar gradualmente os cartões adicionais.

## Critérios de Aceitação (Given–When–Then)

Feature: Filtro mensal no Dashboard
- Dado que estou autenticado e tenho acesso ao Dashboard,
- Quando seleciono Mês e Ano e, opcionalmente, um Tenant,
- Então o card "Total de Inscrições" exibe a contagem de submissões no intervalo [primeiro dia do mês, primeiro dia do mês seguinte) respeitando RLS e filtro de tenant.

Rota: GET /api/metrics
- Dado uma sessão válida (cookie `sb:token`) e parâmetros `month` (1–12) e `year` (>= 2000),
- Quando chamo `GET /api/metrics?month={m}&year={y}&tenant_id={t?}`,
- Então recebo `200` com `totalSubmissions` correspondente ao intervalo e ao escopo permitido pelo RLS/papel do usuário; `401` se não autenticado; `500` em erro interno.

Segurança
- Dado que o endpoint executa no servidor,
- Quando o sistema precisa de acesso ampliado, 
- Então a Service Role Key nunca é exposta ao cliente e só é utilizada por funções server-side com variáveis de ambiente.

## Definition of Done

- [x] UI atualizada e pré-visualizada sem erros.
- [x] Endpoint `/api/metrics` atualizado e documentado.
- [x] README e OpenAPI atualizados; ADR registrado.
- [ ] Testes verdes (adicionar testes e2e básicos para o fluxo do Dashboard).
- [x] Checklist de segurança revisado.
 - [x] Validação de contraste no dark mode para filtros (WCAG AA).