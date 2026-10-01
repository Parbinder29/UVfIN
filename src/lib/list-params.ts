import { z } from 'zod'
import { DATE_PRESETS, presetRange, type DatePreset } from '@/lib/dates'
import { sanitizeSearch } from '@/lib/search'

type RawParams = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const money = z.coerce.number().nonnegative().max(1e12)

export interface ListFilters {
  q: string
  preset: DatePreset
  from: string | null
  to: string | null
  kind: string | null
  method: string | null
  investor: string | null
  min: number | null
  max: number | null
  sort: string
  dir: 'asc' | 'desc'
  page: number
}

/**
 * Parse list filters from the URL. Anything malformed is ignored rather than
 * passed to the database; sort columns must come from the allow-list.
 */
export function parseListParams(
  raw: RawParams,
  opts: { sortable: readonly string[]; defaultSort: string; kinds?: readonly string[]; methods?: readonly string[]; defaultPreset?: DatePreset }
): ListFilters {
  const preset = (DATE_PRESETS as readonly string[]).includes(first(raw.range) ?? '')
    ? (first(raw.range) as DatePreset)
    : (opts.defaultPreset ?? 'all')

  let from: string | null = null
  let to: string | null = null
  if (preset === 'custom') {
    const f = dateStr.safeParse(first(raw.from))
    const t = dateStr.safeParse(first(raw.to))
    from = f.success ? f.data : null
    to = t.success ? t.data : null
  } else {
    ;({ from, to } = presetRange(preset))
  }

  const kind = first(raw.kind)
  const method = first(raw.method)
  const investor = z.string().uuid().safeParse(first(raw.investor))
  const min = money.safeParse(first(raw.min))
  const max = money.safeParse(first(raw.max))
  const sort = first(raw.sort)
  const page = z.coerce.number().int().min(1).max(100000).safeParse(first(raw.page))

  return {
    q: sanitizeSearch(first(raw.q)),
    preset,
    from,
    to,
    kind: kind && opts.kinds?.includes(kind) ? kind : null,
    method: method && opts.methods?.includes(method) ? method : null,
    investor: investor.success ? investor.data : null,
    min: first(raw.min) && min.success ? min.data : null,
    max: first(raw.max) && max.success ? max.data : null,
    sort: sort && opts.sortable.includes(sort) ? sort : opts.defaultSort,
    dir: first(raw.dir) === 'asc' ? 'asc' : 'desc',
    page: page.success ? page.data : 1,
  }
}

/** Serialise filters back to a query string (used by CSV export and links). */
export function filtersToParams(f: Partial<ListFilters>): Record<string, string> {
  const out: Record<string, string> = {}
  if (f.q) out.q = f.q
  if (f.preset) out.range = f.preset
  if (f.preset === 'custom') {
    if (f.from) out.from = f.from
    if (f.to) out.to = f.to
  }
  if (f.kind) out.kind = f.kind
  if (f.method) out.method = f.method
  if (f.investor) out.investor = f.investor
  if (f.min != null) out.min = String(f.min)
  if (f.max != null) out.max = String(f.max)
  if (f.sort) out.sort = f.sort
  if (f.dir) out.dir = f.dir
  return out
}
