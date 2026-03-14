-- Oracle method configuration for assets
-- Run in Supabase SQL editor

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS oracle_method text NOT NULL DEFAULT 'manual'
    CHECK (oracle_method IN ('manual', 'lease_income', 'external_feed')),
  ADD COLUMN IF NOT EXISTS oracle_config jsonb;

COMMENT ON COLUMN public.assets.oracle_method IS
  'How annual_yield is updated: manual = issuer sets it, lease_income = auto-calculated from recorded distributions, external_feed = pulled from third-party API';

COMMENT ON COLUMN public.assets.oracle_config IS
  'Method-specific config (e.g. cap_rate for lease_income, api_endpoint for external_feed)';
