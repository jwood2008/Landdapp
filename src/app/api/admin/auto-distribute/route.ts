import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { decryptSeed } from '@/lib/crypto/wallet-encryption'
import { buildPaymentAmount } from '@/lib/xrpl/amount'
import { xrplSignAndSubmit } from '@/lib/xrpl/rpc'

/**
 * Auto-distribute royalties for an asset based on its contract terms.
 *
 * 1. Reads the active contract for the asset → gets annual_amount, frequency
 * 2. Calculates the per-period payout amount
 * 3. Fetches all token holders + ownership %
 * 4. Creates a distribution record + per-holder payment records
 * 5. Signs and submits each payment using the issuer's custodial wallet
 *
 * Body: { assetId: string, period?: string }
 * The issuer wallet for the asset must be a custodial wallet.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error
  const { user } = auth

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { assetId, period } = await req.json()
    if (!assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 })
    }

    // 1. Fetch asset
    const { data: asset, error: assetErr } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single()

    if (assetErr || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // 2. Fetch active contract
    const { data: contract, error: contractErr } = await supabase
      .from('asset_contracts')
      .select('*')
      .eq('asset_id', assetId)
      .eq('is_active', true)
      .single()

    if (contractErr || !contract) {
      return NextResponse.json(
        { error: 'No active contract found for this asset. Upload a contract first.' },
        { status: 400 }
      )
    }

    if (!contract.annual_amount || !contract.payment_frequency) {
      return NextResponse.json(
        { error: 'Contract is missing payment terms (annual_amount or payment_frequency). Re-upload or edit.' },
        { status: 400 }
      )
    }

    // 3. Find the issuer's custodial wallet (by matching address)
    const { data: issuerWallet } = await supabase
      .from('custodial_wallets')
      .select('id, address, encrypted_seed, user_id')
      .eq('address', asset.issuer_wallet)
      .eq('is_primary', true)
      .single()

    if (!issuerWallet) {
      return NextResponse.json(
        { error: 'Issuer wallet is not a custodial wallet. Auto-distribution requires a platform-managed issuer wallet.' },
        { status: 400 }
      )
    }

    // 4. Calculate per-period payout
    const annualAmount = Number(contract.annual_amount)
    const frequency = contract.payment_frequency as string
    let periodsPerYear = 1
    let periodLabel = 'Annual'
    if (frequency === 'monthly') { periodsPerYear = 12; periodLabel = 'Monthly' }
    else if (frequency === 'quarterly') { periodsPerYear = 4; periodLabel = 'Quarterly' }
    else if (frequency === 'semi_annual') { periodsPerYear = 2; periodLabel = 'Semi-Annual' }

    const periodAmount = annualAmount / periodsPerYear

    // Apply escalation if applicable
    let adjustedAmount = periodAmount
    if (contract.escalation_rate && contract.escalation_type === 'annual_percent' && contract.lease_start_date) {
      const startYear = new Date(contract.lease_start_date).getFullYear()
      const currentYear = new Date().getFullYear()
      const yearsElapsed = currentYear - startYear
      if (yearsElapsed > 0) {
        const rate = Number(contract.escalation_rate) / 100
        adjustedAmount = periodAmount * Math.pow(1 + rate, yearsElapsed)
      }
    }

    // Round to 2 decimals
    const totalPayout = Math.round(adjustedAmount * 100) / 100

    // Owner's retained share — their portion of the payout is held in reserve
    const ownerRetainedPct = Number(asset.owner_retained_percent ?? 0)
    const ownerRetainedAmount = Math.round(totalPayout * (ownerRetainedPct / 100) * 100) / 100
    const investorPayout = Math.round((totalPayout - ownerRetainedAmount) * 100) / 100

    const reserveAmount = Math.round(investorPayout * 0.10 * 100) / 100
    const distributableAmount = Math.round((investorPayout - reserveAmount) * 100) / 100

    // 5. Fetch token holders
    const { data: holders } = await supabase
      .from('investor_holdings')
      .select('wallet_address, ownership_percent, token_balance')
      .eq('asset_id', assetId)
      .gt('token_balance', 0)

    if (!holders || holders.length === 0) {
      return NextResponse.json({ error: 'No token holders found for this asset' }, { status: 400 })
    }

    // Determine royalty period label
    const now = new Date()
    const currentQuarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`
    const royaltyPeriod = period ?? `${currentQuarter} ${now.getFullYear()} (${periodLabel})`

    // 6. Create distribution record
    const { data: distribution, error: distErr } = await supabase
      .from('distributions')
      .insert({
        asset_id: assetId,
        event_type: 'LEASE',
        total_amount: totalPayout,
        currency: contract.currency ?? 'USD',
        reserve_amount: reserveAmount,
        distributable_amount: distributableAmount,
        status: 'processing',
        is_royalty: true,
        royalty_period: royaltyPeriod,
        triggered_by: user.id,
        notes: `Auto-distribution from contract: ${contract.file_name}. ${periodLabel} payout of $${totalPayout}${ownerRetainedPct > 0 ? ` (owner retains ${ownerRetainedPct}% = $${ownerRetainedAmount})` : ''}, 10% reserve = $${reserveAmount}, distributed = $${distributableAmount}.`,
      })
      .select()
      .single()

    if (distErr || !distribution) {
      return NextResponse.json({ error: `Failed to create distribution: ${distErr?.message}` }, { status: 500 })
    }

    // 7. Create per-holder payment records
    const payments = holders.map((h) => ({
      distribution_id: distribution.id,
      wallet_address: h.wallet_address,
      amount: Math.round(distributableAmount * (h.ownership_percent / 100) * 100) / 100,
      currency: contract.currency ?? 'USD',
      ownership_percent: h.ownership_percent,
      status: 'pending' as const,
    }))

    const { data: paymentRecords, error: payErr } = await supabase
      .from('distribution_payments')
      .insert(payments)
      .select()

    if (payErr || !paymentRecords) {
      return NextResponse.json({ error: `Failed to create payment records: ${payErr?.message}` }, { status: 500 })
    }

    // 8. Execute payments via custodial wallet signing
    const seed = decryptSeed(issuerWallet.encrypted_seed)
    const results: { paymentId: string; status: string; txHash?: string; error?: string }[] = []

    for (const payment of paymentRecords) {
      if (payment.amount <= 0) {
        results.push({ paymentId: payment.id, status: 'skipped' })
        continue
      }

      try {
        // Mark processing
        await supabase
          .from('distribution_payments')
          .update({ status: 'processing' })
          .eq('id', payment.id)

        // Build XRPL payment
        const currency = payment.currency
        const amount = buildPaymentAmount(currency, String(payment.amount), issuerWallet.address)

        const result = await xrplSignAndSubmit(seed, {
          TransactionType: 'Payment',
          Account: issuerWallet.address,
          Destination: payment.wallet_address,
          Amount: amount,
        })

        if (result.success) {
          await supabase
            .from('distribution_payments')
            .update({ status: 'completed', tx_hash: result.hash, completed_at: new Date().toISOString() })
            .eq('id', payment.id)

          results.push({ paymentId: payment.id, status: 'completed', txHash: result.hash })
        } else {
          await supabase
            .from('distribution_payments')
            .update({ status: 'failed' })
            .eq('id', payment.id)

          results.push({ paymentId: payment.id, status: 'failed', error: result.engineResult })
        }
      } catch (err) {
        await supabase
          .from('distribution_payments')
          .update({ status: 'failed' })
          .eq('id', payment.id)

        results.push({
          paymentId: payment.id,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    // 9. Check if all payments completed
    const allDone = results.every((r) => r.status === 'completed' || r.status === 'skipped')
    const finalStatus = allDone ? 'completed' : 'failed'

    await supabase
      .from('distributions')
      .update({
        status: finalStatus,
        completed_at: allDone ? new Date().toISOString() : null,
      })
      .eq('id', distribution.id)

    // Update asset's last_distribution_at
    if (allDone) {
      await supabase
        .from('assets')
        .update({ last_distribution_at: new Date().toISOString() })
        .eq('id', assetId)
    }

    // Audit log
    console.warn(
      `[AUDIT] Admin ${user.id} triggered auto-distribution for asset ${asset.asset_name}. ` +
      `Distribution ${distribution.id}: $${totalPayout} → ${holders.length} holders. Status: ${finalStatus}`
    )

    return NextResponse.json({
      distribution: { id: distribution.id, status: finalStatus },
      totalPayout,
      ownerRetainedPercent: ownerRetainedPct,
      ownerRetainedAmount,
      investorPayout,
      reserveAmount,
      distributableAmount,
      holdersCount: holders.length,
      results,
    })
  } catch (err) {
    console.error('[auto-distribute]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
