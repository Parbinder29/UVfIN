'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export async function getAuditLog(filters?: {
  tableName?: string
  action?: string
  changedBy?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}) {
  const { user } = await requireAuth()
  const supabase = await createClient()

  let query = supabase
    .from('audit_log')
    .select(`
      *,
      profiles:changed_by (full_name)
    `, { count: 'exact' })
    .order('changed_at', { ascending: false })

  if (filters?.tableName) query = query.eq('table_name', filters.tableName)
  if (filters?.action) query = query.eq('action', filters.action)
  if (filters?.changedBy) query = query.eq('changed_by', filters.changedBy)
  if (filters?.startDate) query = query.gte('changed_at', filters.startDate)
  if (filters?.endDate) query = query.lte('changed_at', filters.endDate)

  const page = filters?.page || 1
  const pageSize = filters?.pageSize || 25
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    return { data: [], count: 0, error: error.message }
  }

  return { data: data || [], count: count || 0, error: null }
}

export async function getAuditLogDetail(id: string) {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('audit_log')
    .select(`
      *,
      profiles:changed_by (full_name)
    `)
    .eq('id', id)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data, error: null }
}