import { NextResponse } from 'next/server'
import { executeOracleRun } from '@/lib/oracle/run'

/**
 * POST /api/oracle/run
 *
 * Triggers a full oracle cycle: monitor → validate → distribute.
 * Protected by a secret key (for cron jobs) or admin auth.
 */
export async function POST(req: Request) {
  // Auth: either ORACLE_SECRET header (for cron) or admin session
  const oracleSecret = req.headers.get('x-oracle-secret')
  const expectedSecret = process.env.ORACLE_SECRET

  if (expectedSecret && oracleSecret === expectedSecret) {
    // Cron/webhook auth — proceed
  } else {
    // Fall back to admin auth
    const { requireAdmin } = await import('@/lib/api-auth')
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error
  }

  try {
    const result = await executeOracleRun()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/oracle/run]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Oracle run failed' },
      { status: 500 }
    )
  }
}
