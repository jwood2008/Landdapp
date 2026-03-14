import { createClient } from '@supabase/supabase-js'
import { signAndSubmitFromAddress, signAndSubmit } from './wallet-manager'
import { buildPaymentAmount } from './amount'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface FeeSettings {
  domain_wallet: string
  tokenization_fee_bps: number
  marketplace_fee_bps: number
}

/**
 * Fetch platform fee settings. Returns null if no domain wallet is configured.
 */
export async function getFeeSettings(): Promise<FeeSettings | null> {
  const supabase = getServiceClient()

  const { data } = await supabase
    .from('platform_settings')
    .select('domain_wallet, tokenization_fee_bps, marketplace_fee_bps')
    .limit(1)
    .single()

  if (!data?.domain_wallet) return null

  return {
    domain_wallet: data.domain_wallet,
    tokenization_fee_bps: data.tokenization_fee_bps ?? 100,
    marketplace_fee_bps: data.marketplace_fee_bps ?? 0,
  }
}

/**
 * Ensure the domain wallet has a trust line for a given token
 * so it can receive fee payments in that token.
 */
async function ensureDomainTrustLine(
  domainWallet: string,
  tokenSymbol: string,
  issuerWallet: string
): Promise<void> {
  if (tokenSymbol === 'XRP') return // XRP doesn't need trust lines

  try {
    const result = await signAndSubmitFromAddress(domainWallet, {
      TransactionType: 'TrustSet',
      LimitAmount: {
        currency: tokenSymbol,
        issuer: issuerWallet,
        value: '999999999',
      },
    })
    console.log(`[fee-collector] Domain trust line: ${result.engineResult} for ${tokenSymbol}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('tecDUPLICATE') && !msg.includes('already')) {
      console.warn('[fee-collector] Domain trust line warning:', msg)
    }
  }

  // Issuer authorizes the domain wallet's trust line (if RequireAuth is enabled)
  try {
    await signAndSubmitFromAddress(issuerWallet, {
      TransactionType: 'TrustSet',
      LimitAmount: {
        currency: tokenSymbol,
        issuer: domainWallet,
        value: '0',
      },
      Flags: 65536, // tfSetfAuth
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[fee-collector] Domain auth skipped:', msg)
  }
}

/**
 * Collect tokenization fee: send a percentage of purchased tokens
 * from the issuer wallet to the domain wallet.
 *
 * Called after tokens are delivered to the investor during primary buy.
 */
export async function collectTokenizationFee(params: {
  issuerWallet: string
  tokenSymbol: string
  tokenAmount: number
}): Promise<{ hash: string; feeAmount: number } | null> {
  const settings = await getFeeSettings()
  if (!settings || settings.tokenization_fee_bps <= 0) return null

  const feeAmount = (params.tokenAmount * settings.tokenization_fee_bps) / 10000
  if (feeAmount <= 0) return null

  // Ensure trust line exists
  await ensureDomainTrustLine(settings.domain_wallet, params.tokenSymbol, params.issuerWallet)

  // Send fee tokens from issuer to domain wallet
  const amount = buildPaymentAmount(params.tokenSymbol, String(feeAmount), params.issuerWallet)

  try {
    const result = await signAndSubmitFromAddress(params.issuerWallet, {
      TransactionType: 'Payment',
      Destination: settings.domain_wallet,
      Amount: amount,
    })

    if (result.engineResult === 'tesSUCCESS') {
      console.log(`[fee-collector] Tokenization fee: ${feeAmount} ${params.tokenSymbol} → ${settings.domain_wallet}`)
      return { hash: result.hash, feeAmount }
    }

    console.warn(`[fee-collector] Tokenization fee failed: ${result.engineResult}`)
    return null
  } catch (err) {
    console.error('[fee-collector] Tokenization fee error:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Collect exchange fee: send a percentage of the payment amount
 * from the buyer/seller to the domain wallet.
 *
 * Called after a secondary market trade completes.
 * The fee is taken from the buyer in the payment currency (XRP/RLUSD).
 */
export async function collectExchangeFee(params: {
  userId: string
  currency: string
  totalPayment: number
  issuerWallet: string
}): Promise<{ hash: string; feeAmount: number } | null> {
  const settings = await getFeeSettings()
  if (!settings || settings.marketplace_fee_bps <= 0) return null

  const feeAmount = (params.totalPayment * settings.marketplace_fee_bps) / 10000
  if (feeAmount <= 0) return null

  const amount = buildPaymentAmount(params.currency, String(feeAmount), params.issuerWallet)

  try {
    const result = await signAndSubmit(params.userId, {
      TransactionType: 'Payment',
      Destination: settings.domain_wallet,
      Amount: amount,
    })

    if (result.engineResult === 'tesSUCCESS') {
      console.log(`[fee-collector] Exchange fee: ${feeAmount} ${params.currency} → ${settings.domain_wallet}`)
      return { hash: result.hash, feeAmount }
    }

    console.warn(`[fee-collector] Exchange fee failed: ${result.engineResult}`)
    return null
  } catch (err) {
    console.error('[fee-collector] Exchange fee error:', err instanceof Error ? err.message : err)
    return null
  }
}
