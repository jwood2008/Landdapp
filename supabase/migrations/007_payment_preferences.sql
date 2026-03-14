-- Payment preference: how investors want to receive funds
-- Default is 'USD' (mapped to RLUSD on-chain)
ALTER TABLE platform_investors
  ADD COLUMN IF NOT EXISTS receive_currency TEXT NOT NULL DEFAULT 'USD'
  CHECK (receive_currency IN ('USD', 'XRP'));

COMMENT ON COLUMN platform_investors.receive_currency IS
  'Preferred receive currency. USD = RLUSD stablecoin on-chain. XRP = native XRP.';
