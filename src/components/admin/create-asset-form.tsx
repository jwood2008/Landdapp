'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Upload, Loader2, Brain, CheckCircle, Trash2, FileText, AlertCircle, Wallet, Zap, ShieldCheck, Lock, Globe, UserPlus, X, Mail, Users } from 'lucide-react'
import type { OracleMethod, AccessType } from '@/types/database'

const ASSET_TYPES = [
  { value: 'land', label: 'Land' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'aircraft', label: 'Aircraft' },
  { value: 'vessel', label: 'Vessel' },
  { value: 'energy', label: 'Energy' },
  { value: 'private_credit', label: 'Private Credit' },
  { value: 'infrastructure', label: 'Infrastructure' },
]

const ORACLE_OPTIONS: { value: OracleMethod; label: string; description: string }[] = [
  {
    value: 'manual',
    label: 'Manual',
    description: 'Issuer updates yield and valuation manually. Best for annual appraisal cycles.',
  },
  {
    value: 'lease_income',
    label: 'Lease Income Oracle',
    description: 'Yield auto-calculated from trailing 12-month LEASE distributions ÷ current valuation. Updates every time a lease distribution is recorded.',
  },
  {
    value: 'external_feed',
    label: 'External Data Feed',
    description: 'Valuation pulled from a third-party property data API on a schedule. Requires API configuration after creation.',
  },
]

interface Issuer {
  id: string
  email: string
  full_name: string | null
  role: string
}

