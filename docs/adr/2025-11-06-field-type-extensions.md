# ADR: Extensão do enum `field_type` (CEP, CPF, Radio)

Status: Accepted
Date: 2025-11-06

Contexto:
- O frontend já suportava tipos de campo `cep`, `cpf` e `radio`.
- A API pública valida `cep` (regex) e o builder cria placeholders para `cep` e `cpf`.
- O schema do Postgres (Supabase) não incluía estes valores no enum `field_type`, provocando erro 500 ao criar formulários.

Decisão:
- Adicionar `cep`, `cpf` e `radio` ao enum `field_type` via migração: `supabase/migrations/20251106130008_field_type_add_cpf_cep_radio.sql`.
- Atualizar a documentação OpenAPI (`docs/openapi.yaml`) para incluir os novos tipos no schema `PublicFormField`.
- Manter compatibilidade com tipos já existentes (text, email, phone, select, date, file, checkbox, textarea, number).

Consequências:
- Correção do erro "invalid input value for enum field_type: \"cep\"" ao inserir campos.
- Documentação alinhada com o frontend e o backend.
- Não há necessidade de migração de dados existente, pois adicionamos valores novos ao enum.

Trade-offs e riscos:
- Enum do Postgres é mais rígido; novas expansões exigem migrações adicionais.
- `file` nos formulários públicos pode demandar fluxos de upload específicos; permanece suportado no builder mas deve ser validado caso seja exposto publicamente.

Plano de rollback:
- Caso seja necessário reverter, criar nova migração que substitua o enum por um tipo TEXT com constraint, ou manter o enum e bloquear uso de valores via validação de API.
- Alternativamente, manter os valores no enum e impedir criação via regras de negócio caso necessário.

Checklist de implementação:
- [x] Migração adicionada.
- [x] OpenAPI atualizado.
- [ ] Aplicar migração no ambiente alvo (CLI/SQL Editor).
- [ ] Gerar dumps atualizados (`supabase/schema_public.sql`, `supabase/schema_storage.sql`).