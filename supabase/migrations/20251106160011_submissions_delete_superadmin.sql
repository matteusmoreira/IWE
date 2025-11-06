-- Permitir que superadmins deletem qualquer submissão
-- Adiciona política explícita de DELETE para superadmin na tabela submissions

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'submissions'
      AND policyname = 'Superadmins can delete all submissions'
  ) THEN
    CREATE POLICY "Superadmins can delete all submissions"
      ON public.submissions FOR DELETE
      USING (public.user_role() = 'superadmin');
  END IF;
END$$;