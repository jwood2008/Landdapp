import { redirect } from 'next/navigation'

// Marketplace is now the main dashboard page
export default function MarketplaceRedirect() {
  redirect('/dashboard')
}
