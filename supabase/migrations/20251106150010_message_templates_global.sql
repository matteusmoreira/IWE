-- Tornar templates globais (tenant_id opcional) e ajustar políticas
-- Executar após 20251105120001_initial_schema.sql

BEGIN;

-- 1) Permitir templates globais: tornar tenant_id opcional
ALTER TABLE public.message_templates
  ALTER COLUMN tenant_id DROP NOT NULL;

-- 2) Garantir unicidade de chave para templates globais
--    Em UNIQUE(tenant_id, key), valores NULL não são comparados;
--    portanto criamos índice único parcial para (key) quando tenant_id IS NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_templates_global_key_unique
  ON public.message_templates (key)
  WHERE tenant_id IS NULL;

-- 3) Políticas RLS: permitir que admins LEIAM templates globais;
--    superadmin já tem acesso total via política existente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_templates'
      AND policyname = 'Admins can select global message_templates'
  ) THEN
    CREATE POLICY "Admins can select global message_templates"
    ON public.message_templates
    FOR SELECT
    USING (
      public.user_role() = 'admin' AND tenant_id IS NULL
    );
  END IF;
END$$;

-- 4) Opcional: inserir template global padrão se não existir
INSERT INTO public.message_templates (tenant_id, key, title, content, variables, is_active)
SELECT NULL, 'payment_approved', 'Pagamento Aprovado',
       E'Olá {{nome_completo}}! Seu pagamento foi confirmado. Curso: {{curso}}. Polo: {{polo}}. Valor: {{valor}}.',
       '["nome_completo","curso","polo","valor"]', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.message_templates mt
  WHERE mt.tenant_id IS NULL AND mt.key = 'payment_approved'
);

COMMIT;