# ADR-001: Unificação das migrações

Data: 2025-11-05

## Contexto

Havia dois diretórios de migrações SQL no repositório:

- `database/migrations/` (legado)
- `supabase/migrations/` (atual)

Isso causava risco de divergência e execução fora de ordem.

## Decisão

- Padronizar `supabase/migrations/` como fonte única de verdade.
- Arquivar conteúdos de `database/migrations/` em `database/migrations_archived_2025-11-05/`.
- Atualizar README e processos para refletir a padronização.

## Consequências

- Execução de migrações fica mais previsível e controlada.
- Evita duplicidade e conflitos.
- Usuários devem consultar apenas `supabase/migrations/` para novos deploys.

## Rollback

Se necessário, restaurar arquivos do diretório arquivado de volta para `database/migrations/` e documentar claramente a razão. Contudo, recomenda-se manter uma única origem.