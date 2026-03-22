import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { signAndSubmit, getCustodialAddress, signAndSubmitFromAddress } from '@/lib/xrpl/wallet-manager'
import { buildPaymentAmount } from '@/lib/xrpl/amount'
import { getXrpUsdPrice, usdToXrp } from '@/lib/xrpl/xrp-price'
import { syncHoldingsForWallet } from '@/lib/sync-holdings-server'
import { collectTokenizationFee } from '@/lib/xrpl/fee-collector'

/**
 * PRIMARY MARKET BUY — instant token delivery.
 *
 * Flow:
 * 1. Investor clicks "Buy" → this endpoint is called
 * 2. Ensures the investor's wallet has a trust line for the token
 * 3. Issuer authorizes the trust line (if RequireAuth is enabled)
 * 4. Investor pays issuer (Payment tx)
 * 5. Issuer sends tokens to investor (Payment tx)
 * 6. Order is marked as "filled" immediately
 */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { user, supabase } = auth

  try {
    const {
      orderId,
      tokenAmount,
      tokenSymbol,
      issuerWallet,
      currency,
      pricePerToken,
    } = await req.json()

    if (!orderId || !tokenAmount || !tokenSymbol || !issuerWallet || !pricePerToken) {
      return NextResponse.json(
        { error: 'orderId, tokenAmount, tokenSymbol, issuerWallet, and pricePerToken required' },
        { status: 400 }
      )
    }

    // Get the investor's custodial wallet address
    const investorAddress = await getCustodialAddress(user.id)
    if (!investorAddress) {
      return NextResponse.json(
        { error: 'No custodial wallet found. Create one first.' },
        { status: 400 }
      )
    }

    // Supply cap enforcement: available = token_supply - owner_retained - investor_holdings
    const { data: asset } = await supabase
      .from('assets')
      .select('id, token_supply, owner_retained_percent')
      .eq('token_symbol', tokenSymbol)
      .eq('issuer_wallet', issuerWallet)
      .single()

    if (asset && asset.token_supply > 0) {
      const { data: holdingsRows } = await supabase
        .from('investor_holdings')
        .select('token_balance')
        .eq('asset_id', asset.id)

      const investorHeld = (holdingsRows ?? []).reduce(
        (sum, h) => sum + Number(h.token_balance), 0
      )
      const ownerRetained = Math.floor((Number(asset.owner_retained_percent ?? 0) / 100) * asset.token_supply)
      const available = asset.token_supply - ownerRetained - investorHeld

      if (tokenAmount > available) {
        return NextResponse.json(
          {
            error: `Not enough tokens available. Requested ${tokenAmount} but only ${Math.max(0, available).toLocaleString()} of ${asset.token_supply.toLocaleString()} ${tokenSymbol} are available for purchase (${ownerRetained} retained by owner).`,
          },
          { status: 400 }
        )
      }
    }

    // Step 1: Ensure the investor has a trust line for this token
    if (tokenSymbol !== 'XRP') {
      try {
        const trustResult = await signAndSubmit(user.id, {
          TransactionType: 'TrustSet',
          LimitAmount: {
            currency: tokenSymbol,
            issuer: issuerWallet,
            value: '999999999',
          },
        })
        console.log(`[primary-buy] TrustSet result: ${trustResult.engineResult} for ${investorAddress}`)

        if (trustResult.engineResult !== 'tesSUCCESS' && trustResult.engineResult !== 'tecDUPLICATE') {
          return NextResponse.json(
            { error: `Failed to set trust line: ${trustResult.engineResult}. Cannot receive tokens without a trust line.` },
            { status: 500 }
          )
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // tecDUPLICATE or "already exists" are fine — trust line already set
        if (!msg.includes('tecDUPLICATE') && !msg.includes('already')) {
          console.error('[primary-buy] TrustSet failed:', msg)
          return NextResponse.json(
            { error: `Trust line setup failed: ${msg}` },
            { status: 500 }
          )
        }
      }

      // Step 1b: Issuer authorizes the trust line (required when RequireAuth is enabled)
      try {
        const authResult = await signAndSubmitFromAddress(issuerWallet, {
          TransactionType: 'TrustSet',
          LimitAmount: {
            currency: tokenSymbol,
            issuer: investorAddress,
            value: '0',
          },
          Flags: 65536, // tfSetfAuth
        })
        console.log(`[primary-buy] Trust line auth result: ${authResult.engineResult} for ${investorAddress}`)
      } catch (err) {
        // Non-fatal — if RequireAuth isn't enabled, this will fail and that's OK
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[primary-buy] Trust line auth skipped or failed:', msg)
      }
    }

    // Step 2: Investor pays issuer (XRP or RLUSD)
    const payCurrency = currency || 'XRP'
    const totalCostUsd = tokenAmount * pricePerToken // pricePerToken is in USD

    // Convert USD to XRP if paying in XRP (e.g. $10 at XRP=$2.50 = 4 XRP)
    let totalCost: number
    let xrpPrice: number | null = null
    if (payCurrency === 'XRP') {
      xrpPrice = await getXrpUsdPrice()
      totalCost = usdToXrp(totalCostUsd, xrpPrice)
      console.log(`[primary-buy] USD→XRP conversion: $${totalCostUsd} / $${xrpPrice} = ${totalCost.toFixed(6)} XRP`)
    } else {
      totalCost = totalCostUsd // RLUSD is 1:1 with USD
    }

    const paymentAmount = buildPaymentAmount(payCurrency, String(totalCost), issuerWallet)

    try {
      const payResult = await signAndSubmit(user.id, {
        TransactionType: 'Payment',
        Destination: issuerWallet,
        Amount: paymentAmount,
      })
      console.log(`[primary-buy] Payment result: ${payResult.engineResult} (${totalCost} ${payCurrency})`)

      if (payResult.engineResult !== 'tesSUCCESS') {
        return NextResponse.json(
          { error: `Payment failed: ${payResult.engineResult}. Your ${payCurrency} was not sent.` },
          { status: 500 }
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[primary-buy] Payment error:', msg)
      if (msg.includes('tecUNFUNDED') || msg.includes('tecINSUFFICIENT')) {
        return NextResponse.json(
          { error: `Not enough ${payCurrency} in your wallet to cover ${totalCost} ${payCurrency}.` },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: `Payment failed: ${msg}` },
        { status: 500 }
      )
    }

    // Step 3: Issuer sends tokens to investor (direct Payment)
    const tokenAmount_xrpl = buildPaymentAmount(tokenSymbol, String(tokenAmount), issuerWallet)

    let hash: string
    let engineResult: string
    try {
      const result = await signAndSubmitFromAddress(issuerWallet, {
        TransactionType: 'Payment',
        Destination: investorAddress,
        Amount: tokenAmount_xrpl,
      })
      hash = result.hash
      engineResult = result.engineResult
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[primary-buy] Token delivery error:', msg)

      if (msg.includes('tecPATH_DRY')) {
        return NextResponse.json(
          { error: 'Token delivery failed: trust line not ready. Please try again.' },
          { status: 500 }
        )
      }
      if (msg.includes('tecUNFUNDED') || msg.includes('tecINSUFFICIENT')) {
        return NextResponse.json(
          { error: 'Not enough tokens available to complete this purchase. Contact platform admin.' },
          { status: 500 }
        )
      }
      return NextResponse.json(
        { error: `Token delivery failed: ${msg}` },
        { status: 500 }
      )
    }

    // Only tesSUCCESS means tokens were actually delivered
    if (engineResult !== 'tesSUCCESS') {
      console.error(`[primary-buy] Delivery failed: ${engineResult} (hash: ${hash})`)

      const errorMessages: Record<string, string> = {
        tecPATH_DRY: 'Token delivery failed: trust line not established. Please try again.',
        tecNO_LINE: 'No trust line found. Your wallet needs a trust line before receiving tokens.',
        tecUNFUNDED_PAYMENT: 'Not enough tokens available to complete this purchase.',
        tecINSUFFICIENT_RESERVE: 'Issuer wallet does not have enough XRP reserves. Contact platform admin.',
      }

      return NextResponse.json(
        { error: errorMessages[engineResult] ?? `Token delivery failed: ${engineResult}` },
        { status: 500 }
      )
    }

    // Step 4: Collect tokenization fee — fire-and-forget (purchase already succeeded)
    collectTokenizationFee({ issuerWallet, tokenSymbol, tokenAmount })
      .catch((err) => console.warn('[primary-buy] Tokenization fee failed (non-fatal):', err))

    // Step 5: Mark the order as filled
    await supabase
      .from('marketplace_orders')
      .update({
        status: 'filled',
        xrpl_offer_tx: hash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    // Step 6: Sync holdings from XRPL — fire-and-forget so user gets instant response.
    // The purchase already succeeded on-chain; sync updates the DB cache.
    syncHoldingsForWallet(investorAddress)
      .then((r) => console.log(`[primary-buy] Holdings synced: ${r.synced}`))
      .catch((err) => console.warn('[primary-buy] Post-buy sync failed (non-fatal):', err))

    return NextResponse.json({
      hash,
      engineResult,
      status: 'filled',
      message: `${tokenAmount} ${tokenSymbol} delivered to your wallet`,
    })
  } catch (err) {
    console.error('[primary-buy] Unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Purchase failed. Please try again.' },
      { status: 500 }
    )
  }
}
