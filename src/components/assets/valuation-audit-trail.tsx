'use client'

import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  FileText,
  ExternalLink,
  Clock,
  TrendingUp,
  TrendingDown,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ValuationRecord {
  id: string
  event_type: string
  previous_value: number
  current_value: number
  nav_per_token: number
  notes: string | null
  created_at: string
}

interface ValuationDoc {
  id: string
  valuation_id: string | null
  file_name: string
  ai_extracted_value: number | null
  ai_appraiser_name: string | null
  ai_appraisal_date: string | null
  ai_methodology: string | null
  ai_summary: string | null
  integrity_score: number | null
  integrity_flags: Array<{ type: string; severity: string; message: string }>
  signature_detected: boolean
  status: string
  created_at: string
}

interface Props {
  valuations: ValuationRecord[]
  documents: ValuationDoc[]
  tokenSymbol: string
}

const STATUS_BADGE = {
  passed: { label: 'Verified', icon: ShieldCheck, className: 'bg-green-500/10 text-green-500 border-green-500/20' },
  flagged: { label: 'Flagged', icon: ShieldAlert, className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  rejected: { label: 'Rejected', icon: ShieldX, className: 'bg-red-500/10 text-red-500 border-red-500/20' },
  pending: { label: 'Pending', icon: Clock, className: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
  processing: { label: 'Processing', icon: Clock, className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
} as const

export function ValuationAuditTrail({ valuations, documents, tokenSymbol }: Props) {
  if (valuations.length === 0) {
    return (
      <div className="rounded-lg border border-border p-6 text-center">
        <Clock className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No valuation history yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Valuation Audit Trail</h3>
        <span className="text-xs text-muted-foreground">({valuations.length} records)</span>
      </div>

      <div className="space-y-2">
        {valuations.map((val) => {
          const doc = documents.find((d) => d.valuation_id === val.id)
          const change = val.previous_value > 0
            ? ((val.current_value - val.previous_value) / val.previous_value) * 100
            : 0
          const isUp = change >= 0

          return (
            <div
              key={val.id}
              className="rounded-lg border border-border p-4 space-y-2.5"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${isUp ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {isUp ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      ${val.current_value.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      from ${val.previous_value.toLocaleString()}
                      <span className={`ml-1 font-medium ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                        ({isUp ? '+' : ''}{change.toFixed(1)}%)
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {doc ? (
                    (() => {
                      const badge = STATUS_BADGE[doc.status as keyof typeof STATUS_BADGE] ?? STATUS_BADGE.pending
                      const BadgeIcon = badge.icon
                      return (
                        <Badge className={`text-xs gap-1 ${badge.className}`}>
                          <BadgeIcon className="h-2.5 w-2.5" />
                          {badge.label}
                          {doc.integrity_score !== null && (
                            <span className="ml-0.5">{doc.integrity_score}/100</span>
                          )}
                        </Badge>
                      )
                    })()
                  ) : (
                    <Badge className="text-xs bg-gray-500/10 text-gray-500 border-gray-500/20">
                      No document
                    </Badge>
                  )}
                  <Badge className="text-xs" variant="outline">
                    {val.event_type}
                  </Badge>
                </div>
              </div>

              {/* NAV per token */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  NAV: <span className="font-mono font-medium text-foreground">${val.nav_per_token.toFixed(4)}</span> / {tokenSymbol}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(val.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>

              {/* Document details (if attached) */}
              {doc && (
                <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">{doc.file_name}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {doc.ai_appraiser_name && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Appraiser:</span>
                        <span>{doc.ai_appraiser_name}</span>
                      </div>
                    )}
                    {doc.ai_methodology && (
                      <div>
                        <span className="text-muted-foreground">Method:</span>{' '}
                        <span>{doc.ai_methodology}</span>
                      </div>
                    )}
                    {doc.ai_appraisal_date && (
                      <div>
                        <span className="text-muted-foreground">Appraisal date:</span>{' '}
                        <span>{new Date(doc.ai_appraisal_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Signature:</span>{' '}
                      <span className={doc.signature_detected ? 'text-green-500' : 'text-red-500'}>
                        {doc.signature_detected ? 'Yes' : 'Not detected'}
                      </span>
                    </div>
                  </div>

                  {doc.ai_summary && (
                    <p className="text-xs text-muted-foreground">{doc.ai_summary}</p>
                  )}

                  {/* Show warnings/critical flags to investors */}
                  {doc.integrity_flags
                    .filter((f) => f.severity !== 'info')
                    .map((flag, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-1.5 text-xs rounded-md px-2 py-1.5 ${
                          flag.severity === 'critical'
                            ? 'bg-red-500/10 text-red-500'
                            : 'bg-amber-500/10 text-amber-500'
                        }`}
                      >
                        <ShieldAlert className="h-3 w-3 shrink-0 mt-0.5" />
                        <span>{flag.message}</span>
                      </div>
                    ))}
                </div>
              )}

              {val.notes && (
                <p className="text-xs text-muted-foreground italic">{val.notes}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
