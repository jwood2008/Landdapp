'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Upload, Loader2, Brain, CheckCircle, Trash2, FileText, AlertCircle, Wallet, Zap, ShieldCheck } from 'lucide-react'
import type { OracleMethod } from '@/types/database'

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
      is_active: true,
    }).select().single()

    if (dbError || !newAsset) {
      setError(dbError?.message ?? 'Failed to create asset')
      setLoading(false)
      return
    }

    // Auto-link the issuer wallet to the issuer's account (issuers don't create personal wallets)
    if (form.owner_id && form.issuer_wallet) {
      await supabase.from('wallets').upsert(
        {
          user_id: form.owner_id,
          address: form.issuer_wallet,
          label: `${form.token_symbol.toUpperCase()} Token Wallet`,
          is_primary: true,
        },
        { onConflict: 'address' }
      )
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
                  <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2.5">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{ownerFound.full_name ?? ownerFound.email}</p>
                      <p className="text-xs text-muted-foreground">{ownerFound.email}</p>
                    </div>
                    <Badge className="text-[10px] bg-primary/10 text-primary shrink-0">
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
                      <p className="text-[10px] text-muted-foreground">Or select an existing issuer:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {issuers.map((issuer) => (
                          <button
                            key={issuer.id}
                            type="button"
                            className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              setOwnerFound(issuer)
                              setOwnerEmail(issuer.email)
                              update('owner_id', issuer.id)
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
            <p className="text-xs text-muted-foreground mt-1">
              % of tokens the owner keeps. When selling, admin issues these to marketplace.
            </p>
          </Field>

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
                      <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2.5">
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        <code className="text-xs font-mono break-all flex-1">{form.issuer_wallet}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        {requireAuthEnabled ? (
                          <Badge className="text-[10px] bg-green-500/10 text-green-500 border-green-500/20 gap-1">
                            <ShieldCheck className="h-2.5 w-2.5" />
                            Permission Domain Active
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1">
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
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">{contractTerms.fileName}</span>
                    <Badge className="text-[10px] bg-primary/10 text-primary gap-1">
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
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tenant</p>
                      <p className="text-sm font-medium">{contractTerms.tenant_name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Annual Amount</p>
                    <p className="text-sm font-semibold">
                      {contractTerms.annual_amount
                        ? `$${contractTerms.annual_amount.toLocaleString()}`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Frequency</p>
                    <p className="text-sm font-medium">{frequencyLabel(contractTerms.payment_frequency)}</p>
                  </div>
                  {contractTerms.escalation_rate && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Escalation</p>
                      <p className="text-sm font-medium">{contractTerms.escalation_rate}%/yr</p>
                    </div>
                  )}
                  {contractTerms.lease_start_date && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Start</p>
                      <p className="text-sm font-medium">
                        {new Date(contractTerms.lease_start_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {contractTerms.lease_end_date && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">End</p>
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
