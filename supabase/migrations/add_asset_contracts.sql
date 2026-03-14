-- Asset contracts table — stores uploaded lease agreements + AI-extracted terms
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.asset_contracts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id            uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  file_name           text NOT NULL,
  file_path           text NOT NULL,

  -- AI-extracted payment terms
  tenant_name         text,
  annual_amount       numeric,
  payment_frequency   text,   -- 'monthly' | 'quarterly' | 'annual' | 'semi_annual'
  payment_due_day     integer,
  lease_start_date    date,
  lease_end_date      date,
  escalation_rate     numeric,  -- e.g. 3.0 = 3% annual increase
  escalation_type     text,     -- 'annual_percent' | 'fixed' | 'cpi' | null
  currency            text DEFAULT 'USD',
  summary             text,     -- plain-English summary from AI
  raw_extraction      jsonb,    -- full structured extraction from Claude

  is_active           boolean DEFAULT true,
  parsed_at           timestamptz,
  uploaded_by         uuid REFERENCES public.users(id),
  created_at          timestamptz DEFAULT now()
);

-- Only one active contract per asset at a time
CREATE UNIQUE INDEX IF NOT EXISTS asset_contracts_active_one
  ON public.asset_contracts (asset_id)
  WHERE is_active = true;

ALTER TABLE public.asset_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_select_authenticated" ON public.asset_contracts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "contracts_insert_own" ON public.asset_contracts
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "contracts_update_own" ON public.asset_contracts
  FOR UPDATE USING (uploaded_by = auth.uid());

CREATE POLICY "contracts_admin_all" ON public.asset_contracts
  FOR ALL USING (public.is_admin());

-- Storage bucket: asset-contracts (create in Supabase dashboard)
-- Settings: private, PDF only, max 20MB
-- RLS: INSERT/SELECT for auth.uid() IS NOT NULL
