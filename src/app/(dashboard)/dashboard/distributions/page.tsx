import { redirect } from 'next/navigation'

// Distributions are now called Royalties
export default function DistributionsRedirect() {
  redirect('/dashboard/royalties')
}
