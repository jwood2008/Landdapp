'use client'

import { useRef, useState } from 'react'
import {
  Calculator, Send, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Zap, Paperclip, Upload, X, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { AssetRow } from '@/types/database'

interface Holder {
  address: string
  balance: number
  percent: number
}

interface ContractTerms {
  annual_amount: number | null
  payment_frequency: string | null
  tenant_name: string | null
  lease_end_date: string | null
}

interface Props {
  asset: AssetRow
  holders: Holder[]
  issuerAddress: string
  onYieldUpdated?: (newYield: number) => void
  contract?: ContractTerms | null
}

interface UploadedDoc {
  name: string
  path: string
  size: number
}

function truncAddr(a: string) {
  return `${a.slice(0, 10)}...${a.slice(-6)}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ORACLE_LABELS: Record<string, string> = {
  lease_income: 'Auto — Lease Income Oracle',
  external_feed: 'Auto — External Feed Oracle',
  manual: 'Manual',
}

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function DistributionCalculator({ asset, holders, issuerAddress, onYieldUpdated, contract }: Props) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('RLUSD')
  const [eventType, setEventType] = useState<'LEASE' | 'REFINANCE' | 'VALUATION'>('LEASE')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedDistId, setSavedDistId] = useState<string | null>(null)
  const [savedYield, setSavedYield] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Document upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)

  const totalAmount = parseFloat(amount) || 0
  const totalHolder = holders.reduce((s, h) => s + h.percent, 0)
  const reserve = totalAmount * 0.1
  const distributable = totalAmount - reserve
  const distributableBreakdown = holders.map((h) => ({
    ...h,
    share: totalHolder > 0 ? (h.percent / totalHolder) * distributable : 0,
  }))

  const willRecalcYield = asset.oracle_method === 'lease_income' && eventType === 'LEASE'

  // Contract-expected amount for this payment period
  const contractExpected = (() => {
    if (!contract?.annual_amount) return null
    const freq = contract.payment_frequency
    if (freq === 'monthly') return contract.annual_amount / 12
    if (freq === 'quarterly') return contract.annual_amount / 4
    if (freq === 'semi_annual') return contract.annual_amount / 2
    return contract.annual_amount // annual
  })()

  // Warn if entered amount differs from contract by more than 10%
  const contractMismatch = contractExpected && totalAmount > 0
    ? Math.abs(totalAmount - contractExpected) / contractExpected > 0.1
    : false

  async function recalcLeaseYield(supabase: ReturnType<typeof createClient>) {
    const since = new Date()
    since.setFullYear(since.getFullYear() - 1)

    const { data } = await supabase
      .from('distributions')
      .select('distributable_amount')
      .eq('asset_id', asset.id)
      .eq('event_type', 'LEASE')
      .eq('status', 'completed')
      .gte('created_at', since.toISOString())

    const trailing12m = (data ?? []).reduce((sum, d) => sum + Number(d.distributable_amount), 0)
    const newYield = asset.current_valuation > 0
      ? parseFloat(((trailing12m / asset.current_valuation) * 100).toFixed(4))
      : 0

    await supabase.from('assets').update({ annual_yield: newYield }).eq('id', asset.id)
    return newYield
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const valid = files.filter((f) => {
      if (!ACCEPTED_TYPES.includes(f.type)) return false
      if (f.size > MAX_FILE_SIZE) return false
      return true
    })
    setPendingFiles((prev) => [...prev, ...valid])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function uploadDocuments(supabase: ReturnType<typeof createClient>, distId: string, userId: string) {
    if (pendingFiles.length === 0) return []
    const results: UploadedDoc[] = []

    for (const file of pendingFiles) {
      const ext = file.name.split('.').pop()
      const path = `distributions/${distId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('distribution-docs')
        .upload(path, file, { contentType: file.type })

      if (uploadErr) throw new Error(`Upload failed for ${file.name}: ${uploadErr.message}`)

      await supabase.from('distribution_documents').insert({
        distribution_id: distId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: userId,
      })

      results.push({ name: file.name, path, size: file.size })
    }

    return results
  }

  async function handleRecord() {
    if (!totalAmount || holders.length === 0) return
    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: dist, error: distErr } = await supabase
        .from('distributions')
        .insert({
          asset_id: asset.id,
          event_type: eventType,
          total_amount: totalAmount,
          currency,
          reserve_amount: reserve,
          distributable_amount: distributable,
          status: 'completed',
          notes: notes || null,
          triggered_by: user.id,
          completed_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (distErr) throw distErr

      const payments = distributableBreakdown
        .filter((h) => h.share > 0)
        .map((h) => ({
          distribution_id: dist.id,
          wallet_address: h.address,
          amount: parseFloat(h.share.toFixed(6)),
          currency,
          ownership_percent: h.percent,
          status: 'completed' as const,
          completed_at: new Date().toISOString(),
        }))

      const { error: paymentsErr } = await supabase.from('distribution_payments').insert(payments)
      if (paymentsErr) throw paymentsErr

      if (willRecalcYield) {
        const newYield = await recalcLeaseYield(supabase)
        setSavedYield(newYield)
        onYieldUpdated?.(newYield)
      }

      // Upload any attached documents
      if (pendingFiles.length > 0) {
        setUploading(true)
        try {
          const docs = await uploadDocuments(supabase, dist.id, user.id)
          setUploadedDocs(docs)
          setPendingFiles([])
        } catch (upErr) {
          setUploadError(upErr instanceof Error ? upErr.message : 'Document upload failed')
        } finally {
          setUploading(false)
        }
      }

      setSavedDistId(dist.id)
      setAmount('')
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record distribution')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setSavedDistId(null)
    setSavedYield(null)
    setUploadedDocs([])
    setUploadError(null)
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors text-left"
      >
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm flex-1">Distribution Calculator</h2>
        <span className="text-xs text-muted-foreground mr-2">
          {ORACLE_LABELS[asset.oracle_method] ?? 'Manual'}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">

          {/* ── Saved confirmation ── */}
          {savedDistId ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-md bg-success/5 border border-success/20 px-4 py-3">
                <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <div className="text-sm text-success space-y-0.5">
                  <p className="font-medium">Distribution recorded</p>
                  {savedYield !== null && (
                    <p className="text-xs">
                      Yield auto-updated to <strong>{savedYield.toFixed(2)}%</strong> from trailing 12-month lease income
                    </p>
                  )}
                </div>
              </div>

              {/* Document upload step */}
              <div className="rounded-md border border-border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Attach Supporting Documents</p>
                  <span className="text-xs text-muted-foreground ml-auto">Level 1 Oracle Proof</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload bank statements, wire confirmations, or signed receipts. Investors or their
                  attorneys may request these documents to verify this distribution.
                </p>

                {/* Uploaded docs */}
                {uploadedDocs.length > 0 && (
                  <div className="space-y-1.5">
                    {uploadedDocs.map((doc) => (
                      <div key={doc.path} className="flex items-center gap-2 text-xs text-success">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1 truncate">{doc.name}</span>
                        <span className="text-muted-foreground">{formatBytes(doc.size)}</span>
                        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending files */}
                {pendingFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {pendingFiles.map((file, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{file.name}</span>
                        <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                        <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {uploadError && (
                  <div className="flex items-center gap-2 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {uploadError}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5 text-xs"
                    disabled={uploading}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Choose Files
                  </Button>
                  {pendingFiles.length > 0 && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        setUploading(true)
                        setUploadError(null)
                        const supabase = createClient()
                        const { data: { user } } = await supabase.auth.getUser()
                        if (!user) return
                        try {
                          const docs = await uploadDocuments(supabase, savedDistId, user.id)
                          setUploadedDocs((prev) => [...prev, ...docs])
                          setPendingFiles([])
                        } catch (e) {
                          setUploadError(e instanceof Error ? e.message : 'Upload failed')
                        } finally {
                          setUploading(false)
                        }
                      }}
                      disabled={uploading}
                      className="gap-1.5 text-xs"
                    >
                      {uploading ? 'Uploading...' : `Upload ${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''}`}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-xs text-muted-foreground ml-auto"
                  >
                    Record another
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG — max 10MB per file</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Contract hint ── */}
              {contract && contractExpected && (
                <div className="flex items-center justify-between rounded-md bg-muted/40 border border-border px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Contract:</span>{' '}
                    {contract.tenant_name && <span>{contract.tenant_name} · </span>}
                    Expected {contract.payment_frequency ?? 'periodic'} payment:{' '}
                    <span className="font-medium text-foreground">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(contractExpected)}
                    </span>
                  </div>
                  <button
                    className="text-xs text-primary hover:underline ml-3 shrink-0"
                    onClick={() => setAmount(contractExpected.toFixed(2))}
                  >
                    Use this
                  </button>
                </div>
              )}

              {/* ── Oracle banner ── */}
              {asset.oracle_method === 'lease_income' && (
                <div className="flex items-start gap-2 rounded-md bg-status-info border border-primary/20 px-3 py-2.5 text-xs text-info">
                  <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>Lease Income Oracle active.</strong> Recording a LEASE distribution will
                    automatically recalculate annual yield from trailing 12-month income ÷ current valuation.
                  </span>
                </div>
              )}

              {/* ── Inputs ── */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Total Distribution Amount</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="input flex-1 text-sm font-mono"
                      min="0"
                      step="0.01"
                    />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="input w-28 text-sm"
                    >
                      <option value="RLUSD">RLUSD</option>
                      <option value="XRP">XRP</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Event Type</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as typeof eventType)}
                    className="input w-full text-sm"
                  >
                    <option value="LEASE">Lease Income</option>
                    <option value="REFINANCE">Refinance</option>
                    <option value="VALUATION">Valuation Event</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Q1 lease income..."
                    className="input w-full text-sm"
                  />
                </div>
              </div>

              {/* ── Document pre-attach ── */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  <label className="text-xs font-medium text-muted-foreground">
                    Supporting Documents
                    <span className="ml-1 font-normal">(recommended — bank statement, receipt)</span>
                  </label>
                </div>

                {pendingFiles.length > 0 && (
                  <div className="space-y-1">
                    {pendingFiles.map((file, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{file.name}</span>
                        <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                        <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5 text-xs h-8"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Attach Files
                </Button>
              </div>

              {/* ── Contract mismatch warning ── */}
              {contractMismatch && contractExpected && (
                <div className="flex items-start gap-2 rounded-md bg-status-warning border border-warning/20 px-3 py-2 text-xs text-warning">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Amount differs from contract by more than 10%. Contract expects{' '}
                    <strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(contractExpected)}</strong>.
                    Confirm this is intentional before recording.
                  </span>
                </div>
              )}

              {/* ── Yield recalc hint ── */}
              {willRecalcYield && totalAmount > 0 && (
                <div className="flex items-center gap-2 text-xs text-info bg-status-info rounded-md px-3 py-2">
                  <Zap className="h-3 w-3 shrink-0" />
                  Will update annual yield from trailing 12-month LEASE income ÷ ${asset.current_valuation.toLocaleString()} valuation
                </div>
              )}

              {/* ── Summary ── */}
              {totalAmount > 0 && (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Gross Amount</p>
                    <p className="font-bold mt-0.5">{totalAmount.toLocaleString()} {currency}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Reserve (10%)</p>
                    <p className="font-bold mt-0.5 text-warning">{reserve.toLocaleString()} {currency}</p>
                  </div>
                  <div className="rounded-md bg-primary/10 p-3">
                    <p className="text-xs text-muted-foreground">Distributable</p>
                    <p className="font-bold mt-0.5 text-primary">{distributable.toLocaleString()} {currency}</p>
                  </div>
                </div>
              )}

              {/* ── Per-holder breakdown ── */}
              {totalAmount > 0 && holders.length > 0 && (
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Holder</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Ownership</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Amount ({currency})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {distributableBreakdown.map((h) => (
                        <tr key={h.address} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono">{truncAddr(h.address)}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{h.percent.toFixed(3)}%</td>
                          <td className="px-3 py-2 text-right font-medium">{h.share.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {holders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No holders found — sync from XRPL first
                </p>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  Records to Supabase · visible to all {holders.length} holders
                </p>
                <Button
                  size="sm"
                  onClick={handleRecord}
                  disabled={!totalAmount || holders.length === 0 || saving}
                  className="gap-2"
                >
                  <Send className="h-3.5 w-3.5" />
                  {saving ? 'Recording...' : 'Record Distribution'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
