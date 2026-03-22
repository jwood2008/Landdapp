-- ═══════════════════════════════════════════════════════════
-- Asset Leases — links a user to an asset as tenant
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS asset_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tenant_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_rent numeric NOT NULL,
  due_day integer NOT NULL DEFAULT 1 CHECK (due_day >= 1 AND due_day <= 28),
  lease_start_date date NOT NULL,
  lease_end_date date,
  security_deposit numeric DEFAULT 0,
  escalation_rate numeric DEFAULT 0,
  escalation_type text CHECK (escalation_type IN ('annual_percent', 'fixed', 'cpi')),
  property_unit text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'ended', 'terminated')),
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_leases_unique_active
  ON asset_leases(asset_id, tenant_user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_asset_leases_tenant ON asset_leases(tenant_user_id);
CREATE INDEX IF NOT EXISTS idx_asset_leases_asset ON asset_leases(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_leases_status ON asset_leases(status);

-- ═══════════════════════════════════════════════════════════
-- Lease Payments — each rent payment record
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lease_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES asset_leases(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tenant_user_id uuid NOT NULL REFERENCES auth.users(id),
  due_date date NOT NULL,
  amount_due numeric NOT NULL,
  amount_paid numeric,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'processing', 'paid', 'late', 'failed', 'waived')),
  payment_method text CHECK (payment_method IN ('platform', 'manual')),
  xrp_amount numeric,
  xrp_price_at_payment numeric,
  xrpl_tx_hash text,
  operator_payment_id uuid,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lease_payments_lease ON lease_payments(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_payments_tenant ON lease_payments(tenant_user_id);
CREATE INDEX IF NOT EXISTS idx_lease_payments_status ON lease_payments(status);
CREATE INDEX IF NOT EXISTS idx_lease_payments_due_date ON lease_payments(due_date);

-- RLS
ALTER TABLE asset_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_leases" ON asset_leases
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
CREATE POLICY "admin_all_lease_payments" ON lease_payments
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
CREATE POLICY "tenant_read_own_leases" ON asset_leases
  FOR SELECT USING (tenant_user_id = auth.uid());
CREATE POLICY "tenant_read_own_payments" ON lease_payments
  FOR SELECT USING (tenant_user_id = auth.uid());
CREATE POLICY "tenant_update_own_payments" ON lease_payments
  FOR UPDATE USING (tenant_user_id = auth.uid());
CREATE POLICY "issuer_manage_leases" ON asset_leases
  FOR ALL USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_leases.asset_id AND assets.owner_id = auth.uid()));
CREATE POLICY "issuer_manage_lease_payments" ON lease_payments
  FOR ALL USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = lease_payments.asset_id AND assets.owner_id = auth.uid()));

-- RPC: Generate upcoming lease payment records
CREATE OR REPLACE FUNCTION generate_lease_payments(p_lease_id uuid, p_months_ahead integer DEFAULT 6)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lease asset_leases%ROWTYPE;
  v_month date;
  v_end date;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_lease FROM asset_leases WHERE id = p_lease_id AND status = 'active';
  IF NOT FOUND THEN RETURN 0; END IF;
  v_month := GREATEST(date_trunc('month', v_lease.lease_start_date)::date, date_trunc('month', CURRENT_DATE)::date);
  v_end := LEAST(
    COALESCE(v_lease.lease_end_date, CURRENT_DATE + (p_months_ahead || ' months')::interval),
    CURRENT_DATE + (p_months_ahead || ' months')::interval
  )::date;
  WHILE v_month <= v_end LOOP
    INSERT INTO lease_payments (lease_id, asset_id, tenant_user_id, due_date, amount_due, currency, status)
    SELECT v_lease.id, v_lease.asset_id, v_lease.tenant_user_id,
      (v_month + ((v_lease.due_day - 1) || ' days')::interval)::date,
      v_lease.monthly_rent, 'USD',
      CASE WHEN (v_month + ((v_lease.due_day - 1) || ' days')::interval)::date < CURRENT_DATE THEN 'late' ELSE 'due' END
    WHERE NOT EXISTS (
      SELECT 1 FROM lease_payments lp WHERE lp.lease_id = v_lease.id AND date_trunc('month', lp.due_date) = date_trunc('month', v_month)
    );
    IF FOUND THEN v_count := v_count + 1; END IF;
    v_month := v_month + '1 month'::interval;
  END LOOP;
  RETURN v_count;
END;
$$;
