import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TransactionHistory } from '@/components/dashboard/transaction-history'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user's wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('address')
    .eq('user_id', user.id)
    .eq('is_primary', true)
    .single()

  if (!wallet) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">Connect a wallet to view your transaction history</p>
        </div>
      </div>
    )
  }

  // Get investor record
  const { data: investor } = await supabase
    .from('platform_investors')
    .select('id')
    .eq('wallet_address', wallet.address)
    .single()

  // Fetch marketplace orders
  const { data: orders } = await supabase
    .from('marketplace_orders')
    .select(`
      id, side, token_amount, price_per_token, currency, filled_amount,
      status, xrpl_offer_tx, created_at, updated_at,
      assets ( asset_name, token_symbol )
    `)
    .eq('investor_id', investor?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(100)

  // Fetch trades where user is buyer or seller
  const investorId = investor?.id ?? ''

  const { data: buyTrades } = await supabase
    .from('trades')
    .select(`
      id, token_amount, price_per_token, total_price, currency,
      status, xrpl_tx_hash, settled_at, created_at,
      assets ( asset_name, token_symbol )
    `)
    .eq('buyer_id', investorId)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: sellTrades } = await supabase
    .from('trades')
    .select(`
      id, token_amount, price_per_token, total_price, currency,
      status, xrpl_tx_hash, settled_at, created_at,
      assets ( asset_name, token_symbol )
    `)
    .eq('seller_id', investorId)
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch distribution payments
  const { data: payments } = await supabase
    .from('distribution_payments')
    .select(`
      id, amount, currency, ownership_percent, status, tx_hash, created_at,
      distributions (
        event_type, royalty_period, is_royalty,
        assets ( asset_name, token_symbol )
      )
    `)
    .eq('wallet_address', wallet.address)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <TransactionHistory
      orders={orders ?? []}
      buyTrades={buyTrades ?? []}
      sellTrades={sellTrades ?? []}
      distributionPayments={payments ?? []}
      walletAddress={wallet.address}
    />
  )
}
