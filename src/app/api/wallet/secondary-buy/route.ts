import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { signAndSubmit, getCustodialAddress, signAndSubmitFromAddress } from '@/lib/xrpl/wallet-manager'
import { buildPaymentAmount } from '@/lib/xrpl/amount'
import { getXrpUsdPrice, usdToXrp } from '@/lib/xrpl/xrp-price'
import { syncHoldingsForWallet } from '@/lib/sync-holdings-server'
import { collectExchangeFee } from '@/lib/xrpl/fee-collector'

/**
 * SECONDARY MARKET BUY — direct wallet-to-wallet settlement.
 *
 * Tokens remain in the seller's wallet until a buyer matches the order.
 * At settlement, the platform (which has custodial keys for both parties)
 * transfers tokens from seller → buyer and payment from buyer → seller.
 *
 * Flow:
 * 1. Buyer's wallet creates trust line to the token issuer
 * 2. Issuer authorizes buyer's trust line (if RequireAuth)
 * 3. Buyer sends payment (XRP/RLUSD) to seller's wallet
 * 4. Seller's wallet sends tokens directly to buyer's wallet
 * 5. Both orders updated, holdings synced
 *
 * Currency is handled automatically:
 * - Buyer pays in seller's preferred receive_currency (from settings)
 * - Prices are USD in the UI; backend converts to on-chain currency
 */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { user, supabase } = auth

  try {
    const {
      buyOrderId,
      sellOrderId,
      tokenAmount,
      tokenSymbol,
      issuerWallet,
      pricePerToken,
      currency,
    } = await req.json()

    if (!buyOrderId || !sellOrderId || !tokenAmount || !tokenSymbol || !issuerWallet || !pricePerToken) {
      return NextResponse.json(
        { error: 'buyOrderId, sellOrderId, tokenAmount, tokenSymbol, issuerWallet, and pricePerToken required' },
        { status: 400 }
      )
    }

    // Get buyer's custodial wallet
    const buyerAddress = await getCustodialAddress(user.id)
    if (!buyerAddress) {
      return NextResponse.json(
        { error: 'No custodial wallet found. Create one first.' },
        { status: 400 }
      )
    }

    // Use service role for all cross-user queries (buyer can't read seller's data via RLS)
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify sell order is still open
    const { data: sellOrder } = await svc
      .from('marketplace_orders')
      .select('id, investor_id, token_amount, filled_amount, price_per_token, currency, status')
      .eq('id', sellOrderId)
      .in('status', ['open', 'partial'])
      .single()

    if (!sellOrder) {
      return NextResponse.json(
        { error: 'Sell order not found or already filled' },
        { status: 404 }
      )
    }

    // Calculate remaining tokens
    const remainingTokens = sellOrder.token_amount - (sellOrder.filled_amount ?? 0)
    if (tokenAmount > remainingTokens || remainingTokens <= 0) {
      return NextResponse.json(
        { error: `Only ${Math.max(0, remainingTokens)} ${tokenSymbol} available. You requested ${tokenAmount}.` },
        { status: 400 }
      )
    }

    // Get seller's wallet address, user_id, and payment preference
    const { data: sellerInvestor } = await svc
      .from('platform_investors')
      .select('user_id, wallet_address, receive_currency')
      .eq('id', sellOrder.investor_id)
      .single()

    if (!sellerInvestor?.wallet_address || !sellerInvestor?.user_id) {
      return NextResponse.json({ error: 'Seller wallet not found' }, { status: 500 })
    }

    const sellerAddress = sellerInvestor.wallet_address
    const sellerUserId = sellerInvestor.user_id
    // Seller's preferred currency (USD maps to XRP since RLUSD needs trust lines)
    const sellerReceiveCurrency = sellerInvestor.receive_currency === 'RLUSD'
      ? 'RLUSD'
      : 'XRP' // Default: XRP (universal, no trust line needed)

    // Step 1: Ensure buyer has a trust line for this token
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
        console.log(`[secondary-buy] Buyer TrustSet: ${trustResult.engineResult}`)

        if (trustResult.engineResult !== 'tesSUCCESS' && trustResult.engineResult !== 'tecDUPLICATE') {
          return NextResponse.json(
            { error: `Failed to set trust line: ${trustResult.engineResult}` },
            { status: 500 }
          )
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (!msg.includes('tecDUPLICATE') && !msg.includes('already')) {
          return NextResponse.json(
            { error: `Trust line setup failed: ${msg}` },
            { status: 500 }
          )
        }
      }

      // Issuer authorizes buyer's trust line (if RequireAuth)
      try {
        await signAndSubmitFromAddress(issuerWallet, {
          TransactionType: 'TrustSet',
          LimitAmount: { currency: tokenSymbol, issuer: buyerAddress, value: '0' },
          Flags: 65536,
        })
      } catch (err) {
        console.warn('[secondary-buy] Trust line auth skipped:', err instanceof Error ? err.message : err)
      }
    }

    // Step 2: Buyer pays seller in seller's preferred currency
    const payCurrency = sellerReceiveCurrency
    const sellPricePerToken = Number(sellOrder.price_per_token) || pricePerToken
    const totalCostUsd = tokenAmount * sellPricePerToken

    let totalCost: number
    if (payCurrency === 'XRP') {
      const xrpPrice = await getXrpUsdPrice()
      totalCost = usdToXrp(totalCostUsd, xrpPrice)
      console.log(`[secondary-buy] Buyer pays seller: $${totalCostUsd} → ${totalCost.toFixed(6)} XRP → ${sellerAddress.slice(0, 8)}...`)
    } else {
      totalCost = totalCostUsd
      console.log(`[secondary-buy] Buyer pays seller: ${totalCost} ${payCurrency} → ${sellerAddress.slice(0, 8)}...`)
    }

    const paymentAmount = buildPaymentAmount(payCurrency, String(totalCost), issuerWallet)

    try {
      const payResult = await signAndSubmit(user.id, {
        TransactionType: 'Payment',
        Destination: sellerAddress, // Payment goes to SELLER
        Amount: paymentAmount,
      })
      console.log(`[secondary-buy] Payment result: ${payResult.engineResult}`)

      if (payResult.engineResult !== 'tesSUCCESS') {
        return NextResponse.json(
          { error: `Payment to seller failed: ${payResult.engineResult}` },
          { status: 500 }
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('tecUNFUNDED') || msg.includes('tecINSUFFICIENT')) {
        return NextResponse.json(
          { error: `Not enough ${payCurrency} in your wallet to complete this purchase.` },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: `Payment failed: ${msg}` }, { status: 500 })
    }

    // Step 3: Seller's wallet sends tokens directly to buyer
    // Tokens remain in the seller's wallet until this moment. The platform has
    // custodial keys for the seller, so we can sign on their behalf at settlement.
    const tokenAmountXrpl = buildPaymentAmount(tokenSymbol, String(tokenAmount), issuerWallet)

    let hash: string
    let engineResult: string
    try {
      const result = await signAndSubmit(sellerUserId, {
        TransactionType: 'Payment',
        Destination: buyerAddress,
        Amount: tokenAmountXrpl,
      })
      hash = result.hash
      engineResult = result.engineResult
      console.log(`[secondary-buy] Token delivery from seller: ${engineResult} (${tokenAmount} ${tokenSymbol} ${sellerAddress.slice(0, 8)}... → ${buyerAddress.slice(0, 8)}...)`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[secondary-buy] Token delivery error:', msg)
      return NextResponse.json(
        { error: `Token delivery failed: ${msg}. Payment was sent — contact support.` },
        { status: 500 }
      )
    }

    if (engineResult !== 'tesSUCCESS') {
      return NextResponse.json(
        { error: `Token delivery failed: ${engineResult}. Payment was sent — contact support.` },
        { status: 500 }
      )
    }

    // Step 4: Update order statuses (service role bypasses RLS)
    const newSellFilled = (sellOrder.filled_amount ?? 0) + tokenAmount
    const sellFullyFilled = newSellFilled >= sellOrder.token_amount
    const sellOrderRemaining = sellOrder.token_amount - newSellFilled

    const [buyUpdate, sellUpdate] = await Promise.all([
      svc
        .from('marketplace_orders')
        .update({ status: 'filled', xrpl_offer_tx: hash, updated_at: new Date().toISOString() })
        .eq('id', buyOrderId),
      svc
        .from('marketplace_orders')
        .update({
          filled_amount: newSellFilled,
          status: sellFullyFilled ? 'filled' : 'partial',
          xrpl_offer_tx: hash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sellOrderId),
    ])

    if (buyUpdate.error) console.error('[secondary-buy] Buy order update failed:', buyUpdate.error.message)
    if (sellUpdate.error) console.error('[secondary-buy] Sell order update failed:', sellUpdate.error.message)
    console.log(`[secondary-buy] Orders updated: sell filled_amount=${newSellFilled}/${sellOrder.token_amount}, remaining=${sellOrderRemaining}`)

    // Collect exchange fee — fire-and-forget
    collectExchangeFee({
      userId: user.id,
      currency: payCurrency,
      totalPayment: totalCost,
      issuerWallet,
    }).catch((err) => console.warn('[secondary-buy] Exchange fee failed (non-fatal):', err))

    // Step 5: Sync holdings for both — awaited so portfolios update before response
    await Promise.allSettled([
      syncHoldingsForWallet(buyerAddress),
      syncHoldingsForWallet(sellerAddress),
    ])

    return NextResponse.json({
      hash,
      engineResult,
      status: sellOrderRemaining > 0 ? 'partial' : 'filled',
      message: `${tokenAmount} ${tokenSymbol} purchased from secondary market`,
      sellOrderRemaining,
    })
  } catch (err) {
    console.error('[secondary-buy] Unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Secondary buy failed' },
      { status: 500 }
    )
  }
}
