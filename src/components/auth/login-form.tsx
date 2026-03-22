'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useWalletStore } from '@/store/wallet'
import { Clock, XCircle } from 'lucide-react'

export function LoginForm() {
  const router = useRouter()
  const { disconnect } = useWalletStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingApproval, setPendingApproval] = useState(false)
  const [rejected, setRejected] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setPendingApproval(false)
    setRejected(false)

    // Clear any previous user's wallet state
    disconnect()

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Check account status and role
    const { data: profile } = await supabase
      .from('users')
      .select('role, account_status')
      .eq('email', email)
      .single()

    if (profile?.account_status === 'pending') {
      // Sign them out — they can't access the app yet
      await supabase.auth.signOut()
      setPendingApproval(true)
      setLoading(false)
      return
    }

    if (profile?.account_status === 'rejected') {
      await supabase.auth.signOut()
      setRejected(true)
      setLoading(false)
      return
    }

    // Redirect based on role
    const dest =
      profile?.role === 'issuer' ? '/issuer' :
      profile?.role === 'admin' ? '/admin' :
      '/dashboard'

    router.push(dest)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {pendingApproval && (
        <div className="rounded-lg border border-warning/20 bg-status-warning p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-warning">
            <Clock className="h-4 w-4" />
            <p className="text-sm font-medium">Account Pending Approval</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Your account is being reviewed by our team. You&apos;ll receive an email once approved. This usually takes less than 24 hours.
          </p>
        </div>
      )}

      {rejected && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-4 w-4" />
            <p className="text-sm font-medium">Account Not Approved</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Your account application was not approved. If you believe this is an error, please contact support.
          </p>
        </div>
      )}

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
          placeholder="••••••••"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full py-3 text-sm" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  )
}
