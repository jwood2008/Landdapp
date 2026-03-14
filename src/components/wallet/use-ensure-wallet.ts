'use client'

import { useEffect, useRef } from 'react'
import { useWalletStore } from '@/store/wallet'

/**
 * Hook that silently ensures the current user has a custodial wallet.
 * Called once on dashboard mount. If a wallet already exists, it's a no-op.
 * Also auto-connects the wallet store so the UI shows the address.
 */
export function useEnsureWallet() {
  const { connect, status } = useWalletStore()
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true

    async function ensure() {
      try {
        const res = await fetch('/api/wallet/ensure-custodial', { method: 'POST' })
        const data = await res.json()
        if (data.address && status !== 'connected') {
          connect(data.address)
        }
      } catch {
        // Silent failure — wallet can be created later
      }
    }

    ensure()
  }, [connect, status])
}
