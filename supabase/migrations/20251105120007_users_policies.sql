-- Users table policies: permitir que usuários autenticados leiam seu próprio registro
-- Seguro e necessário para o fluxo de login no frontend.

BEGIN;

-- Garantir que RLS esteja habilitado (idempotente, já habilitado no schema atual)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Evitar duplicar a policy se já existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'Users can read own user record'
  ) THEN
    CREATE POLICY "Users can read own user record"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (auth.uid() = auth_user_id);
  END IF;
END$$;

COMMIT;