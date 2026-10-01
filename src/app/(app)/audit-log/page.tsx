import { z } from 'zod'
import { AuditFilters } from '@/components/audit/AuditFilters'
import { AuditTable } from '@/components/audit/AuditTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PaginationBar } from '@/components/tables/PaginationBar'
import { getProfileNames, requireUser } from '@/lib/auth'
import { AUDIT_ACTIONS, AUDIT_TABLES, getAuditLog, getInvestorSummaries } from '@/lib/queries'

export const metadata = { title: 'Audit Log · UVfIN' }

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function AuditLogPage(props: PageProps<'/audit-log'>) {
  await requireUser()
  const sp = await props.searchParams
  const pick = <T extends string>(v: string | undefined, allowed: readonly T[]) => (v && (allowed as readonly string[]).includes(v) ? (v as T) : null)
  const date = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  const filters = {
    table: pick(first(sp.section), AUDIT_TABLES),
    action: pick(first(sp.action), AUDIT_ACTIONS),
    user: z.string().uuid().safeParse(first(sp.user)).data ?? null,
    from: date(first(sp.from)),
    to: date(first(sp.to)),
  }
  const page = z.coerce.number().int().min(1).max(100000).safeParse(first(sp.page)).data ?? 1

  const [{ rows, count }, names, investors] = await Promise.all([getAuditLog(filters, page), getProfileNames(), getInvestorSummaries()])
  const investorNames = Object.fromEntries(investors.map((i) => [i.id, i.full_name]))

  return (
    <div className="space-y-4">
      <PageHeader title="Audit Log" description="Every create, update and delete, recorded automatically by the database. Read-only." />
      <AuditFilters users={Object.entries(names).map(([id, name]) => ({ id, name }))} />
      <div className="rounded-lg border bg-card">
        {rows.length === 0 ? <EmptyState title="No changes recorded" /> : <AuditTable rows={rows} names={names} investorNames={investorNames} />}
      </div>
      <PaginationBar page={page} count={count} />
    </div>
  )
}
