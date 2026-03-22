-- Add access_type to assets (default 'public' so existing assets are unaffected)
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'public'
    CHECK (access_type IN ('public', 'private')),
  ADD COLUMN IF NOT EXISTS max_members integer;

-- Invitation table for private assets
CREATE TABLE IF NOT EXISTS asset_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (asset_id, email)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_asset_invitations_asset ON asset_invitations(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_invitations_email ON asset_invitations(email);
CREATE INDEX IF NOT EXISTS idx_asset_invitations_user ON asset_invitations(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_access_type ON assets(access_type);

-- RLS
ALTER TABLE asset_invitations ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "admin_all_invitations" ON asset_invitations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- Issuers can manage invitations for their own assets
CREATE POLICY "issuer_manage_own_invitations" ON asset_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM assets
      WHERE assets.id = asset_invitations.asset_id
        AND assets.owner_id = auth.uid()
    )
  );

-- Investors can see their own invitations
CREATE POLICY "investor_view_own_invitations" ON asset_invitations
  FOR SELECT USING (
    user_id = auth.uid()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
