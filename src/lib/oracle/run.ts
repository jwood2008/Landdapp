/**
 * Oracle Runner — orchestrates the full oracle cycle:
 * 1. Monitor: Scan XRPL for new operator payments
 * 2. Validate: Score payments against lease contracts
 * 3. Distribute: Auto-distribute for validated payments
 *
 * Designed to be called from a cron job or API route.
 */
import { createClient } from '@supabase/supabase-js'
import { getOracleAssets, scanAssetWallet, insertDetectedPayments } from './monitor'
import { validatePayments } from './validate'
import { distributeValidatedPayments } from './distribute'

export interface OracleRunResult {
  runId: string
  assetsChecked: number
  paymentsDetected: number
  validated: number
  autoApproved: number
  flagged: number
  distributionsTriggered: number
  errors: number
  log: Record<string, unknown>[]
}

/**
 * Execute a full oracle run.
 * Uses service role key for full DB access.
 */
export async function executeOracleRun(): Promise<OracleRunResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Create run record
  const { data: run } = await supabase
    .from('oracle_runs')
    .insert({ status: 'running' })
    .select()
    .single()

  const runId = run?.id ?? 'unknown'
  const log: Record<string, unknown>[] = []
  let totalDetected = 0
  let totalErrors = 0

  try {
    // ── Phase 1: Monitor ──
    const assets = await getOracleAssets(supabase)
    log.push({ phase: 'monitor', assetsFound: assets.length })

    for (const asset of assets) {
      try {
        const detected = await scanAssetWallet(supabase, asset)
        if (detected.length > 0) {
          const inserted = await insertDetectedPayments(supabase, detected)
          totalDetected += inserted
          log.push({
            phase: 'monitor',
            asset: asset.asset_name,
            detected: inserted,
          })
        }
      } catch (err) {
        totalErrors++
        log.push({
          phase: 'monitor',
          asset: asset.asset_name,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    // ── Phase 2: Validate ──
    let validationResult = { validated: 0, autoApproved: 0, flagged: 0 }
    try {
      validationResult = await validatePayments(supabase)
      log.push({ phase: 'validate', ...validationResult })
    } catch (err) {
      totalErrors++
      log.push({
        phase: 'validate',
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }

    // ── Phase 3: Distribute ──
    let distributeResult = { distributed: 0, failed: 0, skipped: 0 }
    try {
      distributeResult = await distributeValidatedPayments(supabase)
      log.push({ phase: 'distribute', ...distributeResult })
    } catch (err) {
      totalErrors++
      log.push({
        phase: 'distribute',
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }

    // Update run record
    const result: OracleRunResult = {
      runId,
      assetsChecked: assets.length,
      paymentsDetected: totalDetected,
      validated: validationResult.validated,
      autoApproved: validationResult.autoApproved,
      flagged: validationResult.flagged,
      distributionsTriggered: distributeResult.distributed,
      errors: totalErrors + distributeResult.failed,
      log,
    }

    await supabase
      .from('oracle_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        assets_checked: result.assetsChecked,
        payments_detected: result.paymentsDetected,
        distributions_triggered: result.distributionsTriggered,
        errors: result.errors,
        log: result.log,
      })
      .eq('id', runId)

    console.warn(
      `[oracle] Run ${runId} completed: ${result.assetsChecked} assets, ` +
      `${result.paymentsDetected} payments detected, ${result.autoApproved} auto-approved, ` +
      `${result.distributionsTriggered} distributions triggered, ${result.errors} errors`
    )

    return result
  } catch (err) {
    // Fatal error — mark run as failed
    await supabase
      .from('oracle_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        errors: totalErrors + 1,
        log: [...log, { phase: 'fatal', error: err instanceof Error ? err.message : 'Unknown' }],
      })
      .eq('id', runId)

    throw err
  }
}
