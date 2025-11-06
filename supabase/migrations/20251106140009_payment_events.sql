-- Migration: payment_events logging for Mercado Pago
-- Safe defaults: RLS enabled, inserts performed via Service Role only

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- e.g., 'payment', 'preference'
  mp_payment_id text,
  mp_preference_id text,
  external_reference text,
  status text,
  amount numeric(10,2),
  currency varchar(3) DEFAULT 'BRL',
  payer_email text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payment_events_mp_payment_id ON public.payment_events (mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_created_at ON public.payment_events (created_at);

-- Trigger to auto-update updated_at on changes
CREATE TRIGGER trg_payment_events_updated_at
BEFORE UPDATE ON public.payment_events
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

COMMENT ON TABLE public.payment_events IS 'Logs de eventos de pagamento do Mercado Pago';

COMMIT;