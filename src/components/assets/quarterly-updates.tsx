import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { IssuerUpdateRow } from '@/types/database'

interface QuarterlyUpdatesProps {
  updates: IssuerUpdateRow[]
  tokenSymbol: string
}

const SENTIMENT_CONFIG = {
  positive: { label: 'Positive', icon: TrendingUp, className: 'text-green-500 bg-green-500/10' },
  neutral: { label: 'Neutral', icon: Minus, className: 'text-muted-foreground bg-muted/50' },
  negative: { label: 'Negative', icon: TrendingDown, className: 'text-red-500 bg-red-500/10' },
  mixed: { label: 'Mixed', icon: Minus, className: 'text-amber-500 bg-amber-500/10' },
}

export function QuarterlyUpdates({ updates, tokenSymbol }: QuarterlyUpdatesProps) {
  if (updates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quarterly Updates</CardTitle>
          <CardDescription>Issuer updates for {tokenSymbol}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No updates published yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quarterly Updates</CardTitle>
        <CardDescription>{updates.length} update{updates.length !== 1 ? 's' : ''} from the issuer</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {updates.map((update) => {
          const sentiment = update.ai_sentiment ? SENTIMENT_CONFIG[update.ai_sentiment] : null
          const SentimentIcon = sentiment?.icon

          return (
            <div key={update.id} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <h4 className="font-semibold text-sm leading-tight">{update.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    {update.quarter}
                    <span>·</span>
                    {new Date(update.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {update.ai_rating != null && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Star className="h-3 w-3" />
                      {update.ai_rating.toFixed(1)}
                    </Badge>
                  )}
                  {sentiment && SentimentIcon && (
                    <Badge className={`gap-1 text-xs ${sentiment.className}`}>
                      <SentimentIcon className="h-3 w-3" />
                      {sentiment.label}
                    </Badge>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {update.content}
              </p>

              {update.ai_analysis && (
                <div className="rounded-md bg-muted/40 p-3 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">AI Analysis</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{update.ai_analysis}</p>
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
