import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a helpful AI assistant for a real-world asset (RWA) investment platform built on the XRP Ledger. Your name is Jarvis.

You help investors with:
- Understanding their portfolio, holdings, and token balances
- Explaining how to buy and sell tokens on the marketplace
- Explaining how the platform works (custodial wallets, Xaman wallets, trust lines)
- Answering questions about real estate tokenization and RWA investing
- Helping with account settings, KYC verification, and wallet setup
- Explaining distributions/dividends and yield calculations
- General platform navigation and support

Key platform concepts:
- Investors can hold tokenized real estate assets on the XRPL
- Each property is represented by a token with a symbol (e.g., "WOD")
- Investors can buy tokens in primary offerings (from the issuer) or on the secondary marketplace
- The secondary marketplace uses the XRPL DEX (decentralized exchange) for peer-to-peer trading
- Wallets can be custodial (platform-managed) or self-custody via Xaman (formerly XUMM)
- Distributions are periodic payments to token holders (like dividends)
- KYC (Know Your Customer) verification is required before investing

Guidelines:
- Be concise and friendly
- If you don't know something specific about the user's account, suggest they check the relevant section of the dashboard
- Never provide financial advice — you can explain how things work but always remind users to do their own research
- Never ask for or handle passwords, private keys, or sensitive credentials
- Keep responses focused and under 200 words unless the user asks for a detailed explanation`

export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error

  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array required' },
        { status: 400 }
      )
    }

    // Limit conversation history to last 20 messages to control costs
    const trimmedMessages = messages.slice(-20)

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: trimmedMessages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    return NextResponse.json({ message: text })
  } catch (err) {
    console.error('[chat] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chat failed' },
      { status: 500 }
    )
  }
}
