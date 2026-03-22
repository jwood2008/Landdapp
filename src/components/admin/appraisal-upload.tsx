'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import {
  ShieldCheck, Upload, Loader2, CheckCircle, AlertCircle, Trash2, Brain, FileText, AlertTriangle,
} from 'lucide-react'

interface Appraisal {
  id: string
  file_name: string
  file_url: string | null
  title: string
  created_at: string
}

interface Props {
  assetId: string
  assetName: string
  currentValuation: number
  existingAppraisal: Appraisal | null
  thirdPartyVerified: boolean
  appraiserName: string | null
  appraisalDate: string | null
}

interface ValidationResult {
  extracted_value: number | null
  appraiser_name: string | null
  appraisal_date: string | null
  methodology: string | null
  summary: string | null
  integrity_score: number
  signature_detected: boolean
  status: string
}

export function AppraisalUpload({ assetId, assetName, currentValuation, existingAppraisal, thirdPartyVerified, appraiserName, appraisalDate }: Props) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ValidationResult | null>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { setError('Only PDF files are accepted'); return }
    if (file.size > 20 * 1024 * 1024) { setError('File must be under 20MB'); return }

    setError(null)
    setUploading(true)

    try {
      const supabase = createClient()
      const filePath = `appraisals/${assetId}/${Date.now()}_${file.name}`
      const { error: uploadErr } = await supabase.storage.from('asset-documents').upload(filePath, file)
      if (uploadErr) throw new Error(uploadErr.message)

      // Get public URL
      const { data: urlData } = supabase.storage.from('asset-documents').getPublicUrl(filePath)

      setUploading(false)
      setParsing(true)

      // Validate with AI
      const res = await fetch('/api/validate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, filePath, fileName: file.name }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to validate appraisal')
        setParsing(false)
        return
      }

      const validation = data.validation as ValidationResult

      // Create asset_documents record
      await supabase.from('asset_documents').insert({
        asset_id: assetId,
        document_type: 'third_party_appraisal',
        title: `Third-Party Appraisal — ${validation.appraiser_name ?? file.name}`,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        notes: validation.summary,
      })

      // If integrity is good, update the asset's verified status
      if (validation.integrity_score >= 70 && validation.status !== 'rejected') {
        await supabase.from('assets').update({
          third_party_verified: true,
          third_party_appraisal_date: validation.appraisal_date,
          third_party_appraiser_name: validation.appraiser_name,
        }).eq('id', assetId)
      }

      setResult(validation)
      setParsing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
      setParsing(false)
    }
  }

  // Compute deviation
  const deviation = result?.extracted_value
    ? Math.abs(currentValuation - result.extracted_value) / currentValuation
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Third-Party Appraisal
        </CardTitle>
        <CardDescription>
          Upload an independent appraisal to verify the asset&apos;s stated valuation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing verified status */}
        {thirdPartyVerified && !result && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Verified</p>
              <p className="text-xs text-muted-foreground">
                {appraiserName && `${appraiserName} · `}
                {appraisalDate && new Date(appraisalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}

        {/* AI validation result */}
        {result && (
          <div className="space-y-3">
            <div className={`rounded-lg border p-4 space-y-3 ${
              result.integrity_score >= 70 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {result.integrity_score >= 70 ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                  <span className="text-sm font-medium">
                    {result.integrity_score >= 70 ? 'Appraisal Verified' : 'Review Needed'}
                  </span>
                  <Badge className="text-xs bg-primary/10 text-primary gap-1">
                    <Brain className="h-2.5 w-2.5" />
                    AI Analyzed
                  </Badge>
                </div>
                <Badge className={`text-xs rounded-full px-3 ${
                  result.integrity_score >= 80 ? 'bg-emerald-500/10 text-emerald-600' :
                  result.integrity_score >= 60 ? 'bg-amber-500/10 text-amber-600' :
                  'bg-red-500/10 text-red-600'
                }`}>
                  Score: {result.integrity_score}/100
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {result.appraiser_name && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Appraiser</p>
                    <p className="text-sm font-medium">{result.appraiser_name}</p>
                  </div>
                )}
                {result.extracted_value && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Appraised Value</p>
                    <p className="text-sm font-semibold">${result.extracted_value.toLocaleString()}</p>
                  </div>
                )}
                {result.appraisal_date && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Date</p>
                    <p className="text-sm font-medium">{new Date(result.appraisal_date).toLocaleDateString()}</p>
                  </div>
                )}
                {result.methodology && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Methodology</p>
                    <p className="text-sm font-medium">{result.methodology}</p>
                  </div>
                )}
              </div>

              {result.summary && (
                <p className="text-xs text-muted-foreground border-t pt-2">{result.summary}</p>
              )}
            </div>

            {/* Deviation warning */}
            {deviation !== null && deviation > 0.15 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Valuation Deviation</p>
                  <p className="text-xs text-muted-foreground">
                    The appraised value (${result.extracted_value?.toLocaleString()}) deviates {(deviation * 100).toFixed(1)}% from the stated valuation (${currentValuation.toLocaleString()}).
                    Consider reviewing and updating the asset valuation.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload area */}
        {!result && (
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
                  <p className="text-sm text-muted-foreground">AI is validating the appraisal...</p>
                  <p className="text-xs text-muted-foreground">Checking integrity, extracting values, verifying signatures</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium">Upload Appraisal (PDF)</p>
                  <p className="text-xs text-muted-foreground">
                    AI verifies: appraiser credentials, methodology, integrity, value extraction
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
