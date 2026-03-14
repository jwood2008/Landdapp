import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface WalletState {
  address: string | null
  status: WalletStatus
  error: string | null
  connect: (address: string) => void
  disconnect: () => void
  setError: (error: string) => void
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      status: 'disconnected',
      error: null,

      connect: (address: string) =>
        set({ address, status: 'connected', error: null }),

      disconnect: () =>
        set({ address: null, status: 'disconnected', error: null }),

      setError: (error: string) =>
        set({ status: 'error', error }),
    }),
    {
      name: 'rwa-wallet',
      partialize: (state) => ({ address: state.address, status: state.status }),
    }
  )
)
