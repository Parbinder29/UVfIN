import { Eye, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { UserRole } from '@/types'

/** The user's designation (e.g. Owner, Investor), with an icon and tooltip for what they can do. */
export function RoleBadge({ role, designation }: { role: UserRole; designation: string | null }) {
  const canEdit = role === 'finance_manager'
  const title = designation || (canEdit ? 'Finance Manager' : 'Director')
  return canEdit ? (
    <Badge className="max-w-48 bg-accent text-accent-foreground" title={`${title} · can add, edit and delete`}>
      <ShieldCheck aria-hidden />
      <span className="truncate">{title}</span>
    </Badge>
  ) : (
    <Badge variant="outline" className="max-w-48" title={`${title} · view only`}>
      <Eye aria-hidden />
      <span className="truncate">{title} (View Only)</span>
    </Badge>
  )
}
