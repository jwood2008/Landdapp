import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, User, Calendar, FileText, AlertTriangle } from 'lucide-react'

interface Props {
  appraiserName: string | null
  appraisalDate: string | null
  currentValuation: number
  totalAcres: number | null
}

export function AppraisalSummary({ appraiserName, appraisalDate, currentValuation, totalAcres }: Props) {
  const valuePerAcre = totalAcres && totalAcres > 0 ? currentValuation / totalAcres : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          Third-Party Verified
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge className="rounded-full text-xs px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1.5">
          <ShieldCheck className="h-3 w-3" />
          Independent Appraisal on File
        </Badge>

        <div className="space-y-2.5">
          {appraiserName && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Appraiser:</span>
              <span className="font-medium">{appraiserName}</span>
            </div>
          )}
          {appraisalDate && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Date:</span>
              <span className="font-medium">
                {new Date(appraisalDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}
          {valuePerAcre && (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Value/Acre:</span>
              <span className="font-medium font-mono tabular-nums">
                ${valuePerAcre.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground pt-1 border-t border-border">
          This asset has been independently appraised by a licensed professional.
        </p>
      </CardContent>
    </Card>
  )
}
