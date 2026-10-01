import { Eye, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { UserRole } from '@/types'

export function RoleBadge({ role }: { role: UserRole }) {
  return role === 'finance_manager' ? (
    <Badge className="bg-accent text-accent-foreground">
      <ShieldCheck aria-hidden />
      Finance Manager
    </Badge>
  ) : (
    <Badge variant="outline">
      <Eye aria-hidden />
      Director (View Only)
    </Badge>
  )
}
