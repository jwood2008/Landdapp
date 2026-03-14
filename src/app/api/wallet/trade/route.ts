import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { signAndSubmit, getCustodialAddress, signAndSubmitFromAddress } from '@/lib/xrpl/wallet-manager'
import { buildPaymentAmount } from '@/lib/xrpl/amount'
import { collectExchangeFee } from '@/lib/xrpl/fee-collector'

/**
 * Execute a trade using the user's custodial wallet.
 * Signs and submits an OfferCreate to the XRPL DEX server-side.
 * No Xaman needed — the platform signs on behalf of the user.
 *
 * POST body: {
 *   orderId: string,
 *   side: 'buy' | 'sell',
 *   tokenAmount: number,
 *   pricePerToken: number,
 *   tokenSymbol: string,
 *   issuerWallet: string,
 *   currency: string,  // RLUSD | XRP
 * }
 *
 * Returns: { hash, engineResult }
 */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { user, supabase } = auth

  try {
    const {
      orderId,
      side,
      tokenAmount,
      pricePerToken,
      tokenSymbol,
      issuerWallet,
      currency,
    } = await req.json()

    if (!orderId || !side || !tokenAmount || !pricePerToken || !tokenSymbol || !issuerWallet) {
      return NextResponse.json(
        { error: 'orderId, side, tokenAmount, pricePerToken, tokenSymbol, and issuerWallet required' },
        { status: 400 }
      )
    }

    // Verify user has a custodial wallet
    const address = await getCustodialAddress(user.id)
    if (!address) {
      return NextResponse.json(
        { error: 'No custodial wallet found. Create one first.' },
        { status: 400 }
      )
    }

    const totalPayment = tokenAmount * pricePerToken
    const payCurrency = currency ?? 'RLUSD'

    // Build XRPL amounts
    const tokenAmount_xrpl = buildPaymentAmount(tokenSymbol, String(tokenAmount), issuerWallet)
    const paymentAmount_xrpl = buildPaymentAmount(payCurrency, String(totalPayment), issuerWallet)

    let takerPays: unknown
    let takerGets: unknown

    if (side === 'buy') {
      takerPays = tokenAmount_xrpl
      takerGets = paymentAmount_xrpl
    } else {
      takerPays = paymentAmount_xrpl
      takerGets = tokenAmount_xrpl
    }

    // Ensure trust line + authorization for the token before trading
    if (side === 'buy' && tokenSymbol !== 'XRP') {
      // Investor creates trust line
      try {
        await signAndSubmit(user.id, {
          TransactionType: 'TrustSet',
          LimitAmount: {
            currency: tokenSymbol,
            issuer: issuerWallet,
            value: '999999999',
          },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (!msg.includes('tecDUPLICATE') && !msg.includes('already')) {
          console.warn('[trade] TrustSet warning:', msg)
        }
      }

      // Issuer authorizes the trust line (required when RequireAuth is enabled)
      try {
        await signAndSubmitFromAddress(issuerWallet, {
          TransactionType: 'TrustSet',
          LimitAmount: {
            currency: tokenSymbol,
            issuer: address,
            value: '0',
          },
          Flags: 65536, // tfSetfAuth
        })
      } catch (err) {
        // Non-fatal — RequireAuth may not be enabled
        const msg = err instanceof Error ? err.message : ''
        console.warn('[trade] Trust line auth skipped:', msg)
      }
    }

    // Sign and submit using the custodial wallet
    const { hash, engineResult } = await signAndSubmit(user.id, {
      TransactionType: 'OfferCreate',
      TakerPays: takerPays,
      TakerGets: takerGets,
    })

    // Collect exchange fee (non-blocking — trade still succeeds if fee fails)
    let feeResult = null
    if (engineResult === 'tesSUCCESS') {
      feeResult = await collectExchangeFee({
        userId: user.id,
        currency: payCurrency,
        totalPayment,
        issuerWallet,
      })
    }

    // Update the marketplace order with the tx hash
    if (orderId) {
      await supabase
        .from('marketplace_orders')
        .update({
          xrpl_offer_tx: hash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
    }

    return NextResponse.json({
      hash,
      engineResult,
      fee: feeResult ? { hash: feeResult.hash, amount: feeResult.feeAmount, currency: payCurrency } : null,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Trade failed' },
      { status: 500 }
    )
  }
}
