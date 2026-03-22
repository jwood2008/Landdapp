'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserCheck, UserX, Loader2, Clock, Wallet, ShieldPlus } from 'lucide-react'

interface PendingUser {
  id: string
  email: string
  full_name: string | null
  role: string
  wallet_preference: string | null
  terms_accepted_at: string | null
  created_at: string
}

interface Props {
  pendingUsers: PendingUser[]
}

export function PendingAccounts({ pendingUsers }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleAction(userId: string, action: 'approve' | 'reject') {
    setLoading(userId)
    setError(null)
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSuccess(`Account ${action === 'approve' ? 'approved' : 'rejected'}`)
      router.refresh()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account')
    } finally {
      setLoading(null)
    }
  }

  if (pendingUsers.length === 0) return null

  return (
    <Card className="border-warning/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-status-warning">
            <Clock className="h-4 w-4 text-warning" />
          </div>
          <div>
            <CardTitle className="text-base">Pending Account Requests</CardTitle>
            <CardDescription>{pendingUsers.length} account{pendingUsers.length !== 1 ? 's' : ''} awaiting approval</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-xs text-success">
            {success}
          </div>
        )}

        {pendingUsers.map((user) => {
          const isLoading = loading === user.id
          return (
            <div
              key={user.id}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{user.full_name ?? 'No name'}</span>
                  <Badge variant="secondary" className="text-xs capitalize">{user.role}</Badge>
                  {user.wallet_preference === 'custodial' ? (
                    <Badge className="text-xs bg-status-info text-info gap-0.5">
                      <ShieldPlus className="h-2.5 w-2.5" /> Custodial
                    </Badge>
                  ) : (
                    <Badge className="text-xs bg-teal-500/10 text-teal-500 gap-0.5">
                      <Wallet className="h-2.5 w-2.5" /> Self-custody
                    </Badge>
                  )}
                  {user.terms_accepted_at && (
                    <Badge className="text-xs bg-status-success text-success">Terms signed</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{user.email}</span>
                  <span>Registered {new Date(user.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <Button
                  size="sm"
                  className="gap-1 h-7 text-xs"
                  onClick={() => handleAction(user.id, 'approve')}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive"
                  onClick={() => handleAction(user.id, 'reject')}
                  disabled={isLoading}
                >
                  <UserX className="h-3 w-3" />
                  Reject
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
