import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Star } from 'lucide-react'
import type { AssetRow } from '@/types/database'

interface AssetDetailsProps {
  asset: AssetRow
  circulatingSupply?: number
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Semi-Annual',
  annual: 'Annual',
}

function formatUSD(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function AssetDetails({ asset, circulatingSupply = 0 }: AssetDetailsProps) {
  const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n)
  const available = asset.token_supply - circulatingSupply
  return (
    <div className="space-y-4">
      {/* AI Rating card */}
      {asset.ai_rating != null && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">AI Investment Rating</p>
                <p className="text-2xl font-bold">{asset.ai_rating.toFixed(1)}<span className="text-sm text-muted-foreground font-normal">/10</span></p>
              </div>
            </div>
            {asset.ai_rating_updated_at && (
              <p className="text-xs text-muted-foreground mt-2">
                Updated {new Date(asset.ai_rating_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asset Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {asset.description && (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">{asset.description}</p>
              <Separator />
            </>
          )}

          {/* Token info */}
          <div className="space-y-3">
            <Detail label="Legal Entity" value={asset.llc_name} />
            <Detail label="Token Symbol" value={
              <span className="font-mono">{asset.token_symbol}</span>
            } />
            <Detail
              label="Total Supply"
              value={fmt(asset.token_supply)}
            />
            <Detail
              label="Tokens Available"
              value={fmt(available)}
            />
            <Detail
              label="Tokens Sold"
              value={fmt(circulatingSupply)}
            />
            <Detail label="Royalty Frequency" value={
              <Badge variant="outline" className="text-xs">
                {FREQUENCY_LABELS[asset.royalty_frequency] ?? asset.royalty_frequency}
              </Badge>
            } />
            <Detail
              label="Issuer Wallet"
              value={
                <span className="font-mono text-xs break-all">
                  {asset.issuer_wallet}
                </span>
              }
            />
            <Detail label="Network" value="XRPL Mainnet" />
          </div>

          {/* Land info */}
          {(asset.total_acres || asset.location || asset.county || asset.land_type) && (
            <>
              <Separator />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Land Information</p>
              <div className="space-y-3">
                {asset.land_type && (
                  <Detail label="Land Type" value={asset.land_type} />
                )}
                {asset.total_acres && (
                  <Detail
                    label="Total Acres"
                    value={`${new Intl.NumberFormat('en-US').format(asset.total_acres)} acres`}
                  />
                )}
                {asset.location && (
                  <Detail label="Location" value={asset.location} />
                )}
                {(asset.county || asset.state) && (
                  <Detail label="County / State" value={[asset.county, asset.state].filter(Boolean).join(', ')} />
                )}
                {asset.parcel_id && (
                  <Detail label="Parcel ID" value={
                    <span className="font-mono text-xs">{asset.parcel_id}</span>
                  } />
                )}
                {asset.zoning && (
                  <Detail label="Zoning" value={asset.zoning} />
                )}
                {asset.legal_description && (
                  <Detail label="Legal Description" value={
                    <span className="text-xs leading-relaxed">{asset.legal_description}</span>
                  } />
                )}
              </div>
            </>
          )}

          {/* Purchase info */}
          {(asset.purchase_price || asset.purchase_date) && (
            <>
              <Separator />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Purchase Info</p>
              <div className="space-y-3">
                {asset.purchase_price && (
                  <Detail label="Purchase Price" value={formatUSD(asset.purchase_price)} />
                )}
                {asset.purchase_date && (
                  <Detail label="Purchase Date" value={new Date(asset.purchase_date).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                  })} />
                )}
              </div>
            </>
          )}

          <Separator />
          <Detail
            label="Last Updated"
            value={new Date(asset.updated_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          />
        </CardContent>
      </Card>
    </div>
  )
}
