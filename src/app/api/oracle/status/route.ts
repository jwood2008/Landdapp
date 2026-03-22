import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/oracle/status
 * Returns recent oracle runs and payment statistics for admin dashboard.
 */
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Recent runs
  const { data: runs } = await supabase
    .from('oracle_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10)

  // Payment stats
  const { data: paymentStats } = await supabase
    .from('operator_payments')
    .select('status')

  const stats = {
    detected: 0,
    validated: 0,
    distributed: 0,
    flagged: 0,
    ignored: 0,
    total: 0,
  }

  for (const p of paymentStats ?? []) {
    stats.total++
    const s = p.status as keyof typeof stats
    if (s in stats) stats[s]++
  }

  // Recent flagged payments (need review)
  const { data: flagged } = await supabase
    .from('operator_payments')
    .select('id, asset_id, tx_hash, sender_address, amount, currency, match_confidence, flagged_reason, created_at, assets(asset_name)')
    .eq('status', 'flagged')
    .order('created_at', { ascending: false })
    .limit(20)

  // Oracle-enabled assets count
  const { count: oracleAssetCount } = await supabase
    .from('assets')
    .select('id', { count: 'exact', head: true })
    .eq('oracle_method', 'lease_income')

  return NextResponse.json({
    runs: runs ?? [],
    stats,
    flagged: flagged ?? [],
    oracleAssetCount: oracleAssetCount ?? 0,
  })
}
