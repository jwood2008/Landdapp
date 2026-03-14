-- ============================================================
-- Missing tables, functions, and columns
-- Run in Supabase SQL editor
-- ============================================================

-- ============================================================
-- 1. is_admin() helper function (used by RLS policies)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- 2. Add missing columns to assets table
-- ============================================================
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS require_auth BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);

-- Add 'issuer' to user_role enum if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumlabel = 'issuer'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'issuer';
  END IF;
END$$;

-- ============================================================
-- 3. Announcements table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general'
              CHECK (category IN ('general', 'distribution', 'valuation', 'legal', 'urgent')),
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  asset_id    UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read announcements
CREATE POLICY "announcements_select_authenticated" ON public.announcements
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admins and issuers can insert announcements
CREATE POLICY "announcements_insert_auth" ON public.announcements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'issuer')
    )
  );

-- Admins can do anything
CREATE POLICY "announcements_admin_all" ON public.announcements
  FOR ALL USING (public.is_admin());

-- ============================================================
-- 4. Valuation documents table (AI-validated appraisals)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.valuation_documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id              UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  valuation_id          UUID REFERENCES public.valuations(id) ON DELETE SET NULL,
  file_name             TEXT NOT NULL,
  file_path             TEXT NOT NULL,
  file_size_bytes       INTEGER,
  file_hash             TEXT,
  ai_extracted_value    NUMERIC,
  ai_appraiser_name     TEXT,
  ai_appraisal_date     DATE,
  ai_property_address   TEXT,
  ai_methodology        TEXT,
  ai_summary            TEXT,
  integrity_score       INTEGER CHECK (integrity_score >= 0 AND integrity_score <= 100),
  integrity_flags       JSONB DEFAULT '[]'::jsonb,
  cross_validation      JSONB DEFAULT '{}'::jsonb,
  signature_detected    BOOLEAN DEFAULT FALSE,
  signature_signer_name TEXT,
  metadata_analysis     JSONB DEFAULT '{}'::jsonb,
  duplicate_of          UUID REFERENCES public.valuation_documents(id),
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'passed', 'flagged', 'rejected')),
  uploaded_by           UUID REFERENCES public.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.valuation_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "val_docs_select_authenticated" ON public.valuation_documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "val_docs_insert_own" ON public.valuation_documents
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "val_docs_admin_all" ON public.valuation_documents
  FOR ALL USING (public.is_admin());

-- ============================================================
-- 5. Investor holdings: allow upsert for own wallet addresses
-- ============================================================
CREATE POLICY "holdings_upsert_own" ON public.investor_holdings
  FOR INSERT WITH CHECK (
    wallet_address IN (
      SELECT address FROM public.wallets WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "holdings_update_own" ON public.investor_holdings
  FOR UPDATE USING (
    wallet_address IN (
      SELECT address FROM public.wallets WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. Distribution insert policy for issuers
-- ============================================================
CREATE POLICY "distributions_insert_auth" ON public.distributions
  FOR INSERT WITH CHECK (triggered_by = auth.uid());

CREATE POLICY "payments_insert_auth" ON public.distribution_payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.distributions d
      WHERE d.id = distribution_id AND d.triggered_by = auth.uid()
    )
  );

-- ============================================================
-- 7. Valuations insert policy for issuers
-- ============================================================
CREATE POLICY "valuations_insert_auth" ON public.valuations
  FOR INSERT WITH CHECK (recorded_by = auth.uid());
