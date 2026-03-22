import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Cron endpoint: generates upcoming lease payments and marks overdue ones.
 * Intended to be called by Vercel Cron monthly (or more frequently).
 * Auth: requires CRON_SECRET header or admin session.
 */
export async function POST(req: NextRequest) {
  // Verify cron secret
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // 1. Get all active leases
    const { data: activeLeases, error: leaseErr } = await svc
      .from('asset_leases')
      .select('id')
      .eq('status', 'active')

    if (leaseErr) throw new Error(leaseErr.message)

    let generated = 0
    for (const lease of activeLeases ?? []) {
      const { data: count } = await svc.rpc('generate_lease_payments', {
        p_lease_id: lease.id,
        p_months_ahead: 3,
      })
      generated += (count ?? 0)
    }

    // 2. Mark overdue payments
    const today = new Date().toISOString().split('T')[0]
    const { count: overdueCount } = await svc
      .from('lease_payments')
      .update({ status: 'late' })
      .eq('status', 'due')
      .lt('due_date', today)

    return NextResponse.json({
      success: true,
      leasesProcessed: (activeLeases ?? []).length,
      paymentsGenerated: generated,
      paymentsMarkedLate: overdueCount ?? 0,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cron job failed' },
      { status: 500 }
    )
  }
}
