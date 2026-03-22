'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import {
  FileText, Upload, Loader2, CheckCircle, AlertCircle, Trash2, Brain,
} from 'lucide-react'

interface Contract {
  id: string
  file_name: string
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
  is_active: boolean
  parsed_at: string | null
  created_at: string
}

interface Props {
  assetId: string
  assetName: string
  activeContract: Contract | null
}

export function ContractUpload({ assetId, assetName, activeContract }: Props) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedContract, setUploadedContract] = useState<Contract | null>(activeContract)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are accepted')
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('File must be under 20MB')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const supabase = createClient()
      const filePath = `${assetId}/${Date.now()}_${file.name}`

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from('asset-contracts')
        .upload(filePath, file, {
          contentType: 'application/pdf',
          upsert: false,
        })

      if (uploadErr) throw uploadErr

      setUploading(false)
      setParsing(true)

      // Send to AI for parsing
      const res = await fetch('/api/parse-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          filePath,
          fileName: file.name,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to parse contract')

      setUploadedContract(data.contract)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setParsing(false)
    }
  }

  async function removeContract() {
    if (!uploadedContract) return

    const supabase = createClient()
    await supabase
      .from('asset_contracts')
      .update({ is_active: false })
      .eq('id', uploadedContract.id)

    setUploadedContract(null)
    router.refresh()
  }

  function frequencyLabel(freq: string | null) {
    if (freq === 'monthly') return 'Monthly'
    if (freq === 'quarterly') return 'Quarterly'
    if (freq === 'semi_annual') return 'Semi-Annual'
    if (freq === 'annual') return 'Annual'
    return freq ?? '—'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Lease Contract
        </CardTitle>
        <CardDescription>
          Upload the lease agreement for {assetName}. AI will extract payment terms for automatic royalty distribution.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {uploadedContract ? (
          <>
            {/* Active contract display */}
            <div className="rounded-lg border border-success/20 bg-success/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium">{uploadedContract.file_name}</span>
                  {uploadedContract.parsed_at && (
                    <Badge className="text-xs bg-primary/10 text-primary gap-1">
                      <Brain className="h-2.5 w-2.5" />
                      AI Parsed
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={removeContract}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Remove
                </Button>
              </div>

              {/* Extracted terms */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {uploadedContract.tenant_name && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Tenant</p>
                    <p className="text-sm font-medium">{uploadedContract.tenant_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Annual Amount</p>
                  <p className="text-sm font-semibold">
                    {uploadedContract.annual_amount
                      ? `$${Number(uploadedContract.annual_amount).toLocaleString()}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Frequency</p>
                  <p className="text-sm font-medium">{frequencyLabel(uploadedContract.payment_frequency)}</p>
                </div>
                {uploadedContract.escalation_rate && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Escalation</p>
                    <p className="text-sm font-medium">{uploadedContract.escalation_rate}%/yr</p>
                  </div>
                )}
                {uploadedContract.lease_start_date && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Start Date</p>
                    <p className="text-sm font-medium">
                      {new Date(uploadedContract.lease_start_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {uploadedContract.lease_end_date && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">End Date</p>
                    <p className="text-sm font-medium">
                      {new Date(uploadedContract.lease_end_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {uploadedContract.summary && (
                <p className="text-xs text-muted-foreground border-t pt-2">{uploadedContract.summary}</p>
              )}
            </div>

            {/* Replace option */}
            <div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading || parsing}
                />
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Upload className="h-3 w-3" />
                  Upload replacement contract
                </span>
              </label>
            </div>
          </>
        ) : (
          /* Upload area */
          <label className="block cursor-pointer">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading || parsing}
            />
            <div className="rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors p-8 text-center">
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </div>
              ) : parsing ? (
                <div className="flex flex-col items-center gap-2">
                  <Brain className="h-8 w-8 text-primary animate-pulse" />
                  <p className="text-sm text-muted-foreground">AI is extracting payment terms...</p>
                  <p className="text-xs text-muted-foreground">This may take a moment</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium">Upload Lease Agreement (PDF)</p>
                  <p className="text-xs text-muted-foreground">
                    AI will extract tenant name, payment amount, frequency, escalation terms, and lease dates
                  </p>
                </div>
              )}
            </div>
          </label>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
