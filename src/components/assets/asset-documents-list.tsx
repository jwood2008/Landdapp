import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Scale, FileCheck, Map, TreePine, ShieldCheck } from 'lucide-react'
import type { AssetDocumentRow } from '@/types/database'

interface AssetDocumentsListProps {
  documents: AssetDocumentRow[]
}

const DOC_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  legal_filing: { label: 'Legal Filing', icon: Scale },
  llc_operating_agreement: { label: 'LLC Agreement', icon: FileCheck },
  deed: { label: 'Deed', icon: FileText },
  appraisal: { label: 'Appraisal', icon: FileText },
  survey: { label: 'Survey', icon: Map },
  environmental: { label: 'Environmental', icon: TreePine },
  title_insurance: { label: 'Title Insurance', icon: ShieldCheck },
  other: { label: 'Document', icon: FileText },
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AssetDocumentsList({ documents }: AssetDocumentsListProps) {
  if (documents.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documents</CardTitle>
        <CardDescription>Legal filings and supporting documents</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {documents.map((doc) => {
            const config = DOC_TYPE_CONFIG[doc.document_type] ?? DOC_TYPE_CONFIG.other
            const Icon = config.icon

            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {config.label}
                    </Badge>
                    {doc.file_size && (
                      <span>{formatFileSize(doc.file_size)}</span>
                    )}
                    <span>
                      {new Date(doc.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {doc.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{doc.notes}</p>
                  )}
                </div>
                {doc.file_url && (
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline shrink-0"
                  >
                    View
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
