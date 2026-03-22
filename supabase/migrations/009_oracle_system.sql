-- ============================================================
-- Oracle System: Autonomous XRPL payment monitoring & auto-distribution
-- ============================================================

-- 1. Operator payments detected on XRPL
create table if not exists operator_payments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  tx_hash text not null unique,
  sender_address text not null,
  destination_address text not null,
  amount numeric not null,
  currency text not null default 'RLUSD',
  ledger_index bigint,
  tx_date timestamptz,
  -- Matching
  matched boolean not null default false,
  matched_contract_id uuid references asset_contracts(id),
  match_confidence numeric, -- 0-100
  match_notes text,
  -- Processing
  distribution_id uuid references distributions(id),
  status text not null default 'detected' check (status in ('detected', 'validated', 'distributed', 'flagged', 'ignored')),
  flagged_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_operator_payments_asset on operator_payments(asset_id);
create index if not exists idx_operator_payments_status on operator_payments(status);

-- 2. Oracle validation records — AI analysis per payment
create table if not exists oracle_validations (
  id uuid primary key default gen_random_uuid(),
  operator_payment_id uuid not null references operator_payments(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  -- Expected vs actual
  expected_amount numeric,
  actual_amount numeric not null,
  expected_currency text,
  expected_sender text,
  actual_sender text not null,
  -- AI analysis
  confidence_score numeric not null default 0, -- 0-100
  ai_reasoning text,
  public_data_used jsonb, -- sources the AI checked (state production, commodity prices, etc.)
  -- Outcome
  auto_approved boolean not null default false,
  requires_review boolean not null default false,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now()
);

-- 3. Oracle run log — each cron execution
create table if not exists oracle_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  assets_checked integer not null default 0,
  payments_detected integer not null default 0,
  distributions_triggered integer not null default 0,
  errors integer not null default 0,
  log jsonb, -- detailed per-asset results
  status text not null default 'running' check (status in ('running', 'completed', 'failed'))
);

-- 4. Extend oracle_config with operator wallet info
-- oracle_config JSONB on assets table will store:
-- {
--   "operator_wallets": ["rAddress1", "rAddress2"],
--   "auto_distribute": true,
--   "confidence_threshold": 90,
--   "last_checked_ledger": 12345678,
--   "last_checked_tx": "hash..."
-- }

-- 5. Add triggered_by_type to distributions to distinguish oracle vs manual
alter table distributions
  add column if not exists triggered_by_type text default 'manual'
  check (triggered_by_type in ('manual', 'oracle', 'admin'));

-- 6. RLS policies
alter table operator_payments enable row level security;
alter table oracle_validations enable row level security;
alter table oracle_runs enable row level security;

-- Service role has full access (oracle runs as service role)
-- Issuers can read their own asset's oracle data
create policy "Issuers can view operator payments for their assets"
  on operator_payments for select
  using (
    asset_id in (
      select id from assets where owner_id = auth.uid()
    )
  );

create policy "Issuers can view oracle validations for their assets"
  on oracle_validations for select
  using (
    asset_id in (
      select id from assets where owner_id = auth.uid()
    )
  );

-- Admins can view all oracle runs (handled by service role in practice)
create policy "Authenticated users can view oracle runs"
  on oracle_runs for select
  using (auth.role() = 'authenticated');
