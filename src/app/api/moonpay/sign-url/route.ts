import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { requireAuth } from '@/lib/api-auth'
import { getCustodialAddress, createCustodialWallet } from '@/lib/xrpl/wallet-manager'

/**
 * Signs a MoonPay widget URL with HMAC-SHA256.
 * MoonPay requires this so users can't tamper with widget parameters.
 *
 * POST body: {
 *   currencyCode: string,      // 'xrp' for testnet, 'rlusd' for mainnet
 *   baseCurrencyAmount?: number // optional USD amount to pre-fill
 * }
 *
 * Returns: { url: string } — the signed MoonPay widget URL
 */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { user } = auth

  try {
    const { currencyCode, baseCurrencyAmount } = await req.json()

    const apiKey = process.env.NEXT_PUBLIC_MOONPAY_API_KEY
    const secretKey = process.env.MOONPAY_SECRET_KEY

    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { error: 'MoonPay is not configured. Add API keys to environment.' },
        { status: 500 }
      )
    }

    // Ensure user has a custodial wallet (auto-create if needed)
    let walletAddress = await getCustodialAddress(user.id)
    if (!walletAddress) {
      const { address } = await createCustodialWallet(user.id)
      walletAddress = address
    }

    // Build MoonPay widget URL
    const isTestnet = !apiKey.startsWith('pk_live')
    const baseUrl = isTestnet
      ? 'https://buy-sandbox.moonpay.com'
      : 'https://buy.moonpay.com'

    const params = new URLSearchParams({
      apiKey,
      currencyCode: currencyCode ?? 'xrp',
      walletAddress,
      // Lock the wallet so user can't change it (funds must go to custodial wallet)
      lockAmount: 'false',
      showWalletAddressForm: 'false',
      // Pre-fill email for KYC
      email: user.email ?? '',
      // External ID for webhook matching
      externalTransactionId: `${user.id}_${Date.now()}`,
      // Color scheme
      colorCode: '%2316a34a', // green-600
    })

    if (baseCurrencyAmount) {
      params.set('baseCurrencyAmount', String(baseCurrencyAmount))
      params.set('baseCurrencyCode', 'usd')
    }

    // Sign the URL query string with HMAC-SHA256
    const queryString = '?' + params.toString()
    const signature = createHmac('sha256', secretKey)
      .update(queryString)
      .digest('base64')

    params.set('signature', signature)

    const signedUrl = `${baseUrl}?${params.toString()}`

    return NextResponse.json({
      url: signedUrl,
      walletAddress,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate MoonPay URL' },
      { status: 500 }
    )
  }
}
