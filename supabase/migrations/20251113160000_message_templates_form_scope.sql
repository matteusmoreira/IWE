BEGIN;
ALTER TABLE public.message_templates ADD COLUMN form_definition_id UUID REFERENCES public.form_definitions(id) ON DELETE SET NULL;
DROP INDEX IF EXISTS idx_message_templates_global_key_unique;
ALTER TABLE public.message_templates DROP CONSTRAINT IF EXISTS message_templates_tenant_id_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_templates_global_key_form_unique ON public.message_templates (key, form_definition_id) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_templates_tenant_key_form_unique ON public.message_templates (tenant_id, key, form_definition_id);
COMMIT;