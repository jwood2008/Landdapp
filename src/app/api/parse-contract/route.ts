import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const USE_MOCK = !process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === '' || process.env.USE_MOCK_AI === 'true'

const anthropic = USE_MOCK ? null : new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MOCK_EXTRACTION = {
  tenant_name: "Greenfield Agriculture LLC",
  annual_amount: 48000,
  payment_frequency: "monthly" as const,
  payment_due_day: 1,
  lease_start_date: "2025-01-01",
  lease_end_date: "2035-12-31",
  escalation_rate: 3.0,
  escalation_type: "annual_percent" as const,
  currency: "USD",
  summary: "10-year agricultural lease for 160 acres at $4,000/month ($48,000/year) with 3% annual escalation. Tenant is Greenfield Agriculture LLC, payments due on the 1st of each month."
}

const EXTRACTION_PROMPT = `You are a legal document parser specializing in lease agreements and real estate contracts.

Extract the following payment terms from this lease contract and return them as a JSON object.
If a field cannot be found or determined, use null.

Return ONLY valid JSON with this exact structure:
{
  "tenant_name": "string — full legal name of tenant/lessee",
  "annual_amount": number — total annual payment in USD (e.g. 50000),
  "payment_frequency": "monthly" | "quarterly" | "semi_annual" | "annual",
  "payment_due_day": number — day of month/period payment is due (e.g. 1 for 1st of month),
  "lease_start_date": "YYYY-MM-DD",
  "lease_end_date": "YYYY-MM-DD",
  "escalation_rate": number — annual increase percentage (e.g. 3.0 for 3%),
  "escalation_type": "annual_percent" | "fixed" | "cpi" | null,
  "currency": "USD" | "CAD" | "EUR" | string,
  "summary": "2-3 sentence plain English summary of the key payment terms"
}

Be precise with dollar amounts. If the contract states monthly rent, multiply by 12 for annual_amount.
Do not include any text outside the JSON object.`

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { assetId, filePath, fileName } = await req.json()
    if (!assetId || !filePath) {
      return NextResponse.json({ error: 'assetId and filePath required' }, { status: 400 })
    }

    // Download the PDF from Supabase Storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('asset-contracts')
      .download(filePath)

    if (downloadErr || !fileData) {
      return NextResponse.json({ error: 'Failed to download contract file' }, { status: 500 })
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    let extracted: Record<string, unknown>

    if (USE_MOCK) {
      // Dev mode: return mock extraction without calling Anthropic API
      console.log('[parse-contract] Using mock AI extraction (no API credits)')
      extracted = { ...MOCK_EXTRACTION }
    } else {
      // Production: send to Claude for extraction
      const userMessage: MessageParam = {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          } as Anthropic.DocumentBlockParam,
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
        ],
      }

      const message = await anthropic!.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [userMessage],
      })

      // Parse Claude's response
      const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

      try {
        // Strip any markdown code fences if present
        const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        extracted = JSON.parse(cleaned)
      } catch {
        return NextResponse.json(
          { error: 'AI could not parse contract — ensure it is a readable PDF lease agreement', raw: rawText },
          { status: 422 }
        )
      }
    }

    // If assetId is 'pending', just return extracted terms without saving
    // The create-asset form will save the contract record after asset creation
    if (assetId === 'pending') {
      return NextResponse.json({ contract: null, extracted })
    }

    // Deactivate any existing contract for this asset
    await supabase
      .from('asset_contracts')
      .update({ is_active: false })
      .eq('asset_id', assetId)
      .eq('is_active', true)

    // Save extracted contract to DB
    const { data: contract, error: insertErr } = await supabase
      .from('asset_contracts')
      .insert({
        asset_id: assetId,
        file_name: fileName,
        file_path: filePath,
        tenant_name: extracted.tenant_name ?? null,
        annual_amount: extracted.annual_amount ?? null,
        payment_frequency: extracted.payment_frequency ?? null,
        payment_due_day: extracted.payment_due_day ?? null,
        lease_start_date: extracted.lease_start_date ?? null,
        lease_end_date: extracted.lease_end_date ?? null,
        escalation_rate: extracted.escalation_rate ?? null,
        escalation_type: extracted.escalation_type ?? null,
        currency: extracted.currency ?? 'USD',
        summary: extracted.summary ?? null,
        raw_extraction: extracted,
        is_active: true,
        parsed_at: new Date().toISOString(),
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (insertErr) throw insertErr

    return NextResponse.json({ contract, extracted })
  } catch (err) {
    console.error('[parse-contract]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
