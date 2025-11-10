-- Global Mercado Pago configuration (single instance)
-- Allows saving credentials via panel without tenant dependency.

CREATE TABLE IF NOT EXISTS public.mercadopago_global_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL DEFAULT 'global', -- ensures single row via unique constraint
  access_token TEXT NOT NULL,
  public_key TEXT NULL,
  webhook_secret TEXT NULL,
  is_production BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mercadopago_global_scope_unique UNIQUE(scope)
);

ALTER TABLE public.mercadopago_global_configs ENABLE ROW LEVEL SECURITY;

-- Ensure updated_at trigger exists and is applied
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_on_mercadopago_global ON public.mercadopago_global_configs;
CREATE TRIGGER set_updated_at_on_mercadopago_global
BEFORE UPDATE ON public.mercadopago_global_configs
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- RLS Policies: allow admins to read; only superadmin can write
DROP POLICY IF EXISTS select_admins_mercadopago_global ON public.mercadopago_global_configs;
CREATE POLICY select_admins_mercadopago_global ON public.mercadopago_global_configs
  FOR SELECT USING (
    public.user_role() IN ('admin', 'superadmin')
  );

DROP POLICY IF EXISTS write_superadmin_mercadopago_global ON public.mercadopago_global_configs;
CREATE POLICY write_superadmin_mercadopago_global ON public.mercadopago_global_configs
  FOR ALL USING (
    public.user_role() = 'superadmin'
  ) WITH CHECK (
    public.user_role() = 'superadmin'
  );