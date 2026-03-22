import { create } from 'zustand'

type ChatView = 'closed' | 'collapsed' | 'open'

interface ChatState {
  view: ChatView
  open: boolean // convenience — true when view is 'open'
  toggle: () => void
  close: () => void
  collapse: () => void
  expand: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  view: 'closed',
  open: false,
  toggle: () =>
    set((s) => {
      const next = s.view === 'open' ? 'closed' : 'open'
      return { view: next, open: next === 'open' }
    }),
  close: () => set({ view: 'closed', open: false }),
  collapse: () => set({ view: 'collapsed', open: false }),
  expand: () => set({ view: 'open', open: true }),
}))
