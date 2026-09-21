import { requireAuth } from '@/lib/auth'
import { InvestmentsClient } from './InvestmentsClient'

export default async function InvestmentsPage() {
  const { user, profile } = await requireAuth()
  return <InvestmentsClient user={user} profile={profile!} />
}