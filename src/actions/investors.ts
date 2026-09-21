'use server'

import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/auth'
import { investorSchema } from '@/lib/validators'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function createInvestor(formData: FormData) {
  await requireManager()

  const rawData = {
    full_name: formData.get('full_name'),
    email: formData.get('email') || undefined,
    phone: formData.get('phone') || undefined,
    notes: formData.get('notes') || undefined,
    is_active: formData.get('is_active') === 'true',
  }

  const validated = investorSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: 'Invalid data', issues: validated.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('investors').insert({
    ...validated.data,
    created_by: user!.id,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/investments/investors')
  revalidatePath('/investments')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateInvestor(id: string, formData: FormData) {
  await requireManager()

  const rawData = {
    full_name: formData.get('full_name'),
    email: formData.get('email') || undefined,
    phone: formData.get('phone') || undefined,
    notes: formData.get('notes') || undefined,
    is_active: formData.get('is_active') === 'true',
  }

  const validated = investorSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: 'Invalid data', issues: validated.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('investors').update(validated.data).eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/investments/investors')
  revalidatePath('/investments')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteInvestor(id: string) {
  await requireManager()

  const supabase = await createClient()

  // Soft delete by setting is_active to false
  const { error } = await supabase.from('investors').update({ is_active: false }).eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/investments/investors')
  revalidatePath('/investments')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function getInvestors(filters?: {
  isActive?: boolean
  search?: string
  page?: number
  pageSize?: number
}) {
  const supabase = await createClient()

  let query = supabase
    .from('investors')
    .select(`
      *,
      profiles:created_by (full_name),
      investments:amount
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters?.isActive !== undefined) query = query.eq('is_active', filters.isActive)
  if (filters?.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
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

  // Calculate total invested and contribution count for each investor
  const investorsWithTotals = (data || []).map(investor => {
    const investments = investor.investments || []
    const totalInvested = investments.reduce((sum: number, inv: { amount: string | number }) => sum + Number(inv.amount), 0)
    const contributionCount = investments.length
    return {
      ...investor,
      total_invested: totalInvested,
      contribution_count: contributionCount,
    }
  })

  return { data: investorsWithTotals, count: count || 0, error: null }
}

export async function getInvestorDetail(id: string) {
  const supabase = await createClient()

  const { data: investor, error: investorError } = await supabase
    .from('investors')
    .select(`
      *,
      profiles:created_by (full_name)
    `)
    .eq('id', id)
    .single()

  if (investorError) {
    return { data: null, error: investorError.message }
  }

  const { data: investments, error: invError } = await supabase
    .from('investments')
    .select(`
      *,
      profiles:created_by (full_name)
    `)
    .eq('investor_id', id)
    .eq('is_deleted', false)
    .order('invested_at', { ascending: false })

  if (invError) {
    return { data: null, error: invError.message }
  }

  const totalInvested = investments.reduce((sum, inv) => sum + Number(inv.amount), 0)

  return {
    data: {
      ...investor,
      total_invested: totalInvested,
      contribution_count: investments.length,
      investments: investments || [],
    },
    error: null,
  }
}