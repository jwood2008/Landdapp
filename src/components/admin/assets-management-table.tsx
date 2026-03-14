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
import { buttonVariants } from '@/lib/button-variants'
import { cn } from '@/lib/utils'
import { Plus, Settings } from 'lucide-react'
import type { AssetRow } from '@/types/database'

interface AssetsManagementTableProps {
  assets: AssetRow[]
}

function formatUSD(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function AssetsManagementTable({ assets }: AssetsManagementTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Assets</CardTitle>
          <CardDescription>Manage tokenized assets and oracle data</CardDescription>
        </div>
        <Link href="/admin/assets/new" className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}>
          <Plus className="h-4 w-4" />
          New Asset
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Token</TableHead>
              <TableHead className="text-right">Valuation</TableHead>
              <TableHead className="text-right">NAV / Token</TableHead>
              <TableHead className="text-right">Yield</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset) => (
              <TableRow key={asset.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{asset.asset_name}</p>
                    <p className="text-xs text-muted-foreground">{asset.llc_name}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">{asset.token_symbol}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatUSD(asset.current_valuation)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${asset.nav_per_token.toFixed(4)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {asset.annual_yield != null ? `${asset.annual_yield.toFixed(1)}%` : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={asset.is_active ? 'default' : 'secondary'}>
                    {asset.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/assets/${asset.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    <Settings className="h-4 w-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
