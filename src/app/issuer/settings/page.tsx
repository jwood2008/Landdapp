import { redirect } from 'next/navigation'

// Issuer settings reuses the same settings page as investors
export default function IssuerSettingsPage() {
  redirect('/dashboard/settings')
}
