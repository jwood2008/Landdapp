import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { buildPaymentAmount, currencyLabel } from '@/lib/xrpl/amount'

/**
 * Creates a Xaman payload for a single distribution payment.
 * The admin signs in Xaman to send the actual on-chain payment.
 *
 * Body: { distributionPaymentId, issuerAddress }
 * Returns: { uuid, qrUrl, deepLink, paymentId }
 */
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error

  const { supabase } = auth

  try {
    const { distributionPaymentId, issuerAddress } = await req.json()

    if (!distributionPaymentId || !issuerAddress) {
      return NextResponse.json({ error: 'distributionPaymentId and issuerAddress required' }, { status: 400 })
    }

    // Fetch the payment record + distribution currency
    const { data: payment, error: fetchErr } = await supabase
      .from('distribution_payments')
      .select(`
        id, wallet_address, amount, currency, status,
        distributions ( id, currency, asset_id )
      `)
      .eq('id', distributionPaymentId)
      .single()

    if (fetchErr || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (payment.status === 'completed') {
      return NextResponse.json({ error: 'Payment already completed' }, { status: 400 })
    }

    // Mark as processing
    await supabase
      .from('distribution_payments')
      .update({ status: 'processing' })
      .eq('id', distributionPaymentId)

    const apiKey = process.env.XUMM_APIKEY
    const apiSecret = process.env.XUMM_APISECRET

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Xaman API not configured' }, { status: 500 })
    }

    const currency = payment.currency
    const amount = buildPaymentAmount(currency, String(payment.amount), issuerAddress)
    const label = currencyLabel(currency)
    const truncDest = `${payment.wallet_address.slice(0, 8)}...${payment.wallet_address.slice(-6)}`

    const payload = {
      txjson: {
        TransactionType: 'Payment',
        Account: issuerAddress,
        Destination: payment.wallet_address,
        Amount: amount,
      },
      options: {
        submit: true,
        expire: 300, // 5 minutes to sign
      },
      custom_meta: {
        instruction: `Distribution payout: Send ${payment.amount} ${label} to ${truncDest}`,
        identifier: distributionPaymentId,
      },
    }

    const res = await fetch('https://xumm.app/api/v1/platform/payload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-API-Secret': apiSecret,
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok || !data.uuid) {
      // Reset status back to pending on failure
      await supabase
        .from('distribution_payments')
        .update({ status: 'pending' })
        .eq('id', distributionPaymentId)

      return NextResponse.json(
        { error: data.error?.message ?? 'Failed to create Xaman payload' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      uuid: data.uuid,
      qrUrl: data.refs?.qr_png,
      deepLink: data.next?.always,
      paymentId: distributionPaymentId,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
