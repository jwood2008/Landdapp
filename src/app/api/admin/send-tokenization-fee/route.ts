import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { signAndSubmitFromAddress } from '@/lib/xrpl/wallet-manager'
import { buildPaymentAmount } from '@/lib/xrpl/amount'
import { getFeeSettings } from '@/lib/xrpl/fee-collector'

/**
 * Send the tokenization fee (% of total token supply) from the issuer wallet
 * to the platform domain wallet at asset creation time.
 *
 * POST body: { assetId: string }
 *
 * Flow:
 * 1. Fetch asset + platform fee settings
 * 2. Domain wallet creates trust line for the token
 * 3. Issuer authorizes the domain wallet trust line
 * 4. Issuer sends fee tokens to domain wallet
 * 5. Updates investor_holdings for the domain wallet
 */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { supabase, user } = auth

  // Verify admin
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const { assetId } = await req.json()
    if (!assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 })
    }

    // Get fee settings
    const settings = await getFeeSettings()
    if (!settings || settings.tokenization_fee_bps <= 0) {
      return NextResponse.json({
        skipped: true,
        message: 'No tokenization fee configured (fee is 0 or no domain wallet)',
      })
    }

    const { data: asset } = await supabase
      .from('assets')
      .select('id, token_symbol, issuer_wallet, token_supply')
      .eq('id', assetId)
      .single()

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const feeTokens = Math.floor(
      (asset.token_supply * settings.tokenization_fee_bps) / 10000
    )
    if (feeTokens <= 0) {
      return NextResponse.json({
        skipped: true,
        message: 'Fee amount rounds to 0 tokens',
      })
    }

    console.log(
      `[tokenization-fee] ${feeTokens} ${asset.token_symbol} from issuer ${asset.issuer_wallet} -> domain ${settings.domain_wallet}`
    )

    // Step 1: Domain wallet creates trust line for the token
    if (asset.token_symbol !== 'XRP') {
      try {
        await signAndSubmitFromAddress(settings.domain_wallet, {
          TransactionType: 'TrustSet',
          LimitAmount: {
            currency: asset.token_symbol,
            issuer: asset.issuer_wallet,
            value: '999999999',
          },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (!msg.includes('tecDUPLICATE') && !msg.includes('already')) {
          console.warn('[tokenization-fee] Domain TrustSet warning:', msg)
        }
      }

      // Step 2: Issuer authorizes the domain wallet trust line
      try {
        await signAndSubmitFromAddress(asset.issuer_wallet, {
          TransactionType: 'TrustSet',
          LimitAmount: {
            currency: asset.token_symbol,
            issuer: settings.domain_wallet,
            value: '0',
          },
          Flags: 65536, // tfSetfAuth
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        console.warn('[tokenization-fee] Trust line auth:', msg)
      }
    }

    // Step 3: Send fee tokens from issuer to domain wallet
    const tokenAmount = buildPaymentAmount(
      asset.token_symbol,
      String(feeTokens),
      asset.issuer_wallet
    )

    const { hash, engineResult } = await signAndSubmitFromAddress(
      asset.issuer_wallet,
      {
        TransactionType: 'Payment',
        Destination: settings.domain_wallet,
        Amount: tokenAmount,
      }
    )

    if (engineResult !== 'tesSUCCESS') {
      return NextResponse.json(
        { error: `Token delivery failed: ${engineResult}`, hash },
        { status: 500 }
      )
    }

    // Step 4: Record in investor_holdings
    const { data: existingHolding } = await supabase
      .from('investor_holdings')
      .select('id, token_balance')
      .eq('wallet_address', settings.domain_wallet)
      .eq('asset_id', asset.id)
      .single()

    const ownershipPercent = (feeTokens / asset.token_supply) * 100

    if (existingHolding) {
      await supabase
        .from('investor_holdings')
        .update({
          token_balance: Number(existingHolding.token_balance) + feeTokens,
          ownership_percent: ownershipPercent,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', existingHolding.id)
    } else {
      await supabase.from('investor_holdings').insert({
        wallet_address: settings.domain_wallet,
        asset_id: asset.id,
        token_balance: feeTokens,
        ownership_percent: ownershipPercent,
        last_synced_at: new Date().toISOString(),
      })
    }

    console.log(
      `[tokenization-fee] SUCCESS: ${feeTokens} ${asset.token_symbol} -> ${settings.domain_wallet} (tx: ${hash})`
    )

    return NextResponse.json({
      hash,
      engineResult,
      feeTokens,
      domainWallet: settings.domain_wallet,
      message: `${feeTokens} ${asset.token_symbol} tokenization fee sent to platform wallet`,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to send tokenization fee',
      },
      { status: 500 }
    )
  }
}
