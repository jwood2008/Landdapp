/**
 * Oracle Auto-Distribution Engine — triggers distributions for validated payments.
 *
 * For each validated + auto_approved payment that hasn't been distributed:
 * 1. Checks the asset has auto_distribute enabled
 * 2. Reuses the existing distribution logic (contract → calculate → pay holders)
 * 3. Links the distribution back to the operator_payment
 */
import { SupabaseClient } from '@supabase/supabase-js'
import { decryptSeed } from '@/lib/crypto/wallet-encryption'
import { buildPaymentAmount } from '@/lib/xrpl/amount'
import { xrplSignAndSubmit } from '@/lib/xrpl/rpc'

interface ValidatedPayment {
  id: string
  asset_id: string
  amount: number
  currency: string
  tx_hash: string
}

/**
 * Distribute funds for all validated, auto-approved payments that haven't been distributed yet.
 */
export async function distributeValidatedPayments(
  supabase: SupabaseClient
): Promise<{ distributed: number; failed: number; skipped: number }> {
  // Fetch validated payments not yet distributed
  const { data: payments, error } = await supabase
    .from('operator_payments')
    .select('id, asset_id, amount, currency, tx_hash')
    .eq('status', 'validated')
    .is('distribution_id', null)
    .limit(20)

  if (error) throw new Error(`Failed to fetch validated payments: ${error.message}`)
  if (!payments || payments.length === 0) return { distributed: 0, failed: 0, skipped: 0 }

  let distributed = 0
  let failed = 0
  let skipped = 0

  for (const payment of payments) {
    try {
      const result = await distributeForPayment(supabase, payment)
      if (result === 'distributed') distributed++
      else if (result === 'skipped') skipped++
      else failed++
    } catch (err) {
      console.error(`[oracle-distribute] Error for payment ${payment.id}:`, err)
      failed++
    }
  }

  return { distributed, failed, skipped }
}

