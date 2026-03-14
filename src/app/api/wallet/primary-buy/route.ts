import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { signAndSubmit, getCustodialAddress, signAndSubmitFromAddress } from '@/lib/xrpl/wallet-manager'
import { buildPaymentAmount } from '@/lib/xrpl/amount'
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

    // Supply cap enforcement: check DB token_supply vs circulating
    const { data: asset } = await supabase
      .from('assets')
      .select('id, token_supply')
      .eq('token_symbol', tokenSymbol)
      .eq('issuer_wallet', issuerWallet)
      .single()

    if (asset && asset.token_supply > 0) {
      const { data: holdingsRows } = await supabase
        .from('investor_holdings')
        .select('token_balance')
        .eq('token_symbol', tokenSymbol)

      const circulating = (holdingsRows ?? []).reduce(
        (sum, h) => sum + Number(h.token_balance), 0
      )

      if (circulating + tokenAmount > asset.token_supply) {
        const remaining = asset.token_supply - circulating
        return NextResponse.json(
          {
            error: `Not enough tokens available. Requested ${tokenAmount} but only ${remaining.toLocaleString()} of ${asset.token_supply.toLocaleString()} ${tokenSymbol} remain.`,
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
    const totalCost = tokenAmount * pricePerToken
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

    // Step 3b: Collect tokenization fee (non-blocking — purchase still succeeds if fee fails)
    const feeResult = await collectTokenizationFee({
      issuerWallet,
      tokenSymbol,
      tokenAmount,
    })

    // Step 4: Mark the order as filled
    await supabase
      .from('marketplace_orders')
      .update({
        status: 'filled',
        xrpl_offer_tx: hash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    // Step 5: Sync holdings — update or insert the investor's token balance
    const { data: existingHolding } = await supabase
      .from('investor_holdings')
      .select('id, token_balance')
      .eq('wallet_address', investorAddress)
      .eq('token_symbol', tokenSymbol)
      .single()

    if (existingHolding) {
      await supabase
        .from('investor_holdings')
        .update({
          token_balance: Number(existingHolding.token_balance) + tokenAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingHolding.id)
    } else {
      const assetId = asset?.id
      if (assetId) {
        await supabase.from('investor_holdings').insert({
          wallet_address: investorAddress,
          asset_id: assetId,
          token_symbol: tokenSymbol,
          token_balance: tokenAmount,
          cost_basis_per_token: pricePerToken,
        })
      }
    }

    return NextResponse.json({
      hash,
      engineResult,
      status: 'filled',
      message: `${tokenAmount} ${tokenSymbol} delivered to your wallet`,
      fee: feeResult ? { hash: feeResult.hash, amount: feeResult.feeAmount, token: tokenSymbol } : null,
    })
  } catch (err) {
    console.error('[primary-buy] Unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Purchase failed. Please try again.' },
      { status: 500 }
    )
  }
}
