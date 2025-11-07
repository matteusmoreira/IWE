-- Global settings tables for WhatsApp and n8n (outbound webhooks)
-- This migration introduces single-instance configuration tables that are NOT tied to tenants.

-- WhatsApp global configuration
CREATE TABLE IF NOT EXISTS public.whatsapp_global_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL,
  api_base_url TEXT NOT NULL,
  token TEXT NOT NULL,
  default_sender TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_global_configs ENABLE ROW LEVEL SECURITY;

-- Outbound webhook (n8n/Moodle) global configuration
CREATE TABLE IF NOT EXISTS public.outbound_webhook_global_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_webhook_url TEXT NOT NULL,
  enrollment_webhook_token TEXT NULL,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  retries INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.outbound_webhook_global_configs ENABLE ROW LEVEL SECURITY;

-- Ensure updated_at auto-update trigger exists and is applied
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END$$;

DROP TRIGGER IF EXISTS set_updated_at_on_whatsapp_global ON public.whatsapp_global_configs;
CREATE TRIGGER set_updated_at_on_whatsapp_global
BEFORE UPDATE ON public.whatsapp_global_configs
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_on_outbound_global ON public.outbound_webhook_global_configs;
CREATE TRIGGER set_updated_at_on_outbound_global
BEFORE UPDATE ON public.outbound_webhook_global_configs
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- RLS Policies: allow admins to read; only superadmin can write
-- Assumes existence of function public.user_role() returning text

DROP POLICY IF EXISTS select_admins_whatsapp_global ON public.whatsapp_global_configs;
CREATE POLICY select_admins_whatsapp_global ON public.whatsapp_global_configs
  FOR SELECT USING (
    public.user_role() IN ('admin', 'superadmin')
  );

DROP POLICY IF EXISTS write_superadmin_whatsapp_global ON public.whatsapp_global_configs;
CREATE POLICY write_superadmin_whatsapp_global ON public.whatsapp_global_configs
  FOR ALL USING (
    public.user_role() = 'superadmin'
  ) WITH CHECK (
    public.user_role() = 'superadmin'
  );

DROP POLICY IF EXISTS select_admins_outbound_global ON public.outbound_webhook_global_configs;
CREATE POLICY select_admins_outbound_global ON public.outbound_webhook_global_configs
  FOR SELECT USING (
    public.user_role() IN ('admin', 'superadmin')
  );

DROP POLICY IF EXISTS write_superadmin_outbound_global ON public.outbound_webhook_global_configs;
CREATE POLICY write_superadmin_outbound_global ON public.outbound_webhook_global_configs
  FOR ALL USING (
    public.user_role() = 'superadmin'
  ) WITH CHECK (
    public.user_role() = 'superadmin'
  );