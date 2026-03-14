'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users, UserPlus, ShieldCheck, Search, CheckCircle, XCircle,
  Loader2, ChevronDown, ChevronRight, Globe, BadgeCheck,
  AlertTriangle, Shield, Key,
} from 'lucide-react'

interface Investor {
  id: string
  wallet_address: string
  full_name: string | null
  email: string | null
  kyc_status: string
  aml_cleared: boolean
  accredited: boolean
  country_code: string | null
  notes: string | null
  created_at: string
}

interface Authorization {
  id: string
  investor_id: string
  asset_id: string
  status: string
}

interface Asset {
  id: string
  asset_name: string
  token_symbol: string
  issuer_wallet: string
  is_active: boolean
}

interface Props {
  investors: Investor[]
  authorizations: Authorization[]
  assets: Asset[]
  settings: { auto_authorize_tokens: boolean } | null
}

const KYC_BADGES: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-amber-500/10 text-amber-500', label: 'Pending' },
  submitted: { color: 'bg-blue-500/10 text-blue-500', label: 'Submitted' },
  verified: { color: 'bg-green-500/10 text-green-500', label: 'Verified' },
  rejected: { color: 'bg-red-500/10 text-red-500', label: 'Rejected' },
  expired: { color: 'bg-gray-500/10 text-gray-500', label: 'Expired' },
}

function truncAddr(a: string) {
  return `${a.slice(0, 10)}...${a.slice(-6)}`
}

export function PlatformInvestorManager({ investors, authorizations, assets, settings }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Add investor form
  const [showAdd, setShowAdd] = useState(false)
  const [newWallet, setNewWallet] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newCountry, setNewCountry] = useState('')
  const [adding, setAdding] = useState(false)

  const verifiedCount = investors.filter((i) => i.kyc_status === 'verified').length
  const pendingCount = investors.filter((i) => i.kyc_status === 'pending').length
  const amlCount = investors.filter((i) => i.aml_cleared).length

  const filtered = investors.filter((inv) => {
    if (filter !== 'all' && inv.kyc_status !== filter) return false
    if (search) {
      const s = search.toLowerCase()
      return (
        inv.wallet_address.toLowerCase().includes(s) ||
        (inv.full_name?.toLowerCase().includes(s)) ||
        (inv.email?.toLowerCase().includes(s))
      )
    }
    return true
  })

  function getInvestorAuths(investorId: string) {
    return authorizations.filter((a) => a.investor_id === investorId)
  }

  async function approveKyc(investorId: string) {
    setLoading(investorId)
    setError(null)
    try {
      const res = await fetch('/api/platform/investors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: investorId, kyc_status: 'verified', aml_cleared: true }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSuccess('Investor approved')
      router.refresh()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setLoading(null)
    }
  }

  async function rejectKyc(investorId: string) {
    setLoading(investorId)
    setError(null)
    try {
      const res = await fetch('/api/platform/investors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: investorId, kyc_status: 'rejected' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject')
    } finally {
      setLoading(null)
    }
  }

  async function authorizeAll(investorId: string) {
    setLoading(`auth-${investorId}`)
    setError(null)
    try {
      const res = await fetch('/api/platform/authorize-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ investorId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSuccess(`Authorized for ${data.count} new token(s)`)
      router.refresh()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to authorize')
    } finally {
      setLoading(null)
    }
  }

  async function addInvestor() {
    if (!newWallet) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/platform/investors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: newWallet,
          full_name: newName || null,
          email: newEmail || null,
          country_code: newCountry || null,
          kyc_status: 'pending',
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setNewWallet('')
      setNewName('')
      setNewEmail('')
      setNewCountry('')
      setShowAdd(false)
      setSuccess('Investor added to platform')
      router.refresh()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add investor')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Investors</p>
                <p className="text-2xl font-bold">{investors.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                <ShieldCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">KYC Verified</p>
                <p className="text-2xl font-bold">{verifiedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending KYC</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10">
                <Shield className="h-5 w-5 text-teal-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">AML Cleared</p>
                <p className="text-2xl font-bold">{amlCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="input w-full pl-10"
              placeholder="Search by wallet, name, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <select
          className="input w-36 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="submitted">Submitted</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
        <Button onClick={() => setShowAdd(!showAdd)} className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          Add Investor
        </Button>
      </div>

      {/* Add investor form */}
      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add New Investor</CardTitle>
            <CardDescription>Register a new investor in the permission domain</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Wallet Address *</label>
                <input
                  className="input w-full font-mono text-sm"
                  placeholder="rXXX..."
                  value={newWallet}
                  onChange={(e) => setNewWallet(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                <input
                  className="input w-full"
                  placeholder="John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input
                  className="input w-full"
                  placeholder="john@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Country Code</label>
                <input
                  className="input w-full"
                  placeholder="US"
                  maxLength={2}
                  value={newCountry}
                  onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={addInvestor} disabled={!newWallet || adding} className="gap-1.5">
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {adding ? 'Adding...' : 'Add to Platform'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm text-green-600 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Investor list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filter === 'all' ? 'All Investors' : `${KYC_BADGES[filter]?.label ?? filter} Investors`}
            <span className="ml-2 text-sm font-normal text-muted-foreground">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                {investors.length === 0 ? 'No investors registered yet.' : 'No investors match your search.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((inv) => {
                const kyc = KYC_BADGES[inv.kyc_status] ?? KYC_BADGES.pending
                const auths = getInvestorAuths(inv.id)
                const authorizedCount = auths.filter((a) => a.status === 'authorized').length
                const isExpanded = expandedId === inv.id
                const isLoading = loading === inv.id || loading === `auth-${inv.id}`

                return (
                  <div key={inv.id} className="rounded-lg border border-border overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/10"
                      onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/40 shrink-0">
                          {inv.kyc_status === 'verified' ? (
                            <ShieldCheck className="h-4 w-4 text-green-500" />
                          ) : (
                            <Users className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm">{truncAddr(inv.wallet_address)}</span>
                            <Badge className={`text-[10px] ${kyc.color}`}>{kyc.label}</Badge>
                            {inv.aml_cleared && (
                              <Badge className="text-[10px] bg-teal-500/10 text-teal-500">AML</Badge>
                            )}
                            {inv.accredited && (
                              <Badge className="text-[10px] bg-purple-500/10 text-purple-500 gap-0.5">
                                <BadgeCheck className="h-2.5 w-2.5" /> Accredited
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            {inv.full_name && <span>{inv.full_name}</span>}
                            {inv.email && <span>{inv.email}</span>}
                            {inv.country_code && (
                              <span className="flex items-center gap-0.5">
                                <Globe className="h-3 w-3" /> {inv.country_code}
                              </span>
                            )}
                            <span>{authorizedCount}/{assets.length} tokens</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {inv.kyc_status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              className="gap-1 h-7 text-xs"
                              onClick={(e) => { e.stopPropagation(); approveKyc(inv.id) }}
                              disabled={isLoading}
                            >
                              {loading === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive"
                              onClick={(e) => { e.stopPropagation(); rejectKyc(inv.id) }}
                              disabled={isLoading}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {inv.kyc_status === 'verified' && authorizedCount < assets.length && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-7 text-xs"
                            onClick={(e) => { e.stopPropagation(); authorizeAll(inv.id) }}
                            disabled={isLoading}
                          >
                            {loading === `auth-${inv.id}` ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Key className="h-3 w-3" />
                            )}
                            Authorize All
                          </Button>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/10 px-4 py-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                          <div>
                            <p className="text-muted-foreground">Full Wallet</p>
                            <p className="font-mono break-all mt-0.5">{inv.wallet_address}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Joined</p>
                            <p className="mt-0.5">{new Date(inv.created_at).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">KYC Status</p>
                            <p className="mt-0.5 capitalize">{inv.kyc_status}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Notes</p>
                            <p className="mt-0.5">{inv.notes ?? '—'}</p>
                          </div>
                        </div>

                        {/* Per-asset authorizations */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Token Authorizations</p>
                          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                            {assets.map((asset) => {
                              const auth = auths.find((a) => a.asset_id === asset.id)
                              return (
                                <div
                                  key={asset.id}
                                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium">{asset.token_symbol}</span>
                                    <span className="text-[11px] text-muted-foreground">{asset.asset_name}</span>
                                  </div>
                                  {auth?.status === 'authorized' ? (
                                    <Badge className="text-[10px] bg-green-500/10 text-green-500 gap-0.5">
                                      <CheckCircle className="h-2.5 w-2.5" /> Authorized
                                    </Badge>
                                  ) : auth?.status === 'pending' ? (
                                    <Badge className="text-[10px] bg-amber-500/10 text-amber-500">Pending</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px]">Not authorized</Badge>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
