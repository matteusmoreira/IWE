# Checklist de Segurança

Última atualização: 2025-11-05

## Segredos e variáveis de ambiente
- [ ] Nenhum token/segredo commitado em arquivos versionados.
- [ ] `.env*` com placeholders apenas. Valores reais ficam fora do repositório.
- [ ] Documentação (README, OpenAPI) não expõe segredos.
 - [ ] `SUPABASE_SERVICE_ROLE_KEY` usado apenas no servidor (nunca em `NEXT_PUBLIC_*` nem no bundle do cliente).

## Banco de Dados e RLS
- [ ] RLS habilitado em tabelas sensíveis (`submissions`, `message_templates`, `file_uploads`, etc.).
- [ ] Políticas limitam acesso por `tenant_id` e papel do usuário.
- [ ] Função `is_admin_of_tenant` utilizada nas políticas.

## Storage
- [ ] Bucket `form-submissions` com políticas de leitura/gravação restritas.
- [ ] Vínculo entre `storage.objects` e `public.file_uploads` para validação de tenant.

## Auditoria
- [ ] Logs de auditoria habilitados onde aplicável.
- [ ] Triggers de atualização de `updated_at` existem.

## Integrações
- [ ] Credenciais de WhatsApp/Mercado Pago/N8N apenas via env vars.
- [ ] Webhooks validados e assinados quando possível.

## Deploy
- [ ] Revisão de migrações antes de aplicar em produção.
- [ ] Backups e rollback plan documentados.