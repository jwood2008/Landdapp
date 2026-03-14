import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const USE_MOCK = !process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === '' || process.env.USE_MOCK_AI === 'true'

const MOCK_VALIDATION = {
  document_type: "appraisal" as const,
  extracted_value: 1250000,
  appraiser_name: "James R. Mitchell, MAI",
  appraisal_date: "2025-11-15",
  property_address: "4520 County Road 12, Marion County, FL 34431",
  methodology: "Sales Comparison Approach with Income Capitalization",
  summary: "Full USPAP-compliant appraisal of 160-acre agricultural parcel. Value determined at $1,250,000 based on comparable sales and income approach with a 6.2% cap rate.",
  signature_detected: true,
  signature_signer_name: "James R. Mitchell, MAI — FL License #RZ3421",
  integrity_flags: [
    { type: "info", severity: "info" as const, message: "Document appears to be a complete appraisal report" }
  ],
  integrity_score: 95,
  formatting_analysis: {
    consistent_fonts: true,
    consistent_formatting: true,
    professional_layout: true,
    contains_letterhead: true,
    contains_license_number: true,
    page_count_reasonable: true,
  }
}

const VALIDATION_PROMPT = `You are an expert real estate appraisal document analyst and fraud detection system.

Analyze this document thoroughly and return a JSON object with the following structure:

{
  "document_type": "appraisal" | "bpo" | "tax_assessment" | "cma" | "unknown",
  "extracted_value": <number or null — the appraised/assessed value in USD>,
  "appraiser_name": <string or null>,
  "appraisal_date": <"YYYY-MM-DD" or null>,
  "property_address": <string or null>,
  "methodology": <string describing methodology used, e.g. "Sales Comparison Approach" or null>,
  "summary": <2-3 sentence summary of the document's key findings>,

  "signature_detected": <boolean — is there a signature or digital certification present?>,
  "signature_signer_name": <string or null — name associated with the signature>,

  "integrity_flags": [
    {
      "type": "<flag_type>",
      "severity": "info" | "warning" | "critical",
      "message": "<human-readable explanation>"
    }
  ],

  "integrity_score": <0-100 score where 100 = fully trustworthy, 0 = clearly fraudulent>,

  "formatting_analysis": {
    "consistent_fonts": <boolean>,
    "consistent_formatting": <boolean>,
    "professional_layout": <boolean>,
    "contains_letterhead": <boolean>,
    "contains_license_number": <boolean>,
    "page_count_reasonable": <boolean — appraisals are typically 10-50 pages>
  }
}

INTEGRITY FLAGS TO CHECK:
1. "no_signature" — Document lacks any signature or certification (severity: critical)
2. "no_appraiser_license" — No appraiser license number found (severity: warning)
3. "no_letterhead" — No professional letterhead detected (severity: warning)
4. "formatting_inconsistency" — Mixed fonts, formatting suggests editing/tampering (severity: critical)
5. "value_not_found" — Could not extract a clear appraised value (severity: critical)
6. "date_missing" — No appraisal date found (severity: warning)
7. "methodology_unclear" — Valuation methodology not stated (severity: warning)
8. "unusually_short" — Document seems too short for a full appraisal (severity: warning)
9. "generic_template" — Appears to be a generic template without property-specific analysis (severity: critical)
10. "future_date" — Document date is in the future (severity: critical)
11. "stale_appraisal" — Appraisal date is more than 12 months old (severity: warning)

SCORING GUIDELINES:
- Start at 100
- Each "info" flag: -5 points
- Each "warning" flag: -10 points
- Each "critical" flag: -20 points
- Minimum score: 0

Return ONLY the JSON object, no markdown or explanation.`

export async function POST(req: NextRequest) {
  // Auth check — only admins can validate documents
  const { requireAdmin } = await import('@/lib/api-auth')
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error

  const apiKey = process.env.ANTHROPIC_API_KEY

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const { assetId, filePath, fileName, proposedValue } = await req.json()
  if (!assetId || !filePath) {
    return NextResponse.json({ error: 'assetId and filePath required' }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // 1. Download the document from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('valuation-docs')
      .download(filePath)

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
    }

    const buffer = Buffer.from(await fileData.arrayBuffer())
    const base64 = buffer.toString('base64')
    const fileHash = await computeHash(buffer)

    // 2. Check for duplicate documents
    const { data: existingDocs } = await supabase
      .from('valuation_documents')
      .select('id, file_hash, ai_extracted_value, created_at, asset_id')
      .eq('file_hash', fileHash)

    const isDuplicate = existingDocs && existingDocs.length > 0
    const duplicateOf = isDuplicate ? existingDocs[0].id : null

    // 3. Get prior valuation data for cross-validation
    const { data: asset } = await supabase
      .from('assets')
      .select('current_valuation, annual_yield, token_supply, asset_name')
      .eq('id', assetId)
      .single()

    const { data: _priorValuations } = await supabase
      .from('valuations')
      .select('current_value, event_type, created_at')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false })
      .limit(5)

    const { data: recentDistributions } = await supabase
      .from('distributions')
      .select('total_amount, event_type, created_at')
      .eq('asset_id', assetId)
      .eq('event_type', 'LEASE')
      .order('created_at', { ascending: false })
      .limit(12)

    // 4. Send to Claude for analysis (or use mock in dev)
    let analysis: Record<string, unknown>

    if (USE_MOCK) {
      console.log('[validate-document] Using mock AI validation (no API credits)')
      analysis = { ...MOCK_VALIDATION }
    } else {
      const anthropic = new Anthropic({ apiKey })
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [
          {
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
                text: VALIDATION_PROMPT,
              },
            ],
          },
        ],
      })

      const textBlock = message.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
      }

      try {
        const cleaned = textBlock.text.replace(/```json\n?|\n?```/g, '').trim()
        analysis = JSON.parse(cleaned)
      } catch {
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
      }
    }

    // 5. Cross-validation checks
    const crossValidation: Record<string, unknown> = {}
    const additionalFlags: Array<{ type: string; severity: string; message: string }> = []
    const extractedValue = analysis.extracted_value as number | null

    // Check vs prior valuation
    if (extractedValue && asset?.current_valuation) {
      const priorVal = Number(asset.current_valuation)
      const deltaPct = ((extractedValue - priorVal) / priorVal) * 100
      crossValidation.vs_prior = {
        prior_value: priorVal,
        new_value: extractedValue,
        delta_pct: Math.round(deltaPct * 100) / 100,
        flag: Math.abs(deltaPct) > 25,
      }
      if (Math.abs(deltaPct) > 25) {
        additionalFlags.push({
          type: 'value_jump',
          severity: Math.abs(deltaPct) > 50 ? 'critical' : 'warning',
          message: `Value ${deltaPct > 0 ? 'increased' : 'decreased'} ${Math.abs(deltaPct).toFixed(1)}% vs prior valuation ($${priorVal.toLocaleString()} → $${extractedValue.toLocaleString()})`,
        })
      }
    }

    // Check proposed value vs AI-extracted value
    if (extractedValue && proposedValue) {
      const mismatchPct = ((Number(proposedValue) - extractedValue) / extractedValue) * 100
      crossValidation.vs_proposed = {
        proposed: Number(proposedValue),
        extracted: extractedValue,
        delta_pct: Math.round(mismatchPct * 100) / 100,
        flag: Math.abs(mismatchPct) > 5,
      }
      if (Math.abs(mismatchPct) > 5) {
        additionalFlags.push({
          type: 'proposed_mismatch',
          severity: Math.abs(mismatchPct) > 15 ? 'critical' : 'warning',
          message: `Proposed valuation ($${Number(proposedValue).toLocaleString()}) differs from document value ($${extractedValue.toLocaleString()}) by ${Math.abs(mismatchPct).toFixed(1)}%`,
        })
      }
    }

    // Check implied cap rate vs lease income
    if (extractedValue && recentDistributions && recentDistributions.length > 0) {
      const annualLease = (recentDistributions as Array<{ total_amount: number }>)
        .reduce((sum, d) => sum + Number(d.total_amount), 0)
      const monthsCovered = recentDistributions.length
      const annualized = monthsCovered > 0 ? (annualLease / monthsCovered) * 12 : 0
      if (annualized > 0) {
        const impliedCapRate = (annualized / extractedValue) * 100
        crossValidation.vs_lease_income = {
          annual_lease_income: annualized,
          implied_cap_rate: Math.round(impliedCapRate * 100) / 100,
          flag: impliedCapRate < 2 || impliedCapRate > 15,
        }
        if (impliedCapRate < 2 || impliedCapRate > 15) {
          additionalFlags.push({
            type: 'abnormal_cap_rate',
            severity: 'warning',
            message: `Implied cap rate of ${impliedCapRate.toFixed(1)}% is outside normal range (2-15%). This may indicate inflated valuation or underreported income.`,
          })
        }
      }
    }

    // Duplicate flag
    if (isDuplicate) {
      const dupDoc = existingDocs![0]
      additionalFlags.push({
        type: 'duplicate_document',
        severity: dupDoc.asset_id === assetId ? 'critical' : 'warning',
        message: `This exact document was previously uploaded on ${new Date(dupDoc.created_at).toLocaleDateString()}${dupDoc.asset_id !== assetId ? ' for a different asset' : ''}`,
      })
    }

    // Merge flags
    const allFlags = [
      ...((analysis.integrity_flags as Array<{ type: string; severity: string; message: string }>) ?? []),
      ...additionalFlags,
    ]

    // Recalculate score with additional flags
    let score = (analysis.integrity_score as number) ?? 100
    for (const flag of additionalFlags) {
      if (flag.severity === 'info') score -= 5
      else if (flag.severity === 'warning') score -= 10
      else if (flag.severity === 'critical') score -= 20
    }
    score = Math.max(0, score)

    // Determine status
    let status = 'passed'
    if (score < 50) status = 'rejected'
    else if (score < 75) status = 'flagged'

    // 6. Save to database
    const { data: docRecord, error: insertError } = await supabase
      .from('valuation_documents')
      .insert({
        asset_id: assetId,
        file_name: fileName,
        file_path: filePath,
        file_size_bytes: buffer.length,
        file_hash: fileHash,
        ai_extracted_value: extractedValue,
        ai_appraiser_name: analysis.appraiser_name ?? null,
        ai_appraisal_date: analysis.appraisal_date ?? null,
        ai_property_address: analysis.property_address ?? null,
        ai_methodology: analysis.methodology ?? null,
        ai_summary: analysis.summary ?? null,
        integrity_score: score,
        integrity_flags: allFlags,
        cross_validation: crossValidation,
        signature_detected: analysis.signature_detected ?? false,
        signature_signer_name: analysis.signature_signer_name ?? null,
        metadata_analysis: analysis.formatting_analysis ?? {},
        duplicate_of: duplicateOf,
        status,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id ?? '00000000-0000-0000-0000-000000000000',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to save document record:', insertError)
    }

    return NextResponse.json({
      document: docRecord,
      analysis: {
        extracted_value: extractedValue,
        appraiser_name: analysis.appraiser_name,
        appraisal_date: analysis.appraisal_date,
        property_address: analysis.property_address,
        methodology: analysis.methodology,
        summary: analysis.summary,
        signature_detected: analysis.signature_detected,
        signature_signer_name: analysis.signature_signer_name,
        document_type: analysis.document_type,
      },
      integrity: {
        score,
        status,
        flags: allFlags,
        cross_validation: crossValidation,
        is_duplicate: isDuplicate,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function computeHash(buffer: Buffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(buffer))
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
