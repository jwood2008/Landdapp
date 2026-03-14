-- Add wallet_type to distinguish token (asset issuer) wallets from investor wallets
ALTER TABLE custodial_wallets
  ADD COLUMN IF NOT EXISTS wallet_type text NOT NULL DEFAULT 'investor' CHECK (wallet_type IN ('investor', 'token')),
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS label text;

-- Allow token wallets to have no user_id
ALTER TABLE custodial_wallets ALTER COLUMN user_id DROP NOT NULL;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_custodial_wallets_wallet_type ON custodial_wallets(wallet_type);
CREATE INDEX IF NOT EXISTS idx_custodial_wallets_asset_id ON custodial_wallets(asset_id) WHERE asset_id IS NOT NULL;

COMMENT ON COLUMN custodial_wallets.wallet_type IS 'investor = created for an investor user, token = created as an asset issuer wallet';
COMMENT ON COLUMN custodial_wallets.asset_id IS 'For token wallets, the asset this wallet issues tokens for';
COMMENT ON COLUMN custodial_wallets.label IS 'Optional display label for the wallet';
