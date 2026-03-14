'use client'

import { useState, useRef, useEffect } from 'react'
import { Wallet, ShieldPlus, ArrowRight, Check, X, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'

type WalletChoice = 'existing' | 'custodial'

interface Props {
  onChoice: (choice: WalletChoice) => void
}

const TERMS_SECTIONS = [
  {
    title: '1. Custodial Services',
    body: 'The Platform will generate and securely store an XRPL wallet on your behalf. The private keys (seed) for this wallet are encrypted using AES-256-GCM and stored in our secure database. You will not have direct access to your private keys.',
  },
  {
    title: '2. Platform Control',
    body: 'As a custodial wallet, the Platform maintains control over transaction signing. All transactions (purchases, sales, royalty distributions) will be executed by the Platform on your behalf according to your instructions.',
  },
  {
    title: '3. Asset Ownership',
    body: 'Tokens held in your custodial wallet represent your fractional ownership in real-world assets. Your ownership rights are recorded both on the XRP Ledger and in our platform database.',
  },
  {
    title: '4. Migration Option',
    body: 'You may upgrade to a self-custodial wallet (e.g., Xaman) at any time. Upon migration, custodial wallet keys will be permanently deleted from our systems.',
  },
  {
    title: '5. Security',
    body: 'While we employ industry-standard encryption, no system is completely immune to risk. The Platform is not liable for losses resulting from unforeseen security incidents beyond our reasonable control.',
  },
  {
    title: '6. Regulatory Compliance',
    body: 'Your account and wallet are subject to KYC/AML verification. The Platform reserves the right to freeze or restrict wallet activity pending regulatory review.',
  },
  {
    title: '7. No Guarantee of Value',
    body: 'Tokenized assets may fluctuate in value. The Platform makes no guarantees regarding returns, royalties, or asset appreciation.',
  },
]

export function WalletChoiceModal({ onChoice }: Props) {
  const [selected, setSelected] = useState<WalletChoice | null>(null)
  const [showTerms, setShowTerms] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Check if content is short enough that no scrolling is needed
  useEffect(() => {
    if (showTerms && scrollRef.current) {
      const el = scrollRef.current
      if (el.scrollHeight <= el.clientHeight + 20) {
        setScrolledToBottom(true)
      }
    }
  }, [showTerms])

  function handleContinue() {
    if (selected === 'custodial') {
      setShowTerms(true)
    } else if (selected === 'existing') {
      onChoice('existing')
    }
  }

  function handleAcceptTerms() {
    onChoice('custodial')
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 30) {
      setScrolledToBottom(true)
    }
  }

  // Terms of agreement screen
  if (showTerms) {
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border px-6 py-5 bg-muted/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ScrollText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Custodial Wallet Agreement</h2>
              <p className="text-xs text-muted-foreground">Please read and accept before continuing</p>
            </div>
          </div>

          {/* Scrollable terms */}
          <div
            ref={scrollRef}
            className="max-h-[45vh] overflow-y-auto px-6 py-5 space-y-5"
            onScroll={handleScroll}
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              By selecting &ldquo;Create a wallet for me,&rdquo; you acknowledge and agree to the following terms:
            </p>

            {TERMS_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-1.5">
                <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
              </div>
            ))}

            <p className="text-sm font-medium text-foreground pt-2 border-t border-border">
              By proceeding, you confirm that you have read, understood, and agree to these terms.
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-6 py-4 bg-muted/20 space-y-4">
            {!scrolledToBottom && (
              <p className="text-xs text-center text-muted-foreground">
                Scroll to read all terms before accepting
              </p>
            )}

            <label className={`flex items-start gap-3 cursor-pointer select-none rounded-lg border p-3 transition-colors ${
              termsAccepted
                ? 'border-primary/30 bg-primary/5'
                : scrolledToBottom
                  ? 'border-border hover:border-primary/20'
                  : 'border-border opacity-50'
            }`}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                disabled={!scrolledToBottom}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary disabled:opacity-40"
              />
              <span className="text-sm leading-snug">
                I have read and agree to the Custodial Wallet Agreement
              </span>
            </label>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowTerms(false)
                  setTermsAccepted(false)
                  setScrolledToBottom(false)
                }}
              >
                <X className="h-4 w-4 mr-1.5" />
                Back
              </Button>
              <Button
                className="flex-1 gap-1.5"
                disabled={!termsAccepted}
                onClick={handleAcceptTerms}
              >
                <Check className="h-4 w-4" />
                Accept &amp; Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Wallet choice screen
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
        <div className="px-6 pt-6 pb-3 text-center">
          <h2 className="text-xl font-bold tracking-tight">Welcome</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            How would you like to manage your XRPL wallet?
          </p>
        </div>

        <div className="px-6 py-4 space-y-3">
          {/* Existing wallet option */}
          <button
            type="button"
            onClick={() => setSelected('existing')}
            className={`w-full flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all ${
              selected === 'existing'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40'
            }`}
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              selected === 'existing' ? 'bg-primary/10' : 'bg-muted/40'
            }`}>
              <Wallet className={`h-5 w-5 ${selected === 'existing' ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="font-semibold text-sm">I have an existing wallet</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Connect your own XRPL wallet (e.g., Xaman/XUMM) after registration. You keep full control of your keys.
              </p>
            </div>
          </button>

          {/* Custodial wallet option */}
          <button
            type="button"
            onClick={() => setSelected('custodial')}
            className={`w-full flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all ${
              selected === 'custodial'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40'
            }`}
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              selected === 'custodial' ? 'bg-primary/10' : 'bg-muted/40'
            }`}>
              <ShieldPlus className={`h-5 w-5 ${selected === 'custodial' ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="font-semibold text-sm">Create a wallet for me</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                We&apos;ll securely generate and hold an XRPL wallet on your behalf. You can migrate to self-custody anytime.
              </p>
            </div>
          </button>
        </div>

        <div className="px-6 pb-6">
          <Button
            className="w-full gap-1.5"
            disabled={!selected}
            onClick={handleContinue}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
