-- Permite que superadmins atualizem quaisquer registros de submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'submissions'
      AND policyname = 'Superadmins can update all submissions'
  ) THEN
    CREATE POLICY "Superadmins can update all submissions"
    ON public.submissions
    FOR UPDATE
    USING (public.user_role() = 'superadmin')
    WITH CHECK (public.user_role() = 'superadmin');
  END IF;
END
$$;