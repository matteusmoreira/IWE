# Migrações arquivadas (2025-11-05)

Este diretório contém as migrações legadas previamente em `database/migrations`.

Motivo: padronização para `supabase/migrations` como fonte única de verdade.

Arquivos movidos:
- 001_initial_schema.sql
- 002_file_storage.sql
- 002_seed_data.sql

Observação: novas migrações devem ser criadas via `supabase migration new` e aplicadas/gerenciadas exclusivamente em `supabase/migrations/`.