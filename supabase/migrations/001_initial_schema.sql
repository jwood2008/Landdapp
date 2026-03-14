-- ============================================================
-- RWA Tokenization Platform - Initial Schema
-- ============================================================

-- Enums
CREATE TYPE asset_type AS ENUM (
  'land',
  'real_estate',
  'aircraft',
  'vessel',
  'energy',
  'private_credit',
  'infrastructure'
);

CREATE TYPE event_type AS ENUM ('VALUATION', 'LEASE', 'REFINANCE');
CREATE TYPE user_role AS ENUM ('investor', 'admin');
CREATE TYPE distribution_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ============================================================
-- USERS
-- Extends Supabase auth.users with profile data
-- ============================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'investor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- WALLETS
-- XRPL wallet addresses linked to user accounts
-- ============================================================
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL UNIQUE,
  label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure only one primary wallet per user
CREATE UNIQUE INDEX wallets_primary_unique
  ON public.wallets (user_id)
  WHERE is_primary = TRUE;

-- ============================================================
-- ASSETS
-- Tokenized real-world assets (land, aircraft, etc.)
-- ============================================================
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name TEXT NOT NULL,
  asset_type asset_type NOT NULL DEFAULT 'land',
  llc_name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  total_acres NUMERIC,
  token_symbol TEXT NOT NULL,
  token_supply BIGINT NOT NULL,
  issuer_wallet TEXT NOT NULL,
  current_valuation NUMERIC NOT NULL DEFAULT 0,
  nav_per_token NUMERIC NOT NULL DEFAULT 0,
  annual_yield NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- INVESTOR HOLDINGS
-- Cached snapshot of on-chain token balances per wallet/asset
-- ============================================================
CREATE TABLE public.investor_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  token_balance NUMERIC NOT NULL DEFAULT 0,
  ownership_percent NUMERIC NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet_address, asset_id)
);

-- ============================================================
-- VALUATIONS
-- Oracle-driven valuation event log
-- ============================================================
CREATE TABLE public.valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  event_type event_type NOT NULL,
  previous_value NUMERIC NOT NULL,
  current_value NUMERIC NOT NULL,
  nav_per_token NUMERIC NOT NULL,
  notes TEXT,
  recorded_by UUID REFERENCES public.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DISTRIBUTIONS
-- Distribution events (lease income, refinance proceeds)
-- ============================================================
CREATE TABLE public.distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  event_type event_type NOT NULL,
  total_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XRP',
  reserve_amount NUMERIC NOT NULL DEFAULT 0,
  distributable_amount NUMERIC NOT NULL,
  status distribution_status NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  notes TEXT,
  triggered_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- DISTRIBUTION PAYMENTS
-- Per-investor payment records within a distribution
-- ============================================================
CREATE TABLE public.distribution_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES public.distributions(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XRP',
  ownership_percent NUMERIC NOT NULL,
  status distribution_status NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_payments ENABLE ROW LEVEL SECURITY;

-- users: can read/update own profile
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- admins can read all users
CREATE POLICY "users_admin_all" ON public.users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- wallets: own wallets only
CREATE POLICY "wallets_select_own" ON public.wallets
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "wallets_insert_own" ON public.wallets
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "wallets_update_own" ON public.wallets
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "wallets_delete_own" ON public.wallets
  FOR DELETE USING (user_id = auth.uid());

-- assets: all authenticated users can read active assets
CREATE POLICY "assets_select_authenticated" ON public.assets
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);
CREATE POLICY "assets_admin_all" ON public.assets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- investor_holdings: can see holdings for own wallets
CREATE POLICY "holdings_select_own" ON public.investor_holdings
  FOR SELECT USING (
    wallet_address IN (
      SELECT address FROM public.wallets WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "holdings_admin_all" ON public.investor_holdings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- valuations: all authenticated can read
CREATE POLICY "valuations_select_authenticated" ON public.valuations
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "valuations_admin_all" ON public.valuations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- distributions: all authenticated can read
CREATE POLICY "distributions_select_authenticated" ON public.distributions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "distributions_admin_all" ON public.distributions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- distribution_payments: own wallet payments only
CREATE POLICY "payments_select_own" ON public.distribution_payments
  FOR SELECT USING (
    wallet_address IN (
      SELECT address FROM public.wallets WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "payments_admin_all" ON public.distribution_payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- SEED: Example Asset (WOD token - Wood Land Holdings)
-- ============================================================
INSERT INTO public.assets (
  asset_name,
  asset_type,
  llc_name,
  description,
  location,
  total_acres,
  token_symbol,
  token_supply,
  issuer_wallet,
  current_valuation,
  nav_per_token,
  annual_yield
) VALUES (
  'Wood Land Holdings',
  'land',
  'Wood Land Holdings LLC',
  '200 acres of prime agricultural and investment land tokenized as fractional LLC membership.',
  'United States',
  200,
  'WOD',
  1000000,
  'rISSUER_WALLET_ADDRESS_HERE',
  6000000,
  6.00,
  8.0
);
