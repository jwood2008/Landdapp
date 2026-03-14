'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText, Plus, Send, Loader2, AlertCircle,
  Calendar, CheckCircle, Eye, EyeOff,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Asset {
  id: string
  asset_name: string
  token_symbol: string
}

interface Update {
  id: string
  asset_id: string
  title: string
  content: string
  quarter: string
  ai_analysis: string | null
  ai_rating: number | null
  ai_sentiment: string | null
  published: boolean
  created_at: string
}

interface Props {
  assets: Asset[]
  updates: Update[]
  issuerId: string
}

function getQuarterOptions(): string[] {
  const now = new Date()
  const year = now.getFullYear()
  const quarters: string[] = []
  for (let y = year; y >= year - 1; y--) {
    for (let q = 4; q >= 1; q--) {
      quarters.push(`Q${q} ${y}`)
    }
  }
  return quarters
}

export function IssuerUpdatesManager({ assets, updates, issuerId }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [quarter, setQuarter] = useState(getQuarterOptions()[0] ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedAssetId || !title || !content || !quarter) return
    setSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: insertErr } = await supabase
        .from('issuer_updates')
        .insert({
          asset_id: selectedAssetId,
          issuer_id: issuerId,
          title,
          content,
          quarter,
          published: false,
        })

      if (insertErr) throw insertErr

      setShowForm(false)
      setTitle('')
      setContent('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create update')
    } finally {
      setSubmitting(false)
    }
  }

  async function togglePublish(updateId: string, currentlyPublished: boolean) {
    const supabase = createClient()
    await supabase
      .from('issuer_updates')
      .update({ published: !currentlyPublished, updated_at: new Date().toISOString() })
      .eq('id', updateId)
    router.refresh()
  }

  const assetMap = new Map(assets.map((a) => [a.id, a]))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quarterly Updates</h1>
          <p className="text-muted-foreground">Keep your investors informed about your land assets</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Update
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Post Quarterly Update</CardTitle>
            <CardDescription>Share progress, financials, and developments with your token holders</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Asset</label>
                  <select
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                    className="input w-full text-sm"
                  >
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>{a.asset_name} ({a.token_symbol})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Quarter</label>
                  <select
                    value={quarter}
                    onChange={(e) => setQuarter(e.target.value)}
                    className="input w-full text-sm"
                  >
                    {getQuarterOptions().map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q1 2026 Land Performance Report"
                  required
                  className="input w-full text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Update Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Share updates about the land, lease income, improvements, market conditions, plans..."
                  required
                  rows={8}
                  className="input w-full text-sm resize-none"
                />
                <p className="text-[11px] text-muted-foreground">
                  AI will analyze this update and provide a rating once published.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting} className="gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? 'Saving...' : 'Save as Draft'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Updates list */}
      {updates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No quarterly updates yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Quarterly updates are required — they help investors track how their land is performing.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {updates.map((update) => {
            const asset = assetMap.get(update.asset_id)
            return (
              <Card key={update.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">{asset?.token_symbol ?? '?'}</Badge>
                        <Badge className={`text-[10px] ${update.published ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>
                          {update.published ? 'Published' : 'Draft'}
                        </Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {update.quarter}
                        </span>
                      </div>
                      <CardTitle className="text-base">{update.title}</CardTitle>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => togglePublish(update.id, update.published)}
                      >
                        {update.published ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {update.published ? 'Unpublish' : 'Publish'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                    {update.content}
                  </p>

                  {/* AI analysis section */}
                  {update.ai_analysis && (
                    <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium">AI Analysis</span>
                        {update.ai_rating && (
                          <Badge className={`text-[10px] ${
                            update.ai_rating >= 7 ? 'bg-green-500/10 text-green-500' :
                            update.ai_rating >= 4 ? 'bg-amber-500/10 text-amber-500' :
                            'bg-red-500/10 text-red-500'
                          }`}>
                            Rating: {update.ai_rating}/10
                          </Badge>
                        )}
                        {update.ai_sentiment && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {update.ai_sentiment}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{update.ai_analysis}</p>
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground mt-3">
                    Posted {new Date(update.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
