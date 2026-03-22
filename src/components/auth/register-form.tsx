'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Building2, TrendingUp } from 'lucide-react'
import { WalletChoiceModal } from './wallet-choice-modal'

type AccountRole = 'investor' | 'issuer'
type WalletChoice = 'existing' | 'custodial'

export function RegisterForm() {
  const [step, setStep] = useState<'wallet-choice' | 'form'>('wallet-choice')
  const [walletPreference, setWalletPreference] = useState<WalletChoice | null>(null)
  const [role, setRole] = useState<AccountRole | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleWalletChoice(choice: WalletChoice) {
    setWalletPreference(choice)
    setStep('form')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!role) {
      setError('Please select your account type')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          wallet_preference: walletPreference,
          terms_accepted_at: walletPreference === 'custodial' ? new Date().toISOString() : null,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6 text-center space-y-3">
        <p className="font-medium text-lg">Check your email</p>
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent a confirmation link to <strong>{email}</strong>.
          Click it to activate your account.
        </p>
        <div className="rounded-md bg-status-warning border border-warning/20 p-3">
          <p className="text-xs text-warning font-medium">Account approval required</p>
          <p className="text-xs text-muted-foreground mt-1">
            After confirming your email, your account will be reviewed by our team before you can access the platform.
            This usually takes less than 24 hours.
          </p>
        </div>
      </div>
    )
  }

  // Step 1: Wallet choice modal
  if (step === 'wallet-choice') {
    return <WalletChoiceModal onChoice={handleWalletChoice} />
  }

  // Step 2: Registration form
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Wallet preference indicator */}
      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Wallet: <span className="font-medium text-foreground">
            {walletPreference === 'custodial' ? 'Platform-managed' : 'Self-custody (connect later)'}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setStep('wallet-choice')}
          className="text-xs text-primary hover:underline"
        >
          Change
        </button>
      </div>

      {/* Role selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">I am a...</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole('investor')}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all ${
              role === 'investor'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border hover:border-primary/40'
            }`}
          >
            <TrendingUp className={`h-6 w-6 ${role === 'investor' ? 'text-primary' : 'text-muted-foreground'}`} />
            <div>
              <p className="text-sm font-semibold">Investor</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Buy land tokens, earn royalties
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setRole('issuer')}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all ${
              role === 'issuer'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border hover:border-primary/40'
            }`}
          >
            <Building2 className={`h-6 w-6 ${role === 'issuer' ? 'text-primary' : 'text-muted-foreground'}`} />
            <div>
              <p className="text-sm font-semibold">Landowner / Issuer</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Tokenize land, raise capital
              </p>
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="fullName" className="text-sm font-medium">
          Full name
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Smith"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
          required
          minLength={8}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full py-3 text-sm" disabled={loading || !role}>
        {loading ? 'Creating account...' : 'Create account'}
      </Button>
    </form>
  )
}
