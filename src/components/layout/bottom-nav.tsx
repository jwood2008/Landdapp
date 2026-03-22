'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Store,
  Wallet,
  ArrowLeftRight,
  Coins,
  Sparkles,
  CreditCard,
} from 'lucide-react'
import { useChatStore } from '@/store/chat'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/dashboard', label: 'Market', icon: Store },
  { href: '/dashboard/portfolio', label: 'Portfolio', icon: Wallet },
  { href: '/dashboard/transactions', label: 'Activity', icon: ArrowLeftRight },
  { href: '/dashboard/royalties', label: 'Royalties', icon: Coins },
]

export function BottomNav({ isTenant }: { isTenant?: boolean }) {
  const pathname = usePathname()
  const chatToggle = useChatStore((s) => s.toggle)
  const chatView = useChatStore((s) => s.view)

  const allTabs = isTenant
    ? [...tabs, { href: '/dashboard/rent', label: 'Rent', icon: CreditCard }]
    : tabs

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40">
      {/* Gradient fade above the bar */}
      <div className="pointer-events-none h-6 bg-gradient-to-t from-background to-transparent" />

      <div className="border-t border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {allTabs.map((tab) => {
            const Icon = tab.icon
            const isActive =
              tab.href === '/dashboard'
                ? pathname === tab.href
                : pathname.startsWith(tab.href)

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'group relative flex flex-col items-center gap-0.5 px-3 py-2.5 transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground/60'
                )}
              >
                <div className="relative">
                  <Icon
                    className={cn(
                      'h-[22px] w-[22px] transition-all duration-200',
                      isActive ? 'scale-105' : 'group-hover:text-muted-foreground'
                    )}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  {/* Active dot */}
                  {isActive && (
                    <span className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium mt-0.5 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground/50 group-hover:text-muted-foreground'
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}

          {/* Jarvis tab */}
          <button
            onClick={chatToggle}
            className={cn(
              'group relative flex flex-col items-center gap-0.5 px-3 py-2.5 transition-colors',
              chatView !== 'closed'
                ? 'text-primary'
                : 'text-muted-foreground/60'
            )}
          >
            <div className="relative">
              <Sparkles
                className={cn(
                  'h-[22px] w-[22px] transition-all duration-200',
                  chatView !== 'closed' ? 'scale-105' : 'group-hover:text-muted-foreground'
                )}
                strokeWidth={chatView !== 'closed' ? 2.2 : 1.8}
              />
              {chatView !== 'closed' && (
                <span className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </div>
            <span
              className={cn(
                'text-[10px] font-medium mt-0.5 transition-colors',
                chatView !== 'closed' ? 'text-primary' : 'text-muted-foreground/50 group-hover:text-muted-foreground'
              )}
            >
              Jarvis
            </span>
          </button>
        </div>
      </div>
    </nav>
  )
}
