import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function RentLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-5 w-72" />
      </div>

      <div className="grid grid-cols-3 gap-5">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-2 border-border">
        <CardContent className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-5 w-56 mb-1" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-12 w-40 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-14 w-36 rounded-lg" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-5 w-36 mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
