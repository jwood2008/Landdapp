'use client'

import { useState } from 'react'
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  navPerToken: number
  tokenBalance: number
  annualYield: number
  tokenSymbol: string
}

export function YieldCalculator({ navPerToken, tokenBalance, annualYield, tokenSymbol }: Props) {
  const [open, setOpen] = useState(false)
  const [years, setYears] = useState(5)
  const [customYield, setCustomYield] = useState(String(annualYield))
  const [appreciationRate, setAppreciationRate] = useState('3')

  const yieldPct = parseFloat(customYield) || 0
  const appreciationPct = parseFloat(appreciationRate) || 0
  const currentValue = tokenBalance * navPerToken

  // Build year-by-year projection
  const rows = Array.from({ length: years }, (_, i) => {
    const year = i + 1
    const nav = navPerToken * Math.pow(1 + appreciationPct / 100, year)
    const portfolioValue = tokenBalance * nav
    const annualDistribution = portfolioValue * (yieldPct / 100)
    const cumulativeDistributions = Array.from({ length: year }, (_, j) => {
      const y = j + 1
      const n = navPerToken * Math.pow(1 + appreciationPct / 100, y)
      return tokenBalance * n * (yieldPct / 100)
    }).reduce((a, b) => a + b, 0)

    const totalReturn = portfolioValue - currentValue + cumulativeDistributions
    const irr = currentValue > 0 ? (totalReturn / currentValue / year) * 100 : 0

    return { year, nav, portfolioValue, annualDistribution, cumulativeDistributions, totalReturn, irr }
  })

  const fmtUSD = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm flex-1">Yield & Return Projector</h2>
        <span className="text-xs text-muted-foreground mr-2">
          {tokenBalance.toLocaleString()} {tokenSymbol} · {fmtUSD(currentValue)} current value
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border p-6 space-y-5">
          {/* Controls */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Annual Yield (%)</label>
              <input
                type="number"
                value={customYield}
                onChange={(e) => setCustomYield(e.target.value)}
                className="input w-full text-sm font-mono"
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Annual Appreciation (%)</label>
              <input
                type="number"
                value={appreciationRate}
                onChange={(e) => setAppreciationRate(e.target.value)}
                className="input w-full text-sm font-mono"
                min="0"
                max="50"
                step="0.5"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Projection (years)</label>
              <select
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="input w-full text-sm"
              >
                {[1, 2, 3, 5, 7, 10].map((y) => (
                  <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary cards */}
          {rows.length > 0 && (() => {
            const last = rows[rows.length - 1]
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Current Value</p>
                  <p className="font-bold text-sm mt-0.5">{fmtUSD(currentValue)}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Value in {years}yr</p>
                  <p className="font-bold text-sm mt-0.5">{fmtUSD(last.portfolioValue)}</p>
                </div>
                <div className="rounded-md bg-primary/10 p-3">
                  <p className="text-xs text-muted-foreground">Total Distributions</p>
                  <p className="font-bold text-sm mt-0.5 text-primary">{fmtUSD(last.cumulativeDistributions)}</p>
                </div>
                <div className="rounded-md bg-status-success p-3">
                  <p className="text-xs text-muted-foreground">Total Return</p>
                  <p className="font-bold text-sm mt-0.5 text-success">
                    {fmtUSD(last.totalReturn)} ({last.irr.toFixed(1)}%/yr avg)
                  </p>
                </div>
              </div>
            )
          })()}

          {/* Year-by-year table */}
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Year</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">NAV/Token</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Portfolio Value</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Annual Dist.</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Cumulative Dist.</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Total Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, i) => (
                  <tr key={row.year} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-3 py-2 font-medium">Year {row.year}</td>
                    <td className="px-3 py-2 text-right font-mono">${row.nav.toFixed(4)}</td>
                    <td className="px-3 py-2 text-right">{fmtUSD(row.portfolioValue)}</td>
                    <td className="px-3 py-2 text-right text-primary">{fmtUSD(row.annualDistribution)}</td>
                    <td className="px-3 py-2 text-right">{fmtUSD(row.cumulativeDistributions)}</td>
                    <td className="px-3 py-2 text-right font-medium text-success">
                      {fmtUSD(row.totalReturn)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Projections are estimates based on constant yield and appreciation assumptions. Past performance does not guarantee future results.
          </p>
        </div>
      )}
    </div>
  )
}
