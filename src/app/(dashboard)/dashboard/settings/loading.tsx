import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="max-w-3xl animate-in">
      {/* Page header */}
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Tab bar — 4 tabs matching settings-tabs.tsx */}
      <div className="flex gap-0 border-b border-border pb-0 overflow-x-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 px-5 py-3">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>

      {/* Profile form skeleton — first tab content */}
      <div className="space-y-6 pt-8">
        <div className="space-y-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Name field */}
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>

            {/* Email field */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-3 w-56" />
            </div>

            {/* Role badge */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>

            {/* Save button */}
            <div className="flex justify-end pt-2">
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
