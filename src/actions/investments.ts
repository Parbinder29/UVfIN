'use server'

import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/auth'
import { investmentSchema } from '@/lib/validators'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function createInvestment(formData: FormData) {
  await requireManager()

  const rawData = {
    investor_id: formData.get('investor_id'),
    amount: formData.get('amount'),
    invested_at: formData.get('invested_at'),
    payment_method: formData.get('payment_method') || undefined,
    reference_no: formData.get('reference_no') || undefined,
    notes: formData.get('notes') || undefined,
  }

  const validated = investmentSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: 'Invalid data', issues: validated.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('investments').insert({
    ...validated.data,
    created_by: user!.id,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/investments')
  revalidatePath('/investments/investors')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateInvestment(id: string, formData: FormData) {
  await requireManager()

  const rawData = {
    investor_id: formData.get('investor_id'),
    amount: formData.get('amount'),
    invested_at: formData.get('invested_at'),
    payment_method: formData.get('payment_method') || undefined,
    reference_no: formData.get('reference_no') || undefined,
    notes: formData.get('notes') || undefined,
  }

  const validated = investmentSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: 'Invalid data', issues: validated.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('investments').update(validated.data).eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/investments')
  revalidatePath('/investments/investors')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteInvestment(id: string) {
  await requireManager()

  const supabase = await createClient()

  const { error } = await supabase.from('investments').update({ is_deleted: true }).eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/investments')
  revalidatePath('/investments/investors')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function getInvestments(filters?: {
  investorId?: string
  startDate?: string
  endDate?: string
  paymentMethod?: string
  minAmount?: number
  maxAmount?: number
  search?: string
  page?: number
  pageSize?: number
}) {
  const supabase = await createClient()

  let query = supabase
    .from('investments')
    .select(`
      *,
      investors:full_name,
      profiles:created_by (full_name)
    `, { count: 'exact' })
    .eq('is_deleted', false)
    .order('invested_at', { ascending: false })

  if (filters?.investorId) query = query.eq('investor_id', filters.investorId)
  if (filters?.startDate) query = query.gte('invested_at', filters.startDate)
  if (filters?.endDate) query = query.lte('invested_at', filters.endDate)
  if (filters?.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
  if (filters?.minAmount) query = query.gte('amount', filters.minAmount)
  if (filters?.maxAmount) query = query.lte('amount', filters.maxAmount)
  if (filters?.search) {
    query = query.or(`investors.full_name.ilike.%${filters.search}%,reference_no.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`)
  }

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

export async function getInvestorsForSelect() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('investors')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}