'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface ProfileFormProps {
  userId: string
  initialName: string
  email: string
}

export function ProfileForm({ userId, initialName, email }: ProfileFormProps) {
  const router = useRouter()
  const [fullName, setFullName] = useState(initialName)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: dbError } = await supabase
      .from('users')
      .update({ full_name: fullName })
      .eq('id', userId)

    if (dbError) {
      setError(dbError.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Full name</label>
        <input
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Your name"
          className="input"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Email</label>
        <input
          value={email}
          disabled
          className="input opacity-60 cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading} size="sm">
        {loading ? 'Saving...' : saved ? 'Saved!' : 'Save changes'}
      </Button>
    </form>
  )
}
