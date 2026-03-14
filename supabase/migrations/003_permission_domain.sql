-- ============================================================
-- Permission Domain Architecture Migration
-- One platform, many tokens, many approved investors
-- ============================================================

-- 1. KYC Status enum
DO $$ BEGIN
  CREATE TYPE kyc_status AS ENUM ('pending', 'submitted', 'verified', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Order side and status enums
DO $$ BEGIN
  CREATE TYPE order_side AS ENUM ('buy', 'sell');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('open', 'partial', 'filled', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE trade_status AS ENUM ('pending', 'settled', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. Platform investors — KYC/AML approved at the PLATFORM level (not per-asset)
CREATE TABLE IF NOT EXISTS platform_investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  wallet_address text NOT NULL UNIQUE,
  full_name text,
  email text,
  kyc_status kyc_status NOT NULL DEFAULT 'pending',
  kyc_provider text,
  kyc_reference text,
  kyc_verified_at timestamptz,
  kyc_expires_at timestamptz,
  aml_cleared boolean NOT NULL DEFAULT false,
  accredited boolean NOT NULL DEFAULT false,
  country_code text,
  notes text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Platform trust line authorizations
CREATE TABLE IF NOT EXISTS platform_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id uuid NOT NULL REFERENCES platform_investors(id),
  asset_id uuid NOT NULL REFERENCES assets(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'revoked')),
  xrpl_tx_hash text,
  authorized_at timestamptz,
  authorized_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(investor_id, asset_id)
);

-- 5. Marketplace orders
CREATE TABLE IF NOT EXISTS marketplace_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id uuid NOT NULL REFERENCES platform_investors(id),
  asset_id uuid NOT NULL REFERENCES assets(id),
  side order_side NOT NULL,
  token_amount numeric NOT NULL CHECK (token_amount > 0),
  price_per_token numeric NOT NULL CHECK (price_per_token > 0),
  currency text NOT NULL DEFAULT 'RLUSD',
  filled_amount numeric NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'open',
  expires_at timestamptz,
  xrpl_offer_id text,
  xrpl_offer_tx text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Trades
CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buy_order_id uuid REFERENCES marketplace_orders(id),
  sell_order_id uuid REFERENCES marketplace_orders(id),
  asset_id uuid NOT NULL REFERENCES assets(id),
  buyer_id uuid NOT NULL REFERENCES platform_investors(id),
  seller_id uuid NOT NULL REFERENCES platform_investors(id),
  token_amount numeric NOT NULL CHECK (token_amount > 0),
  price_per_token numeric NOT NULL,
  total_price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'RLUSD',
  status trade_status NOT NULL DEFAULT 'pending',
  xrpl_tx_hash text,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Platform settings
CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name text NOT NULL DEFAULT 'RWA Platform',
  domain_wallet text,
  require_kyc boolean NOT NULL DEFAULT true,
  require_aml boolean NOT NULL DEFAULT true,
  require_accreditation boolean NOT NULL DEFAULT false,
  auto_authorize_tokens boolean NOT NULL DEFAULT true,
  marketplace_enabled boolean NOT NULL DEFAULT true,
  marketplace_fee_bps integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (platform_name)
SELECT 'RWA Platform'
WHERE NOT EXISTS (SELECT 1 FROM platform_settings);
