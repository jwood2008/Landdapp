'use client'

import { useState } from 'react'
import { Bell, Pin, ChevronDown, ChevronUp, Plus, X, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface Announcement {
  id: string
  title: string
  body: string
  category: string
  pinned: boolean
  created_at: string
}

interface Props {
  announcements: Announcement[]
  isIssuer?: boolean
  assetId?: string
}

const categoryColors: Record<string, string> = {
  distribution: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  valuation: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  legal: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  general: 'bg-muted text-muted-foreground',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export function AnnouncementsFeed({ announcements: initial, isIssuer, assetId }: Props) {
  const [items, setItems] = useState<Announcement[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('general')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const sorted = [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  async function handlePost() {
    if (!title.trim() || !body.trim()) return
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: insertErr } = await supabase
        .from('announcements')
        .insert({ title, body, category, pinned, asset_id: assetId ?? null })
        .select()
        .single()

      if (insertErr) throw insertErr
      setItems((prev) => [data as Announcement, ...prev])
      setTitle('')
      setBody('')
      setCategory('general')
      setPinned(false)
      setShowForm(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm flex-1">Investor Announcements</h2>
        {isIssuer && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowForm((v) => !v)}
            className="gap-1.5 text-xs"
          >
            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showForm ? 'Cancel' : 'Post'}
          </Button>
        )}
      </div>

      {/* Post form (issuer only) */}
      {isIssuer && showForm && (
        <div className="p-4 border-b border-border space-y-3 bg-muted/20">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Q1 Lease Distribution Completed"
                className="input w-full text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input w-full text-sm"
              >
                <option value="general">General</option>
                <option value="distribution">Distribution</option>
                <option value="valuation">Valuation</option>
                <option value="legal">Legal / Compliance</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="space-y-1 flex flex-col">
              <label className="text-xs font-medium text-muted-foreground">Options</label>
              <label className="flex items-center gap-2 text-sm mt-auto pb-0.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="rounded"
                />
                Pin to top
              </label>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your announcement here..."
              rows={3}
              className="input w-full text-sm resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" onClick={handlePost} disabled={!title.trim() || !body.trim() || saving}>
              {saving ? 'Posting...' : 'Post Announcement'}
            </Button>
          </div>
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/10 border-b border-border">
          <CheckCircle className="h-4 w-4" /> Announcement posted
        </div>
      )}

      {/* Announcements list */}
      {sorted.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No announcements yet
        </div>
      ) : (
        <div className="divide-y divide-border">
          {sorted.map((a) => (
            <div key={a.id} className={`px-4 py-3 ${a.pinned ? 'bg-primary/5' : ''}`}>
              <div className="flex items-start gap-2">
                {a.pinned && <Pin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${categoryColors[a.category] ?? categoryColors.general}`}>
                      {a.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <button
                    className="text-sm font-medium mt-1 text-left hover:text-primary transition-colors w-full flex items-center gap-1"
                    onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                  >
                    {a.title}
                    {expanded === a.id
                      ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0 ml-auto" />
                      : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 ml-auto" />}
                  </button>
                  {expanded === a.id && (
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed whitespace-pre-wrap">
                      {a.body}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
