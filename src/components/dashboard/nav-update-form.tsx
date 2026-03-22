'use client'

import { useState, useRef } from 'react'
import {
  TrendingUp,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Upload,
  FileText,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { AssetRow } from '@/types/database'

interface IntegrityFlag {
  type: string
  severity: 'info' | 'warning' | 'critical'
  message: string
}

interface ValidationResult {
  analysis: {
    extracted_value: number | null
    appraiser_name: string | null
    appraisal_date: string | null
    property_address: string | null
    methodology: string | null
    summary: string | null
    signature_detected: boolean
    signature_signer_name: string | null
    document_type: string
  }
  integrity: {
    score: number
    status: 'passed' | 'flagged' | 'rejected'
    flags: IntegrityFlag[]
    cross_validation: Record<string, unknown>
    is_duplicate: boolean
  }
  document: { id: string } | null
}

interface Props {
  asset: AssetRow
  onUpdated?: (newValuation: number, newNav: number) => void
}

const SEVERITY_STYLES = {
  info: 'bg-status-info text-info border-primary/20',
  warning: 'bg-status-warning text-warning border-warning/20',
  critical: 'bg-status-danger text-destructive border-destructive/20',
}

const SEVERITY_ICONS = {
  info: AlertCircle,
  warning: AlertTriangle,
  critical: ShieldX,
}

export function NavUpdateForm({ asset, onUpdated }: Props) {
  const [open, setOpen] = useState(false)
  const [newValuation, setNewValuation] = useState(String(asset.current_valuation))
  const [eventType, setEventType] = useState<'VALUATION' | 'LEASE' | 'REFINANCE'>('VALUATION')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Document upload state
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const valNum = parseFloat(newValuation) || 0
  const navPerToken = asset.token_supply > 0 ? valNum / asset.token_supply : 0
  const prevValuation = Number(asset.current_valuation)
  const change = prevValuation > 0 ? ((valNum - prevValuation) / prevValuation) * 100 : 0

  // Validation must pass before allowing update
  const canUpdate =
    valNum > 0 &&
    valNum !== prevValuation &&
    !saving &&
    validation?.integrity.status !== 'rejected' &&
    validation !== null

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.type !== 'application/pdf') {
      setError('Only PDF files are accepted for appraisal documents.')
      return
    }
    if (selected.size > 20 * 1024 * 1024) {
      setError('File must be under 20MB.')
      return
    }
    setFile(selected)
    setValidation(null)
    setError(null)
  }

  async function handleUploadAndValidate() {
    if (!file) return
    setUploading(true)
    setError(null)
    setValidation(null)

    try {
      const supabase = createClient()
      const timestamp = Date.now()
      const filePath = `${asset.id}/${timestamp}-${file.name}`

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from('valuation-docs')
        .upload(filePath, file, { contentType: 'application/pdf' })

      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)

      // Send to AI validation
      const res = await fetch('/api/validate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          filePath,
          fileName: file.name,
          proposedValue: valNum || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Validation failed')

      setValidation(data)

      // Auto-fill extracted value if available and user hasn't entered one
      if (data.analysis.extracted_value && (!valNum || valNum === prevValuation)) {
        setNewValuation(String(data.analysis.extracted_value))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleUpdate() {
    if (!canUpdate) return
    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Record valuation event
      const { data: valRecord, error: valErr } = await supabase
        .from('valuations')
        .insert({
          asset_id: asset.id,
          event_type: eventType,
          previous_value: prevValuation,
          current_value: valNum,
          nav_per_token: navPerToken,
          notes: notes || null,
          recorded_by: user.id,
        })
        .select('id')
        .single()

      if (valErr) throw valErr

      // Link valuation document to this valuation record
      if (validation?.document?.id && valRecord?.id) {
        await supabase
          .from('valuation_documents')
          .update({ valuation_id: valRecord.id })
          .eq('id', validation.document.id)
      }

      // Update asset record
      const { error: assetErr } = await supabase
        .from('assets')
        .update({ current_valuation: valNum, nav_per_token: navPerToken })
        .eq('id', asset.id)

      if (assetErr) throw assetErr

      setSaved(true)
      setNotes('')
      setFile(null)
      setValidation(null)
      onUpdated?.(valNum, navPerToken)
      setTimeout(() => setSaved(false), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update valuation')
    } finally {
      setSaving(false)
    }
  }

  const scoreColor =
    (validation?.integrity.score ?? 0) >= 75
      ? 'text-success'
      : (validation?.integrity.score ?? 0) >= 50
        ? 'text-warning'
        : 'text-destructive'

  const ScoreIcon =
    (validation?.integrity.score ?? 0) >= 75
      ? ShieldCheck
      : (validation?.integrity.score ?? 0) >= 50
        ? ShieldAlert
        : ShieldX

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors text-left"
      >
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm flex-1">Update Asset Valuation</h2>
        <span className="text-xs text-muted-foreground mr-2">
          Current: ${Number(asset.current_valuation).toLocaleString()}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Step 1: Upload Appraisal Document */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Appraisal Document (Required)
            </label>

            {!file ? (
              <div
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Upload appraisal PDF for AI verification
                </p>
                <p className="text-xs text-muted-foreground">
                  Document will be analyzed for authenticity, value extraction, and cross-validation
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                {!uploading && !validation && (
                  <Button
                    size="sm"
                    onClick={handleUploadAndValidate}
                    className="gap-1.5 shrink-0"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verify Document
                  </Button>
                )}
                {uploading && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analyzing…
                  </div>
                )}
                <button
                  onClick={() => {
                    setFile(null)
                    setValidation(null)
                    if (fileRef.current) fileRef.current.value = ''
                  }}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Validation Results */}
          {validation && (
            <div className="space-y-3">
              {/* Score Header */}
              <div
                className={`flex items-center gap-3 rounded-lg border p-4 ${
                  validation.integrity.status === 'passed'
                    ? 'border-success/20 bg-success/5'
                    : validation.integrity.status === 'flagged'
                      ? 'border-warning/20 bg-status-warning'
                      : 'border-destructive/20 bg-destructive/5'
                }`}
              >
                <ScoreIcon className={`h-8 w-8 ${scoreColor}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${scoreColor}`}>
                      {validation.integrity.score}
                    </span>
                    <span className="text-xs text-muted-foreground">/ 100 integrity score</span>
                  </div>
                  <p className="text-sm mt-0.5">
                    {validation.integrity.status === 'passed' && 'Document passed verification — valuation update allowed'}
                    {validation.integrity.status === 'flagged' && 'Document has warnings — review flags before proceeding'}
                    {validation.integrity.status === 'rejected' && 'Document failed verification — valuation update blocked'}
                  </p>
                </div>
              </div>

              {/* AI Summary */}
              {validation.analysis.summary && (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">AI Analysis</p>
                  <p className="text-sm">{validation.analysis.summary}</p>
                </div>
              )}

              {/* Extracted Data Grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {validation.analysis.extracted_value && (
                  <div className="rounded-md border border-border p-2.5">
                    <p className="text-xs text-muted-foreground">Appraised Value</p>
                    <p className="text-sm font-bold mt-0.5">
                      ${validation.analysis.extracted_value.toLocaleString()}
                    </p>
                  </div>
                )}
                {validation.analysis.appraiser_name && (
                  <div className="rounded-md border border-border p-2.5">
                    <p className="text-xs text-muted-foreground">Appraiser</p>
                    <p className="text-sm font-medium mt-0.5">{validation.analysis.appraiser_name}</p>
                  </div>
                )}
                {validation.analysis.appraisal_date && (
                  <div className="rounded-md border border-border p-2.5">
                    <p className="text-xs text-muted-foreground">Appraisal Date</p>
                    <p className="text-sm font-medium mt-0.5">
                      {new Date(validation.analysis.appraisal_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {validation.analysis.methodology && (
                  <div className="rounded-md border border-border p-2.5">
                    <p className="text-xs text-muted-foreground">Methodology</p>
                    <p className="text-sm font-medium mt-0.5">{validation.analysis.methodology}</p>
                  </div>
                )}
                <div className="rounded-md border border-border p-2.5">
                  <p className="text-xs text-muted-foreground">Signature</p>
                  <p className={`text-sm font-medium mt-0.5 ${validation.analysis.signature_detected ? 'text-success' : 'text-destructive'}`}>
                    {validation.analysis.signature_detected
                      ? validation.analysis.signature_signer_name ?? 'Detected'
                      : 'Not found'}
                  </p>
                </div>
                <div className="rounded-md border border-border p-2.5">
                  <p className="text-xs text-muted-foreground">Document Type</p>
                  <p className="text-sm font-medium mt-0.5 capitalize">
                    {validation.analysis.document_type?.replace('_', ' ') ?? 'Unknown'}
                  </p>
                </div>
              </div>

              {/* Integrity Flags */}
              {validation.integrity.flags.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Integrity Flags ({validation.integrity.flags.length})
                  </p>
                  {validation.integrity.flags.map((flag, i) => {
                    const FlagIcon = SEVERITY_ICONS[flag.severity]
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 rounded-md border p-2.5 text-sm ${SEVERITY_STYLES[flag.severity]}`}
                      >
                        <FlagIcon className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{flag.message}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Use extracted value */}
              {validation.analysis.extracted_value &&
                valNum !== validation.analysis.extracted_value && (
                  <button
                    onClick={() => setNewValuation(String(validation.analysis.extracted_value))}
                    className="text-xs text-primary hover:underline"
                  >
                    Use appraised value (${validation.analysis.extracted_value.toLocaleString()})
                  </button>
                )}
            </div>
          )}

          {/* Step 2: Valuation Details (only after document uploaded) */}
          {validation && validation.integrity.status !== 'rejected' && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    New Total Valuation (USD)
                  </label>
                  <input
                    type="number"
                    value={newValuation}
                    onChange={(e) => setNewValuation(e.target.value)}
                    className="input w-full text-sm font-mono"
                    min="0"
                    step="1000"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Event Type</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as typeof eventType)}
                    className="input w-full text-sm"
                  >
                    <option value="VALUATION">Independent Appraisal</option>
                    <option value="LEASE">Lease-Adjusted Value</option>
                    <option value="REFINANCE">Refinance Appraisal</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Notes</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Appraiser, methodology..."
                    className="input w-full text-sm"
                  />
                </div>
              </div>

              {/* Impact summary */}
              {valNum > 0 && valNum !== prevValuation && (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Previous Valuation</p>
                    <p className="font-bold mt-0.5">${prevValuation.toLocaleString()}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">New Valuation</p>
                    <p className="font-bold mt-0.5">${valNum.toLocaleString()}</p>
                  </div>
                  <div
                    className={`rounded-md p-3 ${change >= 0 ? 'bg-status-success' : 'bg-status-danger'}`}
                  >
                    <p className="text-xs text-muted-foreground">Change</p>
                    <p
                      className={`font-bold mt-0.5 ${change >= 0 ? 'text-success' : 'text-destructive'}`}
                    >
                      {change >= 0 ? '+' : ''}
                      {change.toFixed(2)}%
                    </p>
                  </div>
                </div>
              )}

              {valNum > 0 && (
                <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-sm space-y-1">
                  <p className="text-xs font-medium text-primary">Computed NAV per Token</p>
                  <p className="font-mono font-bold text-lg">${navPerToken.toFixed(6)}</p>
                  <p className="text-xs text-muted-foreground">
                    {valNum.toLocaleString()} &divide; {Number(asset.token_supply).toLocaleString()}{' '}
                    {asset.token_symbol} tokens
                  </p>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Valuation updated — NAV per token recalculated and logged with verified appraisal
            </div>
          )}

          {!validation && !file && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Upload an appraisal document to update the valuation. All documents are verified by AI before changes are applied.
            </p>
          )}

          {validation && validation.integrity.status !== 'rejected' && (
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={handleUpdate}
                disabled={!canUpdate}
                className="gap-2"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {saving ? 'Updating...' : 'Record Verified Valuation'}
              </Button>
            </div>
          )}

          {validation?.integrity.status === 'rejected' && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              <ShieldX className="h-4 w-4 shrink-0" />
              Document failed integrity checks. Upload a valid appraisal to proceed.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
