import { createClient } from '@/lib/supabase/server'
import { PermissionsManager } from '@/components/admin/permissions-manager'

export default async function PermissionsPage() {
  const supabase = await createClient()

  const [{ data: assets }, { data: approvals }] = await Promise.all([
    supabase
      .from('assets')
      .select('id, asset_name, token_symbol, issuer_wallet, require_auth')
      .order('asset_name'),
    supabase
      .from('investor_approvals')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Token Permissions</h1>
        <p className="text-base text-muted-foreground">
          Control which investors can hold your tokens using XRPL Authorized Trust Lines
        </p>
      </div>

      <PermissionsManager
        assets={(assets ?? []) as Array<{
          id: string
          asset_name: string
          token_symbol: string
          issuer_wallet: string
          require_auth: boolean
        }>}
        approvals={(approvals ?? []) as Array<{
          id: string
          asset_id: string
          investor_address: string
          status: string
          notes: string | null
          xrpl_tx_hash: string | null
          reviewed_at: string | null
          created_at: string
        }>}
      />
    </div>
  )
}