async function distributeForPayment(
  supabase: SupabaseClient,
  payment: ValidatedPayment
): Promise<'distributed' | 'failed' | 'skipped'> {
  // 1. Fetch asset + check auto_distribute
  const { data: asset } = await supabase
    .from('assets')
    .select('id, asset_name, token_symbol, issuer_wallet, oracle_config, owner_retained_percent')
    .eq('id', payment.asset_id)
    .single()

  if (!asset) return 'failed'

  const config = asset.oracle_config as { auto_distribute?: boolean } | null
  if (!config?.auto_distribute) {
    // Mark as flagged — needs manual distribution
    await supabase
      .from('operator_payments')
      .update({ status: 'flagged', flagged_reason: 'auto_distribute is disabled for this asset' })
      .eq('id', payment.id)
    return 'skipped'
  }

  // 2. Fetch active contract
  const { data: contract } = await supabase
    .from('asset_contracts')
    .select('id, annual_amount, payment_frequency, currency, file_name')
    .eq('asset_id', payment.asset_id)
    .eq('is_active', true)
    .single()

  if (!contract) return 'failed'

  // 3. Fetch custodial wallet for signing
  const { data: issuerWallet } = await supabase
    .from('custodial_wallets')
    .select('id, address, encrypted_seed')
    .eq('address', asset.issuer_wallet)
    .eq('is_primary', true)
    .single()

  if (!issuerWallet) {
    await supabase
      .from('operator_payments')
      .update({ status: 'flagged', flagged_reason: 'No custodial wallet for signing' })
      .eq('id', payment.id)
    return 'failed'
  }

  // 4. Use the actual received amount for distribution (not contract amount)
  const totalPayout = payment.amount
  const ownerRetainedPct = Number(asset.owner_retained_percent ?? 0)
  const ownerRetainedAmount = Math.round(totalPayout * (ownerRetainedPct / 100) * 100) / 100
  const investorPayout = Math.round((totalPayout - ownerRetainedAmount) * 100) / 100
  const reserveAmount = Math.round(investorPayout * 0.10 * 100) / 100
  const distributableAmount = Math.round((investorPayout - reserveAmount) * 100) / 100

  // 5. Fetch token holders
  const { data: holders } = await supabase
    .from('investor_holdings')
    .select('wallet_address, ownership_percent, token_balance')
    .eq('asset_id', payment.asset_id)
    .gt('token_balance', 0)

  if (!holders || holders.length === 0) {
    await supabase
      .from('operator_payments')
      .update({ status: 'flagged', flagged_reason: 'No token holders found' })
      .eq('id', payment.id)
    return 'failed'
  }

  // 6. Create distribution record
  const now = new Date()
  const currentQuarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`
  const royaltyPeriod = `${currentQuarter} ${now.getFullYear()} (Oracle)`

  const { data: distribution, error: distErr } = await supabase
    .from('distributions')
    .insert({
      asset_id: payment.asset_id,
      event_type: 'LEASE',
      total_amount: totalPayout,
      currency: payment.currency,
      reserve_amount: reserveAmount,
      distributable_amount: distributableAmount,
      status: 'processing',
      is_royalty: true,
      royalty_period: royaltyPeriod,
      triggered_by_type: 'oracle',
      notes: `Oracle auto-distribution. Operator payment tx: ${payment.tx_hash}. Received $${totalPayout}, distributing $${distributableAmount} to ${holders.length} holders.`,
    })
    .select()
    .single()

  if (distErr || !distribution) {
    console.error('[oracle-distribute] Failed to create distribution:', distErr)
    return 'failed'
  }

  // Link operator payment to distribution
  await supabase
    .from('operator_payments')
    .update({ distribution_id: distribution.id, status: 'distributed' })
    .eq('id', payment.id)

  // 7. Create per-holder payment records
  const paymentRecords = holders.map((h) => ({
    distribution_id: distribution.id,
    wallet_address: h.wallet_address,
    amount: Math.round(distributableAmount * (h.ownership_percent / 100) * 100) / 100,
    currency: payment.currency,
    ownership_percent: h.ownership_percent,
    status: 'pending' as const,
  }))

  const { data: insertedPayments, error: payErr } = await supabase
    .from('distribution_payments')
    .insert(paymentRecords)
    .select()

  if (payErr || !insertedPayments) {
    console.error('[oracle-distribute] Failed to create payments:', payErr)
    await supabase.from('distributions').update({ status: 'failed' }).eq('id', distribution.id)
    return 'failed'
  }

  // 8. Execute XRPL payments
  const seed = decryptSeed(issuerWallet.encrypted_seed)
  let allSuccess = true

  for (const pmt of insertedPayments) {
    if (pmt.amount <= 0) continue

    try {
      await supabase.from('distribution_payments').update({ status: 'processing' }).eq('id', pmt.id)

      const amount = buildPaymentAmount(pmt.currency, String(pmt.amount), issuerWallet.address)
      const result = await xrplSignAndSubmit(seed, {
        TransactionType: 'Payment',
        Account: issuerWallet.address,
        Destination: pmt.wallet_address,
        Amount: amount,
      })

      if (result.success) {
        await supabase
          .from('distribution_payments')
          .update({ status: 'completed', tx_hash: result.hash, completed_at: new Date().toISOString() })
          .eq('id', pmt.id)
      } else {
        allSuccess = false
        await supabase.from('distribution_payments').update({ status: 'failed' }).eq('id', pmt.id)
      }
    } catch {
      allSuccess = false
      await supabase.from('distribution_payments').update({ status: 'failed' }).eq('id', pmt.id)
    }
  }

  // 9. Finalize distribution
  await supabase
    .from('distributions')
    .update({
      status: allSuccess ? 'completed' : 'failed',
      completed_at: allSuccess ? new Date().toISOString() : null,
    })
    .eq('id', distribution.id)

  if (allSuccess) {
    await supabase
      .from('assets')
      .update({ last_distribution_at: new Date().toISOString() })
      .eq('id', payment.asset_id)
  }

  console.warn(
    `[AUDIT] Oracle auto-distributed for asset ${asset.asset_name}. ` +
    `Distribution ${distribution.id}: $${distributableAmount} → ${holders.length} holders. ` +
    `Triggered by payment ${payment.tx_hash}. Status: ${allSuccess ? 'completed' : 'partial_failure'}`
  )

  return allSuccess ? 'distributed' : 'failed'
}
