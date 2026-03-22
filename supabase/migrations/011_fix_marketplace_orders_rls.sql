-- Fix: Allow reading partial and filled orders (needed for secondary market listings + trade history)
DROP POLICY IF EXISTS "All authenticated read open orders" ON marketplace_orders;
CREATE POLICY "All authenticated read active orders"
  ON marketplace_orders
  FOR SELECT
  USING (status IN ('open', 'partial', 'filled') AND auth.uid() IS NOT NULL);
