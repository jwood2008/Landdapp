'use client'

import { useRef, useState } from 'react'
import {
  FileText, Upload, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Sparkles, Loader2, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface ExtractedTerms {
  tenant_name: string | null
  annual_amount: number | null
  payment_frequency: string | null
  payment_due_day: number | null
  lease_start_date: string | null
  lease_end_date: string | null
  escalation_rate: number | null
  escalation_type: string | null
  currency: string | null
  summary: string | null
}

interface Contract extends ExtractedTerms {
  id: string
  file_name: string
  parsed_at: string
}

interface Props {
  assetId: string
  assetName: string
  existingContract?: Contract | null
  onContractParsed?: (contract: Contract) => void
}

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Semi-Annual',
  annual: 'Annual',
}

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export function ContractUpload({ assetId, assetName, existingContract, onContractParsed }: Props) {
  const [open, setOpen] = useState(!!existingContract)
  const [contract, setContract] = useState<Contract | null>(existingContract ?? null)
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File must be under 20MB')
      return
    }

    setError(null)
    setUploading(true)

    try {
      const supabase = createClient()

      // Upload to Supabase Storage
      const ext = file.name.split('.').pop()
      const path = `${assetId}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('asset-contracts')
        .upload(path, file, { contentType: 'application/pdf', upsert: true })

      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)

      setUploading(false)
      setParsing(true)

      // Parse with Claude
      const res = await fetch('/api/parse-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, filePath: path, fileName: file.name }),
      })

      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Parsing failed')

      setContract(data.contract)
      onContractParsed?.(data.contract)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setUploading(false)
      setParsing(false)
    }
  }

  const isLoading = uploading || parsing

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors text-left"
      >
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm flex-1">Lease Contract</h2>
        {contract ? (
          <span className="flex items-center gap-1 text-xs text-success mr-2">
            <CheckCircle className="h-3 w-3" /> Parsed
          </span>
        ) : (
          <span className="text-xs text-muted-foreground mr-2">No contract uploaded</span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">

          {/* Existing contract terms */}
          {contract && (
            <div className="space-y-3">
              {contract.summary && (
                <div className="flex items-start gap-2 rounded-md bg-status-info border border-primary/20 px-3 py-2.5">
                  <Sparkles className="h-3.5 w-3.5 text-info shrink-0 mt-0.5" />
                  <p className="text-xs text-info leading-relaxed">{contract.summary}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {contract.tenant_name && (
                  <Term label="Tenant" value={contract.tenant_name} />
                )}
                {contract.annual_amount != null && (
                  <Term label="Annual Amount" value={formatUSD(contract.annual_amount)} highlight />
                )}
                {contract.payment_frequency && (
                  <Term label="Frequency" value={FREQ_LABELS[contract.payment_frequency] ?? contract.payment_frequency} />
                )}
                {contract.payment_due_day != null && (
                  <Term label="Due Day" value={`${contract.payment_due_day}${ordinal(contract.payment_due_day)} of period`} />
                )}
                {contract.lease_start_date && (
                  <Term label="Start Date" value={new Date(contract.lease_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
                )}
                {contract.lease_end_date && (
                  <Term label="End Date" value={new Date(contract.lease_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
                )}
                {contract.escalation_rate != null && (
                  <Term label="Escalation" value={`${contract.escalation_rate}% ${contract.escalation_type === 'annual_percent' ? 'annually' : contract.escalation_type ?? ''}`} />
                )}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {contract.file_name} · Parsed {new Date(contract.parsed_at).toLocaleDateString()}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="gap-1.5 text-xs text-muted-foreground"
                >
                  <RefreshCw className="h-3 w-3" />
                  Replace
                </Button>
              </div>
            </div>
          )}

          {/* Upload area */}
          {!contract && (
            <div
              className="rounded-lg border-2 border-dashed border-border p-8 text-center cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() => !isLoading && fileInputRef.current?.click()}
            >
              {isLoading ? (
                <div className="space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    {uploading ? 'Uploading contract...' : 'AI reading contract...'}
                  </p>
                  {parsing && (
                    <p className="text-xs text-muted-foreground">
                      Extracting payment terms, dates, and escalation clauses
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <div className="rounded-full bg-muted p-3">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                  <p className="text-sm font-medium">Upload Lease Agreement</p>
                  <p className="text-xs text-muted-foreground">
                    PDF only · max 20MB · AI will extract payment terms automatically
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Loading overlay when replacing */}
          {contract && isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {uploading ? 'Uploading...' : 'AI reading new contract...'}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />

          {!contract && !isLoading && (
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2 w-full"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Upload &amp; Parse with AI
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function Term({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium mt-0.5 ${highlight ? 'text-primary' : ''}`}>{value}</p>
    </div>
  )
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] ?? s[v] ?? s[0]
}
