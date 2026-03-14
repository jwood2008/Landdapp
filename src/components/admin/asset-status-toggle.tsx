'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Power, Loader2 } from 'lucide-react'

interface Props {
  assetId: string
  isActive: boolean
}

export function AssetStatusToggle({ assetId, isActive }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function toggle() {
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('assets')
      .update({ is_active: !isActive })
      .eq('id', assetId)

    if (!error) {
      router.refresh()
    }

    setLoading(false)
    setConfirming(false)
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {isActive ? 'Delist this asset?' : 'Re-list this asset?'}
        </span>
        <Button
          size="sm"
          variant={isActive ? 'destructive' : 'default'}
          className="h-7 text-xs"
          onClick={toggle}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setConfirming(false)}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      variant={isActive ? 'outline' : 'default'}
      className={`h-7 text-xs gap-1.5 ${isActive ? 'text-destructive border-destructive/30 hover:bg-destructive/10' : ''}`}
      onClick={() => setConfirming(true)}
    >
      <Power className="h-3 w-3" />
      {isActive ? 'Delist Asset' : 'Re-list Asset'}
    </Button>
  )
}
