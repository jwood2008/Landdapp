import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Agency Roster — RWA Platform',
  description: 'The full team roster powering real-world asset tokenization.',
}

export default async function AgencyPage() {
  const supabase = await createClient()

  const { data: divisions } = await supabase
    .from('agency_divisions')
    .select('id, title, tagline, emoji, sort_order')
    .order('sort_order', { ascending: true })

  const { data: agents } = await supabase
    .from('agency_agents')
    .select('id, division_id, name, specialty, when_to_use, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const agentsByDivision = (agents ?? []).reduce<Record<string, typeof agents>>((acc, agent) => {
    if (!acc[agent!.division_id]) acc[agent!.division_id] = []
    acc[agent!.division_id]!.push(agent)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1 font-medium">RWA Platform</p>
              <h1 className="text-3xl font-bold tracking-tight">🏛️ The Agency Roster</h1>
              <p className="text-muted-foreground mt-1">
                The full team powering real-world asset tokenization on XRPL.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Roster */}
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">
        {(divisions ?? []).map((division) => {
          const divAgents = agentsByDivision[division.id] ?? []
          return (
            <section key={division.id}>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-lg">{division.emoji}</span>
                  <h2 className="text-lg font-bold tracking-tight">{division.title}</h2>
                </div>
                <p className="text-sm text-muted-foreground italic ml-7">{division.tagline}</p>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-48">Agent</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-72">Specialty</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">When to Use</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {divAgents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground text-xs">
                          No agents in this division
                        </td>
                      </tr>
                    ) : (
                      divAgents.map((agent, i) => (
                        <tr key={agent!.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                          <td className="px-4 py-3 font-medium text-primary align-top">{agent!.name}</td>
                          <td className="px-4 py-3 text-muted-foreground align-top leading-relaxed">{agent!.specialty}</td>
                          <td className="px-4 py-3 text-foreground/80 align-top leading-relaxed">{agent!.when_to_use}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}

        <div className="border-t border-border pt-8 pb-4 text-center">
          <p className="text-xs text-muted-foreground">
            RWA Platform &middot; Wood Land Holdings LLC &middot; Powered by XRPL &middot; WOD Token
          </p>
        </div>
      </div>
    </div>
  )
}
