import { NextResponse } from 'next/server'
import { requireIssuer } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { decryptSeed } from '@/lib/crypto/wallet-encryption'
import { buildPaymentAmount } from '@/lib/xrpl/amount'
import { xrplSignAndSubmit } from '@/lib/xrpl/rpc'

/**
 * Issuer-triggered royalty distribution.
 *
 * The issuer enters a total amount they want to distribute from rental income.
 * The system:
 * 1. Verifies the issuer owns the asset
 * 2. Fetches all token holders + ownership %
 * 3. Calculates each holder's share
 * 4. Creates distribution + payment records
 * 5. Signs and submits each XRPL payment from the issuer's custodial wallet
 *
 * Body: { assetId: string, totalAmount: number, period?: string, currency?: string }
 */
export async function POST(req: Request) {
  const auth = await requireIssuer()
  if ('error' in auth && auth.error) return auth.error
  const { user } = auth

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { assetId, totalAmount, period, currency: inputCurrency } = await req.json()

    if (!assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 })
    }
    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json({ error: 'totalAmount must be greater than 0' }, { status: 400 })
    }

    // 1. Fetch asset and verify ownership
    const { data: asset, error: assetErr } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single()

    if (assetErr || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    if (asset.owner_id !== user.id) {
      return NextResponse.json({ error: 'You do not own this asset' }, { status: 403 })
    }

    // 2. Find the issuer's custodial wallet
    const { data: issuerWallet } = await supabase
      .from('custodial_wallets')
      .select('id, address, encrypted_seed')
      .eq('address', asset.issuer_wallet)
      .eq('is_primary', true)
      .single()

    if (!issuerWallet) {
      return NextResponse.json(
        { error: 'Issuer wallet is not a platform-managed custodial wallet. Contact the admin.' },
        { status: 400 }
      )
    }

    // 3. Fetch token holders
    const { data: holders } = await supabase
      .from('investor_holdings')
      .select('wallet_address, ownership_percent, token_balance')
      .eq('asset_id', assetId)
      .gt('token_balance', 0)

    if (!holders || holders.length === 0) {
      return NextResponse.json({ error: 'No token holders found for this asset' }, { status: 400 })
    }

    // 4. Calculate amounts
    const payoutTotal = Math.round(Number(totalAmount) * 100) / 100
    const ownerRetainedPct = Number(asset.owner_retained_percent ?? 0)
    const ownerRetainedAmount = Math.round(payoutTotal * (ownerRetainedPct / 100) * 100) / 100
    const investorPayout = Math.round((payoutTotal - ownerRetainedAmount) * 100) / 100
    const reserveAmount = Math.round(investorPayout * 0.10 * 100) / 100
    const distributableAmount = Math.round((investorPayout - reserveAmount) * 100) / 100

    const paymentCurrency = inputCurrency ?? 'XRP'

    // Determine royalty period label
    const now = new Date()
    const currentQuarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`
    const royaltyPeriod = period ?? `${currentQuarter} ${now.getFullYear()}`

    // 5. Create distribution record
    const { data: distribution, error: distErr } = await supabase
      .from('distributions')
      .insert({
        asset_id: assetId,
        event_type: 'LEASE',
        total_amount: payoutTotal,
        currency: paymentCurrency,
        reserve_amount: reserveAmount,
        distributable_amount: distributableAmount,
        status: 'processing',
        is_royalty: true,
        royalty_period: royaltyPeriod,
        triggered_by: user.id,
        notes: `Issuer-triggered distribution: $${payoutTotal} for ${royaltyPeriod}. Owner retains ${ownerRetainedPct}% ($${ownerRetainedAmount}), 10% reserve = $${reserveAmount}, distributed = $${distributableAmount}.`,
      })
      .select()
      .single()

    if (distErr || !distribution) {
      return NextResponse.json({ error: `Failed to create distribution: ${distErr?.message}` }, { status: 500 })
    }

    // 6. Create per-holder payment records
    const payments = holders.map((h) => ({
      distribution_id: distribution.id,
      wallet_address: h.wallet_address,
      amount: Math.round(distributableAmount * (h.ownership_percent / 100) * 100) / 100,
      currency: paymentCurrency,
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

    // 7. Execute payments via custodial wallet
    const seed = decryptSeed(issuerWallet.encrypted_seed)
    const results: { paymentId: string; walletAddress: string; amount: number; ownershipPercent: number; status: string; txHash?: string; error?: string }[] = []

    for (const payment of paymentRecords) {
      if (payment.amount <= 0) {
        results.push({ paymentId: payment.id, walletAddress: payment.wallet_address, amount: payment.amount, ownershipPercent: payment.ownership_percent, status: 'skipped' })
        continue
      }

      try {
        await supabase
          .from('distribution_payments')
          .update({ status: 'processing' })
          .eq('id', payment.id)

        const amount = buildPaymentAmount(payment.currency, String(payment.amount), issuerWallet.address)

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

          results.push({ paymentId: payment.id, walletAddress: payment.wallet_address, amount: payment.amount, ownershipPercent: payment.ownership_percent, status: 'completed', txHash: result.hash })
        } else {
          await supabase
            .from('distribution_payments')
            .update({ status: 'failed' })
            .eq('id', payment.id)

          results.push({ paymentId: payment.id, walletAddress: payment.wallet_address, amount: payment.amount, ownershipPercent: payment.ownership_percent, status: 'failed', error: result.engineResult })
        }
      } catch (err) {
        await supabase
          .from('distribution_payments')
          .update({ status: 'failed' })
          .eq('id', payment.id)

        results.push({
          paymentId: payment.id,
          walletAddress: payment.wallet_address,
          amount: payment.amount,
          ownershipPercent: payment.ownership_percent,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    // 8. Finalize distribution status
    const allDone = results.every((r) => r.status === 'completed' || r.status === 'skipped')
    const finalStatus = allDone ? 'completed' : 'failed'

    await supabase
      .from('distributions')
      .update({
        status: finalStatus,
        completed_at: allDone ? new Date().toISOString() : null,
      })
      .eq('id', distribution.id)

    if (allDone) {
      await supabase
        .from('assets')
        .update({ last_distribution_at: new Date().toISOString() })
        .eq('id', assetId)
    }

    console.warn(
      `[AUDIT] Issuer ${user.id} triggered distribution for asset ${asset.asset_name}. ` +
      `Distribution ${distribution.id}: $${payoutTotal} → ${holders.length} holders. Status: ${finalStatus}`
    )

    const circulatingPercent = holders.reduce((sum, h) => sum + Number(h.ownership_percent), 0)
    const actualDistributed = payments.reduce((sum, p) => sum + p.amount, 0)
    const unsoldRetained = Math.round((distributableAmount - actualDistributed) * 100) / 100

    return NextResponse.json({
      distribution: { id: distribution.id, status: finalStatus },
      totalPayout: payoutTotal,
      ownerRetainedPercent: ownerRetainedPct,
      ownerRetainedAmount,
      investorPayout,
      reserveAmount,
      distributableAmount: actualDistributed,
      unsoldRetained,
      circulatingPercent,
      holdersCount: holders.length,
      currency: paymentCurrency,
      royaltyPeriod,
      results,
    })
  } catch (err) {
    console.error('[issuer-distribute]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
