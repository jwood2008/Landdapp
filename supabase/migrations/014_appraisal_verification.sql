ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS third_party_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS third_party_appraisal_date date,
  ADD COLUMN IF NOT EXISTS third_party_appraiser_name text;

DO $$
BEGIN
  ALTER TABLE asset_documents DROP CONSTRAINT IF EXISTS asset_documents_document_type_check;
  ALTER TABLE asset_documents ADD CONSTRAINT asset_documents_document_type_check
    CHECK (document_type IN ('legal_filing', 'llc_operating_agreement', 'deed', 'appraisal', 'survey', 'environmental', 'title_insurance', 'third_party_appraisal', 'other'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
