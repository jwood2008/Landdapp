'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, User, ChevronDown, ChevronUp, Minus } from 'lucide-react'
import { useChatStore } from '@/store/chat'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi, I'm Jarvis. I can help you navigate the platform, understand your holdings, or answer questions about tokenized real estate investing. What can I help with?",
}

export function ChatWidget() {
  const { view, collapse, expand, close } = useChatStore()
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(0)
  const [hasSidebar, setHasSidebar] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track sidebar width (only present for admin/issuer)
  useEffect(() => {
    const aside = document.querySelector('aside')
    if (!aside) {
      setHasSidebar(false)
      setSidebarWidth(0)
      // No sidebar = no collapsed state; force close if stuck on collapsed
      if (view === 'collapsed') close()
      return
    }
    setHasSidebar(true)
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setSidebarWidth(entry.contentRect.width)
    })
    observer.observe(aside)
    setSidebarWidth(aside.offsetWidth)
    return () => observer.disconnect()
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (view === 'open') inputRef.current?.focus()
  }, [view])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = [...messages.filter((m) => m.id !== 'welcome'), userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')

      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: 'assistant', content: data.message },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I ran into an issue. ${err instanceof Error ? err.message : 'Please try again.'}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  // In bottom-nav mode (no sidebar), only show when fully open
  const isVisible = hasSidebar ? view !== 'closed' : view === 'open'
  const isExpanded = view === 'open'

  // Don't render anything in bottom-nav mode unless fully open
  if (!hasSidebar && view !== 'open') return null

  return (
    <div
      style={hasSidebar ? { left: sidebarWidth + 8 } : undefined}
      className={`fixed z-50 w-[360px] transition-all duration-300 ease-out max-sm:left-0 max-sm:right-0 max-sm:w-full ${
        hasSidebar ? 'bottom-0' : 'bottom-[72px] left-4'
      } ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`flex flex-col overflow-hidden border border-border/60 bg-background shadow-xl transition-all duration-300 ease-out ${
          hasSidebar ? 'rounded-t-xl border-b-0' : 'rounded-xl'
        } ${
          isExpanded ? 'h-[50vh] max-h-[520px] min-h-[320px]' : 'h-auto'
        }`}
      >
        {/* Header — always visible when not closed */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 cursor-pointer select-none"
          onClick={() => (isExpanded ? (hasSidebar ? collapse() : close()) : expand())}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
            <p className="text-sm font-medium">Jarvis</p>
          </div>
          <div className="flex items-center gap-1">
            {isExpanded && hasSidebar && (
              <button
                onClick={(e) => { e.stopPropagation(); collapse() }}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Collapse"
                title="Collapse"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            )}
            {!isExpanded && hasSidebar && (
              <button
                onClick={(e) => { e.stopPropagation(); expand() }}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Expand"
                title="Expand"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); close() }}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
              title="Close"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Body — only when expanded */}
        {isExpanded && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md mt-0.5 ${
                      msg.role === 'user'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <User className="h-3 w-3" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                  </div>
                  <div
                    className={`max-w-[78%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/70 text-foreground'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground mt-0.5">
                    <Sparkles className="h-3 w-3" />
                  </div>
                  <div className="rounded-xl bg-muted/70 px-3 py-2">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border/50 px-3 py-2.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSend()
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Jarvis..."
                  disabled={loading}
                  className="flex-1 rounded-lg border-0 bg-muted/50 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:bg-muted disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-30 disabled:hover:bg-primary"
                  aria-label="Send message"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
              <p className="mt-1 text-center text-[10px] text-muted-foreground/50">
                Not financial advice
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
