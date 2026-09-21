import { requireAuth } from '@/lib/auth'
import { AuditLogClient } from './AuditLogClient'

export default async function AuditLogPage() {
  const { user, profile } = await requireAuth()
  return <AuditLogClient user={user} profile={profile!} />
}