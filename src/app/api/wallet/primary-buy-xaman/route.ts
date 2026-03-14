import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { signAndSubmitFromAddress } from '@/lib/xrpl/wallet-manager'
import { buildPaymentAmount } from '@/lib/xrpl/amount'
import { collectTokenizationFee } from '@/lib/xrpl/fee-collector'

/**
 * PRIMARY MARKET BUY for Xaman (self-custody) users.
 *
 * Called AFTER the investor has signed the TrustSet via Xaman.
 * The issuer wallet sends tokens directly to the investor's Xaman address.
 *
 * POST body: {
 *   orderId: string,
 *   investorAddress: string,  // Xaman wallet address
 *   tokenAmount: number,
 *   tokenSymbol: string,
 *   issuerWallet: string,
 *   pricePerToken: number,
 * }
 *
 * Returns: { hash, engineResult, status: 'filled' }
 */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { supabase } = auth

  try {
    const {
      orderId,
      investorAddress,
      tokenAmount,
      tokenSymbol,
      issuerWallet,
      pricePerToken,
    } = await req.json()

    if (!orderId || !investorAddress || !tokenAmount || !tokenSymbol || !issuerWallet || !pricePerToken) {
      return NextResponse.json(
        { error: 'orderId, investorAddress, tokenAmount, tokenSymbol, issuerWallet, and pricePerToken required' },
        { status: 400 }
      )
    }

    // Supply cap enforcement: check DB token_supply vs circulating
    const { data: assetRow } = await supabase
      .from('assets')
      .select('id, token_supply')
      .eq('token_symbol', tokenSymbol)
      .eq('issuer_wallet', issuerWallet)
      .single()

    if (assetRow && assetRow.token_supply > 0) {
      const { data: holdingsRows } = await supabase
        .from('investor_holdings')
        .select('token_balance')
        .eq('token_symbol', tokenSymbol)

      const circulating = (holdingsRows ?? []).reduce(
        (sum, h) => sum + Number(h.token_balance), 0
      )

      if (circulating + tokenAmount > assetRow.token_supply) {
        const remaining = assetRow.token_supply - circulating
        return NextResponse.json(
          {
            error: `Not enough tokens available. Requested ${tokenAmount} but only ${remaining.toLocaleString()} of ${assetRow.token_supply.toLocaleString()} ${tokenSymbol} remain.`,
          },
          { status: 400 }
        )
      }
    }

    // Issuer authorizes the investor's trust line (required when RequireAuth is enabled)
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
      console.log(`[primary-buy-xaman] Trust line auth: ${authResult.engineResult} for ${investorAddress}`)
    } catch (err) {
      // Non-fatal — RequireAuth may not be enabled
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[primary-buy-xaman] Trust line auth skipped:', msg)
    }

    // Issuer sends tokens directly to the Xaman wallet
    const tokenAmount_xrpl = buildPaymentAmount(tokenSymbol, String(tokenAmount), issuerWallet)

    const { hash, engineResult } = await signAndSubmitFromAddress(issuerWallet, {
      TransactionType: 'Payment',
      Destination: investorAddress,
      Amount: tokenAmount_xrpl,
    })

    if (engineResult !== 'tesSUCCESS') {
      console.error(`[primary-buy-xaman] Delivery failed: ${engineResult} (hash: ${hash})`)

      const errorMessages: Record<string, string> = {
        tecPATH_DRY: 'Token delivery failed: trust line may not be ready yet. Please wait a moment and try again.',
        tecNO_LINE: 'No trust line found. Please sign the trust line in Xaman first.',
        tecUNFUNDED_PAYMENT: 'Not enough tokens available to complete this purchase.',
        tecINSUFFICIENT_RESERVE: 'Issuer wallet does not have enough XRP reserves. Contact platform admin.',
      }

      return NextResponse.json(
        { error: errorMessages[engineResult] ?? `Token delivery failed: ${engineResult}` },
        { status: 500 }
      )
    }

    // Collect tokenization fee (non-blocking)
    const feeResult = await collectTokenizationFee({
      issuerWallet,
      tokenSymbol,
      tokenAmount,
    })

    // Mark order as filled
    await supabase
      .from('marketplace_orders')
      .update({
        status: 'filled',
        xrpl_offer_tx: hash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    // Update holdings
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
      const assetId = assetRow?.id
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
      message: `${tokenAmount} ${tokenSymbol} delivered to ${investorAddress.slice(0, 8)}...`,
      fee: feeResult ? { hash: feeResult.hash, amount: feeResult.feeAmount, token: tokenSymbol } : null,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Primary buy (Xaman) failed' },
      { status: 500 }
    )
  }
}
