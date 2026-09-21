import { requireAuth } from '@/lib/auth'
import { InvestorsClient } from './InvestorsClient'

export default async function InvestorsPage() {
  const { user, profile } = await requireAuth()
  return <InvestorsClient user={user} profile={profile!} />
}