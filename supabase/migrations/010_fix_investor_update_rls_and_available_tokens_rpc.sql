-- Fix 1: Allow investors to UPDATE their own record (for payment preference)
-- This was missing, causing settings to silently fail to save.
CREATE POLICY "Investors update own record"
  ON platform_investors
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Fix 2: Create get_available_tokens RPC function
-- Calculates available tokens per asset: token_supply - owner_retained - SUM(investor_holdings)
-- Uses SECURITY DEFINER to bypass RLS and see all holdings across all investors.
CREATE OR REPLACE FUNCTION get_available_tokens()
RETURNS TABLE(asset_id uuid, available_tokens numeric)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    a.id AS asset_id,
    GREATEST(
      0,
      a.token_supply
        - FLOOR(COALESCE(a.owner_retained_percent, 0) / 100.0 * a.token_supply)
        - COALESCE(h.total_held, 0)
    ) AS available_tokens
  FROM assets a
  LEFT JOIN (
    SELECT ih.asset_id, SUM(ih.token_balance) AS total_held
    FROM investor_holdings ih
    GROUP BY ih.asset_id
  ) h ON h.asset_id = a.id
  WHERE a.is_active = true;
$$;
