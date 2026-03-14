'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ProfileForm } from '@/components/settings/profile-form'
import { WalletManager } from '@/components/settings/wallet-manager'
import { PaymentSettings } from '@/components/settings/payment-settings'
import { AppearanceSettings } from '@/components/settings/appearance-settings'
import { Palette, CreditCard, User } from 'lucide-react'

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
}

export function SettingsTabs({ userId, initialName, email, wallets, role }: SettingsTabsProps) {
  const isIssuer = role === 'issuer'
  return (
    <Tabs defaultValue="profile">
      <TabsList variant="line" className="w-full justify-start gap-0 border-b border-border rounded-none px-0">
        <TabsTrigger value="profile" className="gap-2 px-4 py-2.5 text-sm">
          <User className="h-4 w-4" />
          Profile
        </TabsTrigger>
        <TabsTrigger value="payment" className="gap-2 px-4 py-2.5 text-sm">
          <CreditCard className="h-4 w-4" />
          Payment
        </TabsTrigger>
        <TabsTrigger value="appearance" className="gap-2 px-4 py-2.5 text-sm">
          <Palette className="h-4 w-4" />
          Appearance
        </TabsTrigger>
      </TabsList>

      <TabsContent value="appearance" className="pt-6">
        <div className="space-y-1 mb-6">
          <h2 className="text-base font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground">
            Customize the look and feel of the platform
          </p>
        </div>
        <AppearanceSettings />
      </TabsContent>

      <TabsContent value="payment" className="pt-6">
        <div className="space-y-8">
          {isIssuer ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Token Wallet</h2>
                <p className="text-sm text-muted-foreground">
                  Your issuer wallet is managed by the platform and linked to your tokenized asset.
                </p>
              </div>
              {wallets.length > 0 ? (
                <div className="space-y-2">
                  {wallets.map((w) => (
                    <div key={w.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <CreditCard className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-mono text-sm">{w.address}</p>
                        <p className="text-xs text-muted-foreground">{w.label ?? 'Token Issuer Wallet'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <CreditCard className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No token wallet assigned yet. Contact the platform admin.</p>
                </div>
              )}
            </section>
          ) : (
            <>
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Connected Wallets</h2>
                  <p className="text-sm text-muted-foreground">
                    XRPL wallets linked to your account. Holdings are read from your primary wallet.
                  </p>
                </div>
                <WalletManager userId={userId} wallets={wallets} />
              </section>

              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Payment Preferences</h2>
                  <p className="text-sm text-muted-foreground">
                    Choose how you want to receive payments when selling tokens or receiving distributions
                  </p>
                </div>
                <PaymentSettings />
              </section>
            </>
          )}
        </div>
      </TabsContent>

      <TabsContent value="profile" className="pt-6">
        <div className="space-y-1 mb-6">
          <h2 className="text-base font-semibold">Profile</h2>
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
