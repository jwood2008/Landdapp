'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Cloud, Sun, AlertTriangle, CheckCircle2, Loader2, Thermometer, Droplets, Wind } from 'lucide-react'

interface Props {
  assetId: string
}

interface WeatherAlert {
  event: string
  severity: 'minor' | 'moderate' | 'severe' | 'extreme'
  headline: string
  expires: string
}

interface WeatherConditions {
  temperature: number | null
  humidity: number | null
  description: string
  windSpeed: number | null
}

const SEVERITY_STYLES: Record<string, string> = {
  minor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  moderate: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  severe: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  extreme: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

export function WeatherAlertsCard({ assetId }: Props) {
  const [alerts, setAlerts] = useState<WeatherAlert[]>([])
  const [conditions, setConditions] = useState<WeatherConditions | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/oracle/weather?assetId=${assetId}`)
        const json = await res.json()
        if (json.alerts) setAlerts(json.alerts)
        if (json.conditions) setConditions(json.conditions)
      } catch {
        // silently fail — weather is supplementary
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [assetId])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Cloud className="h-4 w-4 text-primary" />
          Weather
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Conditions */}
        {conditions && (
          <div className="flex items-center gap-4">
            {conditions.temperature !== null && (
              <div className="flex items-center gap-1.5">
                <Thermometer className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold tabular-nums">{conditions.temperature}</span>
                <span className="text-sm text-muted-foreground">°F</span>
              </div>
            )}
            <div className="flex-1 space-y-0.5">
              <p className="text-sm font-medium">{conditions.description}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {conditions.humidity !== null && (
                  <span className="flex items-center gap-1">
                    <Droplets className="h-3 w-3" />
                    {conditions.humidity}%
                  </span>
                )}
                {conditions.windSpeed !== null && (
                  <span className="flex items-center gap-1">
                    <Wind className="h-3 w-3" />
                    {conditions.windSpeed} mph
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Alerts</p>
            {alerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border border-border p-3"
              >
                <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                  alert.severity === 'extreme' || alert.severity === 'severe' ? 'text-red-500' :
                  alert.severity === 'moderate' ? 'text-amber-500' : 'text-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">{alert.event}</span>
                    <Badge className={`rounded-full text-[10px] px-2 ${SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.minor}`}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{alert.headline}</p>
                  {alert.expires && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Expires: {new Date(alert.expires).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm text-emerald-700 dark:text-emerald-400">No active weather alerts</span>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/60">
          Source: NOAA National Weather Service
        </p>
      </CardContent>
    </Card>
  )
}
