-- =============================================
-- Migration: App Rebuild for Investor/Issuer model
-- =============================================

-- 1. Add land-specific and royalty fields to assets
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS royalty_frequency text DEFAULT 'quarterly' CHECK (royalty_frequency IN ('monthly', 'quarterly', 'semi_annual', 'annual')),
  ADD COLUMN IF NOT EXISTS ai_rating numeric(3,1),
  ADD COLUMN IF NOT EXISTS ai_rating_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS land_type text,
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS parcel_id text,
  ADD COLUMN IF NOT EXISTS zoning text,
  ADD COLUMN IF NOT EXISTS legal_description text,
  ADD COLUMN IF NOT EXISTS purchase_price numeric(15,2),
  ADD COLUMN IF NOT EXISTS purchase_date date,
  ADD COLUMN IF NOT EXISTS cover_image_url text;

-- 2. Issuer quarterly updates
CREATE TABLE IF NOT EXISTS public.issuer_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  issuer_id uuid NOT NULL REFERENCES public.users(id),
  title text NOT NULL,
  content text NOT NULL,
  quarter text NOT NULL,
  documents jsonb DEFAULT '[]'::jsonb,
  ai_analysis text,
  ai_rating numeric(3,1),
  ai_sentiment text CHECK (ai_sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issuer_updates_asset ON public.issuer_updates(asset_id);
CREATE INDEX IF NOT EXISTS idx_issuer_updates_issuer ON public.issuer_updates(issuer_id);
CREATE INDEX IF NOT EXISTS idx_issuer_updates_quarter ON public.issuer_updates(quarter);

-- 3. Asset documents (legal filings, deeds, etc.)
CREATE TABLE IF NOT EXISTS public.asset_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('legal_filing', 'llc_operating_agreement', 'deed', 'appraisal', 'survey', 'environmental', 'title_insurance', 'other')),
  title text NOT NULL,
  file_name text NOT NULL,
  file_url text,
  file_size integer,
  uploaded_by uuid REFERENCES public.users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_documents_asset ON public.asset_documents(asset_id);

-- 4. Royalty configuration per asset (maps to distribution system)
ALTER TABLE public.distributions
  ADD COLUMN IF NOT EXISTS royalty_period text,
  ADD COLUMN IF NOT EXISTS is_royalty boolean DEFAULT true;

-- 5. RLS policies for new tables
ALTER TABLE public.issuer_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Issuers can manage their own updates"
  ON public.issuer_updates FOR ALL
  USING (issuer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (issuer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Anyone can read published updates"
  ON public.issuer_updates FOR SELECT
  USING (published = true);

CREATE POLICY "Admins and owners manage asset documents"
  ON public.asset_documents FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.assets WHERE id = asset_id AND owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.assets WHERE id = asset_id AND owner_id = auth.uid())
  );

CREATE POLICY "Authenticated users can read asset documents"
  ON public.asset_documents FOR SELECT
  USING (auth.uid() IS NOT NULL);
