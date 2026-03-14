import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/lib/button-variants'
import { cn } from '@/lib/utils'
import { TokenIssuanceManager } from '@/components/admin/token-issuance-manager'

export default async function IssueTokensPage() {
  const supabase = await createClient()

  // Fetch all active assets
  const { data: assets } = await supabase
    .from('assets')
    .select('id, asset_name, token_symbol, token_supply, issuer_wallet, current_valuation, nav_per_token')
    .eq('is_active', true)
    .order('asset_name')

  // Fetch approved investor trust lines
  const { data: approvals } = await supabase
    .from('investor_approvals')
    .select('id, asset_id, investor_address, status, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  // Fetch existing holdings to show current balances
  const { data: holdings } = await supabase
    .from('investor_holdings')
    .select('asset_id, wallet_address, token_balance, ownership_percent')

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            '-ml-2 gap-1.5 text-muted-foreground'
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Issue Tokens</h1>
        <p className="text-muted-foreground">
          Send tokens to approved investors via Xaman-signed XRPL Payment transactions
        </p>
      </div>

      <TokenIssuanceManager
        assets={(assets ?? []) as Array<{
          id: string
          asset_name: string
          token_symbol: string
          token_supply: number
          issuer_wallet: string
          current_valuation: number
          nav_per_token: number
        }>}
        approvals={(approvals ?? []) as Array<{
          id: string
          asset_id: string
          investor_address: string
          status: string
          created_at: string
        }>}
        holdings={(holdings ?? []) as Array<{
          asset_id: string
          wallet_address: string
          token_balance: number
          ownership_percent: number
        }>}
      />
    </div>
  )
}
