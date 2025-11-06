-- Permitir formulários globais (tenant_id opcional) e ajustar políticas para visualização/uso.
-- Executar após 20251105120001_initial_schema.sql

BEGIN;

-- 1) Tornar tenant_id opcional em form_definitions
ALTER TABLE public.form_definitions
  ALTER COLUMN tenant_id DROP NOT NULL;

-- 2) Índice único parcial para slugs globais (tenant_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_definitions_global_slug_unique
  ON public.form_definitions (slug)
  WHERE tenant_id IS NULL;

-- 3) RLS: permitir que admins visualizem formulários globais (SELECT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'form_definitions'
      AND policyname = 'Admins can select global form_definitions'
  ) THEN
    CREATE POLICY "Admins can select global form_definitions"
    ON public.form_definitions
    FOR SELECT
    USING (
      public.user_role() = 'admin' AND tenant_id IS NULL
    );
  END IF;
END$$;

-- 4) RLS: superadmin pode criar formulários globais (INSERT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'form_definitions'
      AND policyname = 'Superadmins can insert global form_definitions'
  ) THEN
    CREATE POLICY "Superadmins can insert global form_definitions"
    ON public.form_definitions
    FOR INSERT
    WITH CHECK (
      public.user_role() = 'superadmin' AND tenant_id IS NULL
    );
  END IF;
END$$;

-- 5) RLS: admins podem criar/editar apenas formulários vinculados a seus tenants (reforço de WITH CHECK)
-- Observação: muitas instalações usam uma política FOR ALL com USING para permissões de admin.
-- Este WITH CHECK adicional evita criação acidental de formulários globais por admins.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'form_definitions'
      AND policyname = 'Admins can insert form_definitions for their tenants'
  ) THEN
    CREATE POLICY "Admins can insert form_definitions for their tenants"
    ON public.form_definitions
    FOR INSERT
    WITH CHECK (
      public.user_role() = 'admin' AND tenant_id IS NOT NULL AND public.is_admin_of_tenant(tenant_id)
    );
  END IF;
END$$;

-- 6) RLS: admins podem atualizar apenas formulários dos seus tenants (WITH CHECK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'form_definitions'
      AND policyname = 'Admins can update form_definitions for their tenants'
  ) THEN
    CREATE POLICY "Admins can update form_definitions for their tenants"
    ON public.form_definitions
    FOR UPDATE
    USING (
      public.user_role() = 'admin' AND tenant_id IS NOT NULL AND public.is_admin_of_tenant(tenant_id)
    )
    WITH CHECK (
      public.user_role() = 'admin' AND tenant_id IS NOT NULL AND public.is_admin_of_tenant(tenant_id)
    );
  END IF;
END$$;

-- 7) RLS: superadmin pode atualizar formulários globais
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'form_definitions'
      AND policyname = 'Superadmins can update global form_definitions'
  ) THEN
    CREATE POLICY "Superadmins can update global form_definitions"
    ON public.form_definitions
    FOR UPDATE
    USING (
      public.user_role() = 'superadmin' AND tenant_id IS NULL
    )
    WITH CHECK (
      public.user_role() = 'superadmin' AND tenant_id IS NULL
    );
  END IF;
END$$;

-- 8) RLS em form_fields: permitir que admins visualizem campos de formulários globais (apenas SELECT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'form_fields'
      AND policyname = 'Admins can view form_fields of global forms'
  ) THEN
    CREATE POLICY "Admins can view form_fields of global forms"
    ON public.form_fields
    FOR SELECT
    USING (
      public.user_role() = 'admin' AND EXISTS (
        SELECT 1
        FROM public.form_definitions fd
        WHERE fd.id = form_fields.form_definition_id
          AND fd.tenant_id IS NULL
      )
    );
  END IF;
END$$;

COMMIT;