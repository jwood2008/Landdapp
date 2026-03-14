import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'

interface Holding {
  asset_id: string
  token_balance: number
  ownership_percent: number
  assets: {
    asset_name: string
    asset_type: string
    llc_name: string
    token_symbol: string
    nav_per_token: number
    current_valuation: number
    annual_yield: number | null
  } | null
}

interface HoldingsTableProps {
  holdings: Holding[]
}

function formatUSD(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  land: 'Land',
  real_estate: 'Real Estate',
  aircraft: 'Aircraft',
  vessel: 'Vessel',
  energy: 'Energy',
  private_credit: 'Private Credit',
  infrastructure: 'Infrastructure',
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
          <CardDescription>No holdings detected for your wallet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Once your wallet holds tokens from a registered asset, they will appear here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holdings</CardTitle>
        <CardDescription>Your tokenized asset positions</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">Ownership</TableHead>
              <TableHead className="text-right">NAV Value</TableHead>
              <TableHead className="text-right">Yield</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding) => {
              const asset = holding.assets
              if (!asset) return null
              const navValue = holding.token_balance * asset.nav_per_token

              return (
                <TableRow key={holding.asset_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{asset.asset_name}</p>
                      <p className="text-xs text-muted-foreground">{asset.llc_name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <div>
                      <p>{new Intl.NumberFormat('en-US').format(holding.token_balance)}</p>
                      <p className="text-xs text-muted-foreground">{asset.token_symbol}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {holding.ownership_percent.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatUSD(navValue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {asset.annual_yield != null ? (
                      <span className="text-green-600 dark:text-green-400">
                        {asset.annual_yield.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/assets/${holding.asset_id}`}
                      className="flex items-center justify-end text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
