'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ProfileForm } from '@/components/settings/profile-form'
import { WalletManager } from '@/components/settings/wallet-manager'
import { PaymentSettings } from '@/components/settings/payment-settings'
import { AppearanceSettings } from '@/components/settings/appearance-settings'
import { NotificationSettings } from '@/components/settings/notification-settings'
import { Badge } from '@/components/ui/badge'
import { Palette, CreditCard, User, Building2, Wallet, Bell } from 'lucide-react'

interface SettingsTabsProps {
  userId: string
  initialName: string
  email: string
  wallets: {
    id: string
    address: string
    label: string | null
    is_primary: boolean
    created_at: string
  }[]
  role: string
  assetWallets?: { asset_name: string; token_symbol: string; issuer_wallet: string }[]
}

export function SettingsTabs({ userId, initialName, email, wallets, role, assetWallets = [] }: SettingsTabsProps) {
  const isIssuer = role === 'issuer'
  return (
    <Tabs defaultValue="profile">
      <TabsList variant="line" className="w-full justify-start gap-0 border-b border-border rounded-none px-0 overflow-x-auto flex-nowrap">
        <TabsTrigger value="profile" className="gap-2 px-5 py-3 text-sm">
          <User className="h-4 w-4" />
          Profile
        </TabsTrigger>
        <TabsTrigger value="payment" className="gap-2 px-5 py-3 text-sm">
          <CreditCard className="h-4 w-4" />
          {isIssuer ? 'Wallets & Payment' : 'Payment'}
        </TabsTrigger>
        <TabsTrigger value="notifications" className="gap-2 px-5 py-3 text-sm">
          <Bell className="h-4 w-4" />
          Notifications
        </TabsTrigger>
        <TabsTrigger value="appearance" className="gap-2 px-5 py-3 text-sm">
          <Palette className="h-4 w-4" />
          Appearance
        </TabsTrigger>
      </TabsList>

      <TabsContent value="notifications" className="pt-8">
        <div className="space-y-1 mb-6">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">
            Choose which email notifications you'd like to receive
          </p>
        </div>
        <NotificationSettings />
      </TabsContent>

      <TabsContent value="appearance" className="pt-8">
        <div className="space-y-1 mb-6">
          <h2 className="text-lg font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground">
            Customize the look and feel of the platform
          </p>
        </div>
        <AppearanceSettings />
      </TabsContent>

      <TabsContent value="payment" className="pt-8">
        <div className="space-y-8">
          {isIssuer && (
            <>
              {/* LLC / Token Wallets */}
              <section className="space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">LLC / Token Wallets</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    These are the asset wallets managed by the platform. Each tokenized asset has its own issuer wallet.
                  </p>
                </div>
                {assetWallets.length > 0 ? (
                  <div className="space-y-2">
                    {assetWallets.map((aw) => (
                      <div key={aw.issuer_wallet} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-sm truncate">{aw.issuer_wallet}</p>
                            <Badge variant="outline" className="text-xs shrink-0">{aw.token_symbol}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{aw.asset_name}</p>
                        </div>
                        <Badge className="text-xs bg-muted text-muted-foreground shrink-0">Platform Managed</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <Building2 className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No tokenized assets yet.</p>
                  </div>
                )}
              </section>
            </>
          )}

          {/* Wallets — shared across all roles */}
          <section className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">{isIssuer ? 'Personal Wallet' : 'Connected Wallets'}</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {isIssuer
                  ? 'Your personal wallet receives retained tokens and distributions. This is separate from the LLC wallets above.'
                  : 'XRPL wallets linked to your account. Holdings are read from your primary wallet.'}
              </p>
            </div>
            <WalletManager userId={userId} wallets={wallets} />
          </section>

          {/* Payment Preferences — shared across all roles */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Payment Preferences</h2>
              <p className="text-sm text-muted-foreground">
                {isIssuer
                  ? 'Choose how you want to receive payments from token sales and distributions'
                  : 'Choose how you want to receive payments when selling tokens or receiving distributions'}
              </p>
            </div>
            <PaymentSettings />
          </section>
        </div>
      </TabsContent>

      <TabsContent value="profile" className="pt-8">
        <div className="space-y-1 mb-6">
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">
            Update your name and account details
          </p>
        </div>
        <ProfileForm
          userId={userId}
          initialName={initialName}
          email={email}
        />
      </TabsContent>
    </Tabs>
  )
}