export function CreateAssetForm({ issuers = [] }: { issuers?: Issuer[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Access type state
  const [accessType, setAccessType] = useState<AccessType>('public')
  const [maxMembers, setMaxMembers] = useState('')
  const [inviteEmails, setInviteEmails] = useState<string[]>([])
  const [inviteInput, setInviteInput] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Owner email lookup state
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerLooking, setOwnerLooking] = useState(false)
  const [ownerFound, setOwnerFound] = useState<Issuer | null>(null)
  const [ownerError, setOwnerError] = useState<string | null>(null)

  // Contract upload state
  const [contractFile, setContractFile] = useState<File | null>(null)
  const [contractUploading, setContractUploading] = useState(false)
  const [contractParsing, setContractParsing] = useState(false)
  const [contractError, setContractError] = useState<string | null>(null)
  const [contractTerms, setContractTerms] = useState<{
    filePath: string
    fileName: string
    tenant_name: string | null
    annual_amount: number | null
    payment_frequency: string | null
    payment_due_day: number | null
    lease_start_date: string | null
    lease_end_date: string | null
    escalation_rate: number | null
    escalation_type: string | null
    currency: string
    summary: string | null
  } | null>(null)

  // Wallet generation state
  const [walletMode, setWalletMode] = useState<'generate' | 'manual'>('generate')
  const [generatingWallet, setGeneratingWallet] = useState(false)
  const [walletGenerated, setWalletGenerated] = useState(false)
  const [requireAuthEnabled, setRequireAuthEnabled] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)

  // Owner personal wallet state
  const [ownerWalletMode, setOwnerWalletMode] = useState<'generate' | 'manual'>('generate')
  const [generatingOwnerWallet, setGeneratingOwnerWallet] = useState(false)
  const [ownerWalletGenerated, setOwnerWalletGenerated] = useState(false)
  const [ownerWalletError, setOwnerWalletError] = useState<string | null>(null)

  const [form, setForm] = useState({
    asset_name: '',
    asset_type: 'land',
    llc_name: '',
    description: '',
    location: '',
    total_acres: '',
    token_symbol: '',
    token_supply: '',
    issuer_wallet: '',
    current_valuation: '',
    nav_per_token: '',
    annual_yield: '',
    oracle_method: 'manual' as OracleMethod,
    owner_id: '',
    owner_retained_percent: '',
    owner_wallet: '',
  })

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function lookupOwnerByEmail() {
    if (!ownerEmail.trim()) return
    setOwnerLooking(true)
    setOwnerError(null)
    setOwnerFound(null)

    try {
      const supabase = createClient()
      const { data, error: lookupErr } = await supabase
        .from('users')
        .select('id, email, full_name, role')
        .eq('email', ownerEmail.trim().toLowerCase())
        .single()

      if (lookupErr || !data) {
        setOwnerError('No user found with that email. Make sure they have an account on the platform.')
        update('owner_id', '')
        return
      }

      // If user is not already an issuer, update their role
      if (data.role !== 'issuer' && data.role !== 'admin') {
        const { error: roleErr } = await supabase
          .from('users')
          .update({ role: 'issuer' })
          .eq('id', data.id)

        if (roleErr) {
          setOwnerError('User found but failed to set issuer role. Try again.')
          return
        }
        data.role = 'issuer'
      }

      setOwnerFound(data as Issuer)
      update('owner_id', data.id)
      checkExistingOwnerWallet(data.id)
    } catch {
      setOwnerError('Failed to look up user')
    } finally {
      setOwnerLooking(false)
    }
  }

  async function handleContractUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setContractError('Only PDF files are accepted')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setContractError('File must be under 20MB')
      return
    }

    setContractFile(file)
    setContractError(null)
    setContractUploading(true)

    try {
      const supabase = createClient()
      // Upload to a temp path — will be linked to asset after creation
      const filePath = `pending/${Date.now()}_${file.name}`

      const { error: uploadErr } = await supabase.storage
        .from('asset-contracts')
        .upload(filePath, file, { contentType: 'application/pdf', upsert: false })

      if (uploadErr) throw uploadErr

      setContractUploading(false)
      setContractParsing(true)

      // Parse with AI — use a dummy assetId since asset doesn't exist yet
      // We'll save the contract record after asset creation
      const res = await fetch('/api/parse-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: 'pending', filePath, fileName: file.name }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to parse contract')

      // Store extracted terms (we'll create the DB record after asset creation)
      setContractTerms({
        filePath,
        fileName: file.name,
        tenant_name: data.extracted?.tenant_name ?? null,
        annual_amount: data.extracted?.annual_amount ?? null,
        payment_frequency: data.extracted?.payment_frequency ?? null,
        payment_due_day: data.extracted?.payment_due_day ?? null,
        lease_start_date: data.extracted?.lease_start_date ?? null,
        lease_end_date: data.extracted?.lease_end_date ?? null,
        escalation_rate: data.extracted?.escalation_rate ?? null,
        escalation_type: data.extracted?.escalation_type ?? null,
        currency: data.extracted?.currency ?? 'USD',
        summary: data.extracted?.summary ?? null,
      })

      // If AI found annual_yield, auto-fill the yield field
      if (data.extracted?.annual_amount && form.current_valuation) {
        const yieldPct = (data.extracted.annual_amount / parseFloat(form.current_valuation)) * 100
        if (yieldPct > 0) {
          update('annual_yield', yieldPct.toFixed(1))
        }
      }
    } catch (err) {
      setContractError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setContractUploading(false)
      setContractParsing(false)
    }
  }

  function removeContract() {
    setContractFile(null)
    setContractTerms(null)
    setContractError(null)
  }

  async function handleGenerateWallet() {
    setGeneratingWallet(true)
    setWalletError(null)

    try {
      const res = await fetch('/api/admin/generate-token-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: form.token_symbol ? `${form.token_symbol} Issuer` : undefined }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate wallet')

      update('issuer_wallet', data.address)
      setWalletGenerated(true)
      setRequireAuthEnabled(data.requireAuthEnabled ?? false)
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Failed to generate wallet')
    } finally {
      setGeneratingWallet(false)
    }
  }

  async function handleGenerateOwnerWallet() {
    if (!form.owner_id) {
      setOwnerWalletError('Select an owner first')
      return
    }
    setGeneratingOwnerWallet(true)
    setOwnerWalletError(null)

    try {
      const res = await fetch('/api/admin/generate-owner-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: form.owner_id }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate wallet')

      update('owner_wallet', data.address)
      setOwnerWalletGenerated(true)
    } catch (err) {
      setOwnerWalletError(err instanceof Error ? err.message : 'Failed to generate owner wallet')
    } finally {
      setGeneratingOwnerWallet(false)
    }
  }

  // Check if selected owner already has a wallet
  async function checkExistingOwnerWallet(ownerId: string) {
    const supabase = createClient()
    const { data: existing } = await supabase
      .from('wallets')
      .select('address')
      .eq('user_id', ownerId)
      .eq('is_primary', true)
      .single()

    // Don't use the token wallet — check if it's actually a personal wallet
    if (existing) {
      const { data: custodial } = await supabase
        .from('custodial_wallets')
        .select('wallet_type')
        .eq('address', existing.address)
        .single()

      // Only use if it's an investor-type wallet (personal), not a token wallet
      if (!custodial || custodial.wallet_type === 'investor') {
        update('owner_wallet', existing.address)
        setOwnerWalletGenerated(true)
      }
    }
  }

  function frequencyLabel(freq: string | null) {
    if (freq === 'monthly') return 'Monthly'
    if (freq === 'quarterly') return 'Quarterly'
    if (freq === 'semi_annual') return 'Semi-Annual'
    if (freq === 'annual') return 'Annual'
    return freq ?? '—'
  }

  // Auto-compute NAV when supply + valuation are both filled
  function handleValuationChange(val: string) {
    update('current_valuation', val)
    const supply = parseFloat(form.token_supply)
    const valuation = parseFloat(val)
    if (supply > 0 && valuation > 0) {
      update('nav_per_token', (valuation / supply).toFixed(4))
    }
  }

  function handleSupplyChange(val: string) {
    update('token_supply', val)
    const supply = parseFloat(val)
    const valuation = parseFloat(form.current_valuation)
    if (supply > 0 && valuation > 0) {
      update('nav_per_token', (valuation / supply).toFixed(4))
    }
  }

  function addInviteEmail() {
    const email = inviteInput.trim().toLowerCase()
    if (!email) return
    setInviteError(null)

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('Please enter a valid email address')
      return
    }
    if (inviteEmails.includes(email)) {
      setInviteError('This email has already been added')
      return
    }
    const max = parseInt(maxMembers)
    if (max > 0 && inviteEmails.length >= max) {
      setInviteError(`Maximum ${max} members allowed`)
      return
    }

    setInviteEmails((prev) => [...prev, email])
    setInviteInput('')
  }

  function removeInviteEmail(email: string) {
    setInviteEmails((prev) => prev.filter((e) => e !== email))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    // Determine royalty frequency from contract if available
    const royaltyFrequency = contractTerms?.payment_frequency ?? 'quarterly'

    const { data: newAsset, error: dbError } = await supabase.from('assets').insert({
      asset_name: form.asset_name,
      asset_type: form.asset_type as never,
      llc_name: form.llc_name,
      description: form.description || null,
      location: form.location || null,
      total_acres: form.total_acres ? parseFloat(form.total_acres) : null,
      token_symbol: form.token_symbol.toUpperCase(),
      token_supply: parseInt(form.token_supply),
      issuer_wallet: form.issuer_wallet,
      current_valuation: parseFloat(form.current_valuation),
      nav_per_token: parseFloat(form.nav_per_token),
      annual_yield: form.oracle_method === 'lease_income'
        ? null
        : form.annual_yield ? parseFloat(form.annual_yield) : null,
      oracle_method: form.oracle_method,
      royalty_frequency: royaltyFrequency,
      owner_id: form.owner_id || null,
      owner_retained_percent: form.owner_retained_percent ? parseFloat(form.owner_retained_percent) : 0,
      owner_wallet: form.owner_wallet || null,
      access_type: accessType,
      max_members: accessType === 'private' && maxMembers ? parseInt(maxMembers) : null,
      is_active: true,
    }).select().single()

    if (dbError || !newAsset) {
      setError(dbError?.message ?? 'Failed to create asset')
      setLoading(false)
      return
    }

    // Link the owner's personal wallet to their account (if set)
    if (form.owner_id && form.owner_wallet) {
      await supabase.from('wallets').upsert(
        {
          user_id: form.owner_id,
          address: form.owner_wallet,
          label: 'Personal Wallet',
          is_primary: true,
        },
        { onConflict: 'address' }
      )
    }

    // Auto-send retained tokens to owner wallet (non-blocking)
    if (form.owner_wallet && parseFloat(form.owner_retained_percent) > 0) {
      fetch('/api/admin/send-retained-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: newAsset.id }),
      }).catch((err) => console.warn('Auto-send retained tokens failed:', err))
    }

    // Auto-send tokenization fee to platform domain wallet (non-blocking)
    fetch('/api/admin/send-tokenization-fee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: newAsset.id }),
    }).catch((err) => console.warn('Auto-send tokenization fee failed:', err))

    // Insert invitations for private assets
    if (accessType === 'private' && inviteEmails.length > 0) {
      const { data: { user } } = await supabase.auth.getUser()
      const invitations = inviteEmails.map((email) => ({
        asset_id: newAsset.id,
        email,
        user_id: null,
        status: 'pending' as const,
        invited_by: user?.id ?? null,
      }))
      await supabase.from('asset_invitations').insert(invitations)
    }

    // If contract was uploaded, create the contract record linked to the new asset
    if (contractTerms) {
      const { data: { user } } = await supabase.auth.getUser()

      // Deactivate any pending contract records (from the parse step)
      await supabase
        .from('asset_contracts')
        .update({ is_active: false })
        .eq('asset_id', 'pending')

      await supabase.from('asset_contracts').insert({
        asset_id: newAsset.id,
        file_name: contractTerms.fileName,
        file_path: contractTerms.filePath,
        tenant_name: contractTerms.tenant_name,
        annual_amount: contractTerms.annual_amount,
        payment_frequency: contractTerms.payment_frequency,
        payment_due_day: contractTerms.payment_due_day,
        lease_start_date: contractTerms.lease_start_date,
        lease_end_date: contractTerms.lease_end_date,
        escalation_rate: contractTerms.escalation_rate,
        escalation_type: contractTerms.escalation_type,
        currency: contractTerms.currency,
        summary: contractTerms.summary,
        is_active: true,
        parsed_at: new Date().toISOString(),
        uploaded_by: user?.id ?? null,
      })
    }

    router.push(`/admin/assets/${newAsset.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asset Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Asset Name" required>
            <input
              value={form.asset_name}
              onChange={(e) => update('asset_name', e.target.value)}
              placeholder="Wood Land Holdings"
              required
              className="input"
            />
          </Field>

          <Field label="Asset Type" required>
            <select
              value={form.asset_type}
              onChange={(e) => update('asset_type', e.target.value)}
              className="input"
            >
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>

          <Field label="LLC / SPV Name" required>
            <input
              value={form.llc_name}
              onChange={(e) => update('llc_name', e.target.value)}
              placeholder="Wood Land Holdings LLC"
              required
              className="input"
            />
          </Field>

          <Field label="Location">
            <input
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="United States"
              className="input"
            />
          </Field>

          <Field label="Total Acres">
            <input
              type="number"
              value={form.total_acres}
              onChange={(e) => update('total_acres', e.target.value)}
              placeholder="200"
              min="0"
              className="input"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Asset Owner (Issuer Email)">
              {ownerFound ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5">
                    <CheckCircle className="h-4 w-4 text-success shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{ownerFound.full_name ?? ownerFound.email}</p>
                      <p className="text-xs text-muted-foreground">{ownerFound.email}</p>
                    </div>
                    <Badge className="text-xs bg-primary/10 text-primary shrink-0">
                      {ownerFound.role}
                    </Badge>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => {
                        setOwnerFound(null)
                        setOwnerEmail('')
                        update('owner_id', '')
                      }}
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => { setOwnerEmail(e.target.value); setOwnerError(null) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupOwnerByEmail() } }}
                      placeholder="owner@example.com"
                      className="input flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={lookupOwnerByEmail}
                      disabled={ownerLooking || !ownerEmail.trim()}
                      className="shrink-0 gap-1.5"
                    >
                      {ownerLooking ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Look Up'
                      )}
                    </Button>
                  </div>
                  {ownerError && (
                    <div className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {ownerError}
                    </div>
                  )}
                  {issuers.length > 0 && !ownerEmail && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Or select an existing issuer:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {issuers.map((issuer) => (
                          <button
                            key={issuer.id}
                            type="button"
                            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              setOwnerFound(issuer)
                              setOwnerEmail(issuer.email)
                              update('owner_id', issuer.id)
                              checkExistingOwnerWallet(issuer.id)
                            }}
                          >
                            {issuer.full_name ?? issuer.email}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                The owner will be able to view their asset dashboard and issue royalty distributions to token holders.
                {!ownerFound && ' If the user isn\'t an issuer yet, their role will be updated automatically.'}
              </p>
            </Field>
          </div>

          <Field label="Owner Retained (%)">
            <input
              type="number"
              value={form.owner_retained_percent}
              onChange={(e) => update('owner_retained_percent', e.target.value)}
              placeholder="0"
              min="0"
              max="100"
              step="0.1"
              className="input"
            />
            {parseFloat(form.owner_retained_percent) > 0 && parseFloat(form.token_supply) > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Owner receives {Math.floor(parseFloat(form.token_supply) * parseFloat(form.owner_retained_percent) / 100)} of {form.token_supply} tokens at creation
              </p>
            )}
            {!form.owner_retained_percent && (
              <p className="text-xs text-muted-foreground mt-1">
                % of tokens sent to the owner&apos;s personal wallet at creation.
              </p>
            )}
          </Field>

          {/* Owner Personal Wallet — only shown when owner is set and retained > 0 */}
          {form.owner_id && parseFloat(form.owner_retained_percent) > 0 && (
            <div className="sm:col-span-2 space-y-3">
              <Field label="Owner Personal Wallet (XRPL)">
                <p className="text-xs text-muted-foreground mb-2">
                  Separate from the token wallet. Retained tokens will be sent here after creation.
                </p>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => { setOwnerWalletMode('generate'); if (!ownerWalletGenerated) update('owner_wallet', '') }}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      ownerWalletMode === 'generate'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <Zap className="h-3 w-3" />
                    Generate Wallet
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOwnerWalletMode('manual'); setOwnerWalletGenerated(false) }}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      ownerWalletMode === 'manual'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <Wallet className="h-3 w-3" />
                    Enter Address
                  </button>
                </div>

                {ownerWalletMode === 'generate' ? (
                  <>
                    {ownerWalletGenerated && form.owner_wallet ? (
                      <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5">
                        <CheckCircle className="h-4 w-4 text-success shrink-0" />
                        <code className="text-xs font-mono break-all flex-1">{form.owner_wallet}</code>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateOwnerWallet}
                        disabled={generatingOwnerWallet}
                        className="gap-2"
                      >
                        {generatingOwnerWallet ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                        ) : (
                          <><Zap className="h-3.5 w-3.5" /> Generate Owner Wallet</>
                        )}
                      </Button>
                    )}
                  </>
                ) : (
                  <input
                    value={form.owner_wallet}
                    onChange={(e) => update('owner_wallet', e.target.value)}
                    placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="input font-mono text-sm"
                  />
                )}

                {ownerWalletError && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive mt-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {ownerWalletError}
                  </div>
                )}
              </Field>
            </div>
          )}

          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Brief description of the asset..."
                rows={3}
                className="input resize-none"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Access Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Access Type
          </CardTitle>
          <CardDescription>
            Choose who can view and invest in this asset.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAccessType('public')}
              className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all ${
                accessType === 'public'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-muted-foreground/30 hover:bg-muted/20'
              }`}
            >
              {accessType === 'public' && (
                <div className="absolute top-3 right-3">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                accessType === 'public' ? 'bg-primary/10' : 'bg-muted/50'
              }`}>
                <Globe className={`h-6 w-6 ${accessType === 'public' ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">Public</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Visible to all investors on the marketplace
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAccessType('private')}
              className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all ${
                accessType === 'private'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-muted-foreground/30 hover:bg-muted/20'
              }`}
            >
              {accessType === 'private' && (
                <div className="absolute top-3 right-3">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                accessType === 'private' ? 'bg-primary/10' : 'bg-muted/50'
              }`}>
                <Lock className={`h-6 w-6 ${accessType === 'private' ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">Private</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Invite-only — hidden from uninvited investors
                </p>
              </div>
            </button>
          </div>

          {/* Private asset settings */}
          {accessType === 'private' && (
            <div className="space-y-5 rounded-xl border border-border bg-muted/10 p-5">
              <Field label="Maximum Members">
                <input
                  type="number"
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(e.target.value)}
                  placeholder="e.g. 10"
                  min="1"
                  className="input"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum number of investors who can hold this token. Leave blank for no limit.
                </p>
              </Field>

              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  Invite Members
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteInput}
                    onChange={(e) => { setInviteInput(e.target.value); setInviteError(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInviteEmail() } }}
                    placeholder="investor@example.com"
                    className="input flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addInviteEmail}
                    disabled={!inviteInput.trim()}
                    className="shrink-0 gap-1.5"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
                {inviteError && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {inviteError}
                  </div>
                )}

                {inviteEmails.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      {inviteEmails.length} member{inviteEmails.length !== 1 ? 's' : ''} invited
                      {maxMembers && ` of ${maxMembers} max`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {inviteEmails.map((email) => (
                        <div
                          key={email}
                          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"
                        >
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {email}
                          <button
                            type="button"
                            onClick={() => removeInviteEmail(email)}
                            className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {inviteEmails.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    You can also add members after creation from the asset detail page.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Token Configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Token Symbol" required>
            <input
              value={form.token_symbol}
              onChange={(e) => update('token_symbol', e.target.value.toUpperCase())}
              placeholder="WOD"
              maxLength={8}
              required
              className="input font-mono"
            />
          </Field>

          <Field label="Token Supply" required>
            <input
              type="number"
              value={form.token_supply}
              onChange={(e) => handleSupplyChange(e.target.value)}
              placeholder="1000000"
              min="1"
              required
              className="input"
            />
          </Field>

          <div className="sm:col-span-2 space-y-3">
            <Field label="Issuer Wallet (XRPL)" required>
              {/* Mode toggle */}
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => { setWalletMode('generate'); if (!walletGenerated) update('issuer_wallet', '') }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    walletMode === 'generate'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <Zap className="h-3 w-3" />
                  Generate Wallet
                </button>
                <button
                  type="button"
                  onClick={() => { setWalletMode('manual'); setWalletGenerated(false) }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    walletMode === 'manual'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <Wallet className="h-3 w-3" />
                  Use Own Wallet
                </button>
              </div>

              {walletMode === 'generate' ? (
                <>
                  {walletGenerated && form.issuer_wallet ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5">
                        <CheckCircle className="h-4 w-4 text-success shrink-0" />
                        <code className="text-xs font-mono break-all flex-1">{form.issuer_wallet}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        {requireAuthEnabled ? (
                          <Badge className="text-xs bg-status-success text-success border-success/20 gap-1">
                            <ShieldCheck className="h-2.5 w-2.5" />
                            Permission Domain Active
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-status-warning text-warning border-warning/20 gap-1">
                            <AlertCircle className="h-2.5 w-2.5" />
                            RequireAuth not set — enable in Permissions after creation
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleGenerateWallet}
                      disabled={generatingWallet}
                      className="w-full gap-2"
                    >
                      {generatingWallet ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating on XRPL...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          Generate Token Wallet
                        </>
                      )}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Creates a new XRPL wallet managed by the platform. Seed is encrypted and stored securely.
                  </p>
                </>
              ) : (
                <>
                  <input
                    value={form.issuer_wallet}
                    onChange={(e) => update('issuer_wallet', e.target.value)}
                    placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    required
                    className="input font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste an existing XRPL wallet address. You&apos;ll manage signing externally.
                  </p>
                </>
              )}

              {/* Hidden required input for form validation when in generate mode */}
              {walletMode === 'generate' && (
                <input
                  type="hidden"
                  value={form.issuer_wallet}
                  required
                />
              )}
            </Field>

            {walletError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {walletError}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Valuation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Current Valuation ($)" required>
            <input
              type="number"
              value={form.current_valuation}
              onChange={(e) => handleValuationChange(e.target.value)}
              placeholder="5000000"
              min="0"
              step="0.01"
              required
              className="input"
            />
          </Field>

          <Field label="NAV per Token ($)" required>
            <input
              type="number"
              value={form.nav_per_token}
              onChange={(e) => update('nav_per_token', e.target.value)}
              placeholder="Auto-computed"
              min="0"
              step="0.0001"
              required
              className="input"
            />
          </Field>

          <Field label={form.oracle_method === 'lease_income' ? 'Annual Yield (oracle)' : 'Annual Yield (%)'}>
            <input
              type="number"
              value={form.annual_yield}
              onChange={(e) => update('annual_yield', e.target.value)}
              placeholder={form.oracle_method === 'lease_income' ? 'Auto-calculated' : '8.0'}
              min="0"
              step="0.1"
              disabled={form.oracle_method === 'lease_income'}
              className="input disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {form.oracle_method === 'lease_income' && (
              <p className="text-xs text-muted-foreground mt-1">
                Set automatically from recorded lease distributions.
              </p>
            )}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Oracle Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            How should this asset&apos;s yield and valuation be kept up to date? Discuss this with your
            client before selecting — the chosen method should be documented in the operating agreement.
          </p>
          <div className="space-y-2">
            {ORACLE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  form.oracle_method === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/30'
                }`}
              >
                <input
                  type="radio"
                  name="oracle_method"
                  value={opt.value}
                  checked={form.oracle_method === opt.value}
                  onChange={() => update('oracle_method', opt.value)}
                  className="mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contract Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Lease / Operating Agreement
          </CardTitle>
          <CardDescription>
            Upload the contract PDF — AI will extract payment terms (amount, frequency, escalation)
            for automatic royalty distribution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {contractTerms ? (
            <>
              <div className="rounded-lg border border-success/20 bg-success/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium">{contractTerms.fileName}</span>
                    <Badge className="text-xs bg-primary/10 text-primary gap-1">
                      <Brain className="h-2.5 w-2.5" />
                      AI Parsed
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={removeContract}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {contractTerms.tenant_name && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Tenant</p>
                      <p className="text-sm font-medium">{contractTerms.tenant_name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Annual Amount</p>
                    <p className="text-sm font-semibold">
                      {contractTerms.annual_amount
                        ? `$${contractTerms.annual_amount.toLocaleString()}`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Frequency</p>
                    <p className="text-sm font-medium">{frequencyLabel(contractTerms.payment_frequency)}</p>
                  </div>
                  {contractTerms.escalation_rate && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Escalation</p>
                      <p className="text-sm font-medium">{contractTerms.escalation_rate}%/yr</p>
                    </div>
                  )}
                  {contractTerms.lease_start_date && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Start</p>
                      <p className="text-sm font-medium">
                        {new Date(contractTerms.lease_start_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {contractTerms.lease_end_date && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">End</p>
                      <p className="text-sm font-medium">
                        {new Date(contractTerms.lease_end_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                {contractTerms.summary && (
                  <p className="text-xs text-muted-foreground border-t pt-2">{contractTerms.summary}</p>
                )}
              </div>
            </>
          ) : (
            <label className="block cursor-pointer">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleContractUpload}
                disabled={contractUploading || contractParsing}
              />
              <div className="rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors p-8 text-center">
                {contractUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </div>
                ) : contractParsing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Brain className="h-8 w-8 text-primary animate-pulse" />
                    <p className="text-sm text-muted-foreground">AI is extracting payment terms...</p>
                    <p className="text-xs text-muted-foreground">This may take a moment</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">Upload Contract (PDF)</p>
                    <p className="text-xs text-muted-foreground">
                      AI extracts: tenant, annual amount, frequency, escalation, lease dates
                    </p>
                  </div>
                )}
              </div>
            </label>
          )}

          {contractError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {contractError}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Optional — you can also upload a contract later from the asset detail page.
          </p>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading || contractUploading || contractParsing}>
          {loading ? 'Creating...' : 'Create Asset'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  )
}
