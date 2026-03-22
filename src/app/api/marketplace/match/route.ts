import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { syncHoldingsForWallet } from '@/lib/sync-holdings-server'
import { notifyTradeConfirmation } from '@/lib/email-notify'

/**
 * Match overlapping buy/sell orders for a given asset.
 * Creates trade records for any crossing orders.
 *
 * POST body: { asset_id: string }
 * Returns: { trades: Trade[], matchCount: number }
 */
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error
  const { supabase } = auth

  try {
    const { asset_id } = await req.json()
    if (!asset_id) {
      return NextResponse.json({ error: 'asset_id required' }, { status: 400 })
    }

    // Fetch open buy orders sorted by highest price first
    const { data: buyOrders } = await supabase
      .from('marketplace_orders')
      .select('*')
      .eq('asset_id', asset_id)
      .eq('side', 'buy')
      .in('status', ['open', 'partial'])
      .order('price_per_token', { ascending: false })

    // Fetch open sell orders sorted by lowest price first
    const { data: sellOrders } = await supabase
      .from('marketplace_orders')
      .select('*')
      .eq('asset_id', asset_id)
      .eq('side', 'sell')
      .in('status', ['open', 'partial'])
      .order('price_per_token', { ascending: true })

    if (!buyOrders?.length || !sellOrders?.length) {
      return NextResponse.json({ trades: [], matchCount: 0 })
    }

    const trades: Array<{
      buy_order_id: string
      sell_order_id: string
      asset_id: string
      buyer_id: string
      seller_id: string
      token_amount: number
      price_per_token: number
      total_price: number
      currency: string
    }> = []

    // Simple matching: iterate buy orders (highest price first) against sell orders (lowest price first)
    for (const buy of buyOrders) {
      const buyRemaining = buy.token_amount - (buy.filled_amount ?? 0)
      if (buyRemaining <= 0) continue

      for (const sell of sellOrders) {
        // Skip if same investor
        if (buy.investor_id === sell.investor_id) continue

        // Check price overlap: buy price >= sell price
        if (buy.price_per_token < sell.price_per_token) break // No more matches possible

        const sellRemaining = sell.token_amount - (sell.filled_amount ?? 0)
        if (sellRemaining <= 0) continue

        // Trade at the sell price (price improvement for buyer)
        const tradeAmount = Math.min(buyRemaining, sellRemaining)
        const tradePrice = sell.price_per_token

        trades.push({
          buy_order_id: buy.id,
          sell_order_id: sell.id,
          asset_id,
          buyer_id: buy.investor_id,
          seller_id: sell.investor_id,
          token_amount: tradeAmount,
          price_per_token: tradePrice,
          total_price: tradeAmount * tradePrice,
          currency: buy.currency,
        })

        // Update filled amounts
        const newBuyFilled = (buy.filled_amount ?? 0) + tradeAmount
        const newSellFilled = (sell.filled_amount ?? 0) + tradeAmount

        await supabase
          .from('marketplace_orders')
          .update({
            filled_amount: newBuyFilled,
            status: newBuyFilled >= buy.token_amount ? 'filled' : 'partial',
            updated_at: new Date().toISOString(),
          })
          .eq('id', buy.id)

        await supabase
          .from('marketplace_orders')
          .update({
            filled_amount: newSellFilled,
            status: newSellFilled >= sell.token_amount ? 'filled' : 'partial',
            updated_at: new Date().toISOString(),
          })
          .eq('id', sell.id)

        // Update local state for continued matching
        buy.filled_amount = newBuyFilled
        sell.filled_amount = newSellFilled

        if (newBuyFilled >= buy.token_amount) break // This buy order is fully filled
      }
    }

    // Insert trade records
    if (trades.length > 0) {
      const { data: insertedTrades, error } = await supabase
        .from('trades')
        .insert(trades.map((t) => ({
          ...t,
          status: 'pending',
        })))
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Sync holdings for all involved investors so portfolios reflect new balances
      const involvedInvestorIds = [
        ...new Set(trades.flatMap((t) => [t.buyer_id, t.seller_id])),
      ]

      const { data: involvedInvestors } = await supabase
        .from('platform_investors')
        .select('wallet_address')
        .in('id', involvedInvestorIds)

      if (involvedInvestors?.length) {
        // Fire-and-forget sync for each wallet (uses service role, no auth needed)
        Promise.allSettled(
          involvedInvestors.map((inv) => syncHoldingsForWallet(inv.wallet_address))
        ).catch(() => {})
      }

      // Send email notifications for each trade (fire-and-forget)
      const { data: assetInfo } = await supabase
        .from('assets')
        .select('asset_name, token_symbol')
        .eq('id', asset_id)
        .single()

      if (assetInfo) {
        for (const t of trades) {
          const base = {
            assetName: assetInfo.asset_name,
            tokenSymbol: assetInfo.token_symbol,
            tokenAmount: t.token_amount,
            pricePerToken: t.price_per_token,
            totalPrice: t.total_price,
            currency: t.currency,
          }
          notifyTradeConfirmation(t.buyer_id, { ...base, side: 'buy' }).catch(() => {})
          notifyTradeConfirmation(t.seller_id, { ...base, side: 'sell' }).catch(() => {})
        }
      }

      return NextResponse.json({
        trades: insertedTrades,
        matchCount: insertedTrades?.length ?? 0,
      })
    }

    return NextResponse.json({ trades: [], matchCount: 0 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
