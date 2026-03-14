-- Add owner_retained_percent to assets table
-- Tracks the % of tokens the property owner retains (not issued to marketplace)
-- When the owner wants to sell, admin issues those tokens to marketplace

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS owner_retained_percent numeric DEFAULT 0 CHECK (owner_retained_percent >= 0 AND owner_retained_percent <= 100);

COMMENT ON COLUMN assets.owner_retained_percent IS 'Percentage of total token supply retained by the property owner (not issued to investors). Owner sells by having admin issue these tokens to marketplace.';
