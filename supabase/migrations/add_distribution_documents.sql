-- Distribution supporting documents (Level 1 Oracle proof)
-- Run in Supabase SQL editor

-- 1. Table to track uploaded documents per distribution
CREATE TABLE IF NOT EXISTS public.distribution_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id  uuid NOT NULL REFERENCES public.distributions(id) ON DELETE CASCADE,
  file_name        text NOT NULL,
  file_path        text NOT NULL,   -- storage path: distributions/{distribution_id}/{filename}
  file_size        integer,
  mime_type        text,
  uploaded_by      uuid REFERENCES public.users(id),
  created_at       timestamptz DEFAULT now()
);

-- 2. RLS
ALTER TABLE public.distribution_documents ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read documents for distributions on assets they hold
CREATE POLICY "docs_select_authenticated" ON public.distribution_documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only the uploader (issuer) can insert
CREATE POLICY "docs_insert_own" ON public.distribution_documents
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- Admins can do anything
CREATE POLICY "docs_admin_all" ON public.distribution_documents
  FOR ALL USING (public.is_admin());

-- 3. Storage bucket (run this separately in Supabase dashboard Storage section
--    OR via the Supabase management API — SQL cannot create storage buckets directly)
--
-- Bucket name: distribution-docs
-- Public: false (private, signed URLs only)
-- Allowed MIME types: application/pdf, image/jpeg, image/png, image/webp
-- Max file size: 10MB
--
-- Storage RLS policy to add in dashboard:
--   INSERT: auth.uid() IS NOT NULL
--   SELECT: auth.uid() IS NOT NULL
