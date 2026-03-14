import { createClient } from '@/lib/supabase/server'
import { PlatformSettingsForm } from '@/components/admin/platform-settings-form'

export default async function PlatformSettingsPage() {
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('platform_settings')
    .select('*')
    .limit(1)
    .single()

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
        <p className="text-muted-foreground">
          Configure your permission domain — KYC requirements, marketplace, and authorization rules
        </p>
      </div>

      <PlatformSettingsForm settings={settings} />
    </div>
  )
}
