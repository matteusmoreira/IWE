-- RLS policies for form_fields referencing tenant via form_definitions
-- Permite que superadmins gerenciem tudo e admins atuem apenas nos formulários dos tenants que administram.

BEGIN;

-- Superadmin: SELECT em todos os campos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'form_fields' AND policyname = 'Superadmins can view all form_fields'
  ) THEN
    CREATE POLICY "Superadmins can view all form_fields"
    ON public.form_fields
    FOR SELECT
    USING (
      public.user_role() = 'superadmin'
    );
  END IF;
END$$;

-- Superadmin: INSERT/UPDATE/DELETE em todos os campos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'form_fields' AND policyname = 'Superadmins can insert form_fields'
  ) THEN
    CREATE POLICY "Superadmins can insert form_fields"
    ON public.form_fields
    FOR INSERT
    WITH CHECK (
      public.user_role() = 'superadmin'
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'form_fields' AND policyname = 'Superadmins can update form_fields'
  ) THEN
    CREATE POLICY "Superadmins can update form_fields"
    ON public.form_fields
    FOR UPDATE
    USING (
      public.user_role() = 'superadmin'
    )
    WITH CHECK (
      public.user_role() = 'superadmin'
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'form_fields' AND policyname = 'Superadmins can delete form_fields'
  ) THEN
    CREATE POLICY "Superadmins can delete form_fields"
    ON public.form_fields
    FOR DELETE
    USING (
      public.user_role() = 'superadmin'
    );
  END IF;
END$$;

-- Admin: SELECT apenas de campos vinculados a formulários dos tenants administrados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'form_fields' AND policyname = 'Admins can view form_fields of their tenants'
  ) THEN
    CREATE POLICY "Admins can view form_fields of their tenants"
    ON public.form_fields
    FOR SELECT
    USING (
      public.user_role() = 'admin' AND EXISTS (
        SELECT 1
        FROM public.form_definitions fd
        WHERE fd.id = form_fields.form_definition_id
          AND public.is_admin_of_tenant(fd.tenant_id)
      )
    );
  END IF;
END$$;

-- Admin: INSERT apenas em campos de formulários dos tenants administrados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'form_fields' AND policyname = 'Admins can insert form_fields for their tenants'
  ) THEN
    CREATE POLICY "Admins can insert form_fields for their tenants"
    ON public.form_fields
    FOR INSERT
    WITH CHECK (
      public.user_role() = 'admin' AND EXISTS (
        SELECT 1
        FROM public.form_definitions fd
        WHERE fd.id = form_fields.form_definition_id
          AND public.is_admin_of_tenant(fd.tenant_id)
      )
    );
  END IF;
END$$;

-- Admin: UPDATE apenas em campos de formulários dos tenants administrados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'form_fields' AND policyname = 'Admins can update form_fields of their tenants'
  ) THEN
    CREATE POLICY "Admins can update form_fields of their tenants"
    ON public.form_fields
    FOR UPDATE
    USING (
      public.user_role() = 'admin' AND EXISTS (
        SELECT 1
        FROM public.form_definitions fd
        WHERE fd.id = form_fields.form_definition_id
          AND public.is_admin_of_tenant(fd.tenant_id)
      )
    )
    WITH CHECK (
      public.user_role() = 'admin' AND EXISTS (
        SELECT 1
        FROM public.form_definitions fd
        WHERE fd.id = form_fields.form_definition_id
          AND public.is_admin_of_tenant(fd.tenant_id)
      )
    );
  END IF;
END$$;

-- Admin: DELETE apenas em campos de formulários dos tenants administrados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'form_fields' AND policyname = 'Admins can delete form_fields of their tenants'
  ) THEN
    CREATE POLICY "Admins can delete form_fields of their tenants"
    ON public.form_fields
    FOR DELETE
    USING (
      public.user_role() = 'admin' AND EXISTS (
        SELECT 1
        FROM public.form_definitions fd
        WHERE fd.id = form_fields.form_definition_id
          AND public.is_admin_of_tenant(fd.tenant_id)
      )
    );
  END IF;
END$$;

COMMIT;