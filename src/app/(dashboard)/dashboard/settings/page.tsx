import { createClient } from '@/lib/supabase/server'
import { SettingsTabs } from '@/components/settings/settings-tabs'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileRaw } = await supabase
    .from('users')
    .select('full_name, email, role')
    .eq('id', user!.id)
    .single()

  const profile = profileRaw as { full_name: string | null; email: string; role: string } | null

  const role = profile?.role ?? 'investor'

  const { data: walletsRaw } = await supabase
    .from('wallets')
    .select('id, address, label, is_primary, created_at')
    .eq('user_id', user!.id)
    .order('is_primary', { ascending: false })

  const wallets = (walletsRaw as {
    id: string
    address: string
    label: string | null
    is_primary: boolean
    created_at: string
  }[] | null) ?? []

  // For issuers, fetch their LLC/token wallets from assets they own
  let assetWallets: { asset_name: string; token_symbol: string; issuer_wallet: string }[] = []
  if (role === 'issuer') {
    const { data: assets } = await supabase
      .from('assets')
      .select('asset_name, token_symbol, issuer_wallet')
      .eq('owner_id', user!.id)
    assetWallets = (assets ?? []) as typeof assetWallets
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account, appearance, and wallet connections</p>
      </div>

      <SettingsTabs
        userId={user!.id}
        initialName={profile?.full_name ?? ''}
        email={profile?.email ?? user!.email!}
        wallets={wallets}
        role={role}
        assetWallets={assetWallets}
      />
    </div>
  )
}
