/**
 * XRPL Transaction Monitor — scans LLC wallets for incoming operator payments.
 *
 * For each oracle-enabled asset:
 * 1. Calls account_tx on the asset's issuer_wallet
 * 2. Filters for incoming Payment txns from configured operator wallets
 * 3. Deduplicates against existing operator_payments (by tx_hash)
 * 4. Inserts new detections into operator_payments table
 */
import { xrplRpc } from '@/lib/xrpl/rpc'
import { SupabaseClient } from '@supabase/supabase-js'

export interface OracleAsset {
  id: string
  asset_name: string
  token_symbol: string
  issuer_wallet: string
  oracle_method: string
  oracle_config: {
    operator_wallets: string[]
    auto_distribute: boolean
    confidence_threshold: number
    last_checked_ledger?: number
    last_checked_tx?: string
  }
}

export interface DetectedPayment {
  asset_id: string
  tx_hash: string
  sender_address: string
  destination_address: string
  amount: number
  currency: string
  ledger_index: number
  tx_date: string
}

/**
 * Fetch all oracle-enabled assets with their config.
 */
export async function getOracleAssets(supabase: SupabaseClient): Promise<OracleAsset[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('id, asset_name, token_symbol, issuer_wallet, oracle_method, oracle_config')
    .eq('oracle_method', 'lease_income')
    .not('oracle_config', 'is', null)

  if (error) throw new Error(`Failed to fetch oracle assets: ${error.message}`)

  // Filter to only assets that have operator_wallets configured
  return (data ?? []).filter(
    (a) => a.oracle_config?.operator_wallets?.length > 0
  ) as OracleAsset[]
}

/**
 * Parse an XRPL Amount field into { amount: number, currency: string }.
 * XRP amounts are in drops (string), IOUs are { currency, value, issuer }.
 */
function parseXrplAmount(amount: unknown): { amount: number; currency: string } {
  if (typeof amount === 'string') {
    // XRP in drops
    return { amount: Number(amount) / 1_000_000, currency: 'XRP' }
  }
  if (typeof amount === 'object' && amount !== null) {
    const iou = amount as { currency: string; value: string; issuer: string }
    // Decode RLUSD hex
    const currency = iou.currency === '524C555344000000000000000000000000000000'
      ? 'RLUSD'
      : iou.currency
    return { amount: Number(iou.value), currency }
  }
  return { amount: 0, currency: 'UNKNOWN' }
}

/**
 * Convert XRPL ripple epoch timestamp to ISO string.
 * Ripple epoch starts 2000-01-01T00:00:00Z (946684800 unix seconds).
 */
function rippleTimeToISO(rippleTime: number): string {
  const unixMs = (rippleTime + 946684800) * 1000
  return new Date(unixMs).toISOString()
}

/**
 * Scan a single asset's issuer wallet for incoming payments from operator wallets.
 * Returns newly detected payments (not yet in DB).
 */
export async function scanAssetWallet(
  supabase: SupabaseClient,
  asset: OracleAsset
): Promise<DetectedPayment[]> {
  const operatorSet = new Set(asset.oracle_config.operator_wallets.map((w) => w.toLowerCase()))
  const minLedger = asset.oracle_config.last_checked_ledger ?? -1

  // Fetch recent transactions for the issuer wallet
  const params: Record<string, unknown> = {
    account: asset.issuer_wallet,
    ledger_index_min: minLedger > 0 ? minLedger : -1,
    limit: 200,
    forward: true,
  }

  const response = await xrplRpc('account_tx', [params])
  const result = response.result as Record<string, unknown>
  const transactions = (result?.transactions ?? []) as Array<{
    tx: Record<string, unknown>
    meta: Record<string, unknown>
    validated: boolean
  }>

  if (transactions.length === 0) return []

  // Get existing tx hashes to deduplicate
  const txHashes = transactions.map((t) => t.tx?.hash as string).filter(Boolean)
  const { data: existing } = await supabase
    .from('operator_payments')
    .select('tx_hash')
    .in('tx_hash', txHashes)

  const existingSet = new Set((existing ?? []).map((e) => e.tx_hash))

  const detected: DetectedPayment[] = []
  let maxLedger = minLedger

  for (const txEntry of transactions) {
    const tx = txEntry.tx
    if (!tx || !txEntry.validated) continue

    // Only process successful Payment transactions
    const txType = tx.TransactionType as string
    const metaResult = (txEntry.meta as Record<string, unknown>)?.TransactionResult as string
    if (txType !== 'Payment' || metaResult !== 'tesSUCCESS') continue

    const hash = tx.hash as string
    const sender = (tx.Account as string)?.toLowerCase()
    const destination = (tx.Destination as string)?.toLowerCase()
    const ledgerIndex = (tx.ledger_index ?? tx.inLedger) as number

    // Must be incoming to the issuer wallet from an operator
    if (destination !== asset.issuer_wallet.toLowerCase()) continue
    if (!operatorSet.has(sender)) continue

    // Skip if already recorded
    if (existingSet.has(hash)) continue

    const { amount, currency } = parseXrplAmount(tx.Amount ?? (tx as Record<string, unknown>).DeliveredAmount)
    const txDate = tx.date ? rippleTimeToISO(tx.date as number) : new Date().toISOString()

    detected.push({
      asset_id: asset.id,
      tx_hash: hash,
      sender_address: tx.Account as string,
      destination_address: tx.Destination as string,
      amount,
      currency,
      ledger_index: ledgerIndex,
      tx_date: txDate,
    })

    if (ledgerIndex > maxLedger) maxLedger = ledgerIndex
  }

  // Update last_checked_ledger on the asset
  if (maxLedger > minLedger) {
    const updatedConfig = { ...asset.oracle_config, last_checked_ledger: maxLedger + 1 }
    await supabase
      .from('assets')
      .update({ oracle_config: updatedConfig })
      .eq('id', asset.id)
  }

  return detected
}

/**
 * Insert detected payments into the operator_payments table.
 */
export async function insertDetectedPayments(
  supabase: SupabaseClient,
  payments: DetectedPayment[]
): Promise<number> {
  if (payments.length === 0) return 0

  const { data, error } = await supabase
    .from('operator_payments')
    .insert(payments)
    .select('id')

  if (error) throw new Error(`Failed to insert operator payments: ${error.message}`)
  return data?.length ?? 0
}
