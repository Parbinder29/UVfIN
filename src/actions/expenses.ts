'use server'

import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/auth'
import { expenseSchema } from '@/lib/validators'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function createExpense(formData: FormData) {
  await requireManager()
  
  const rawData = {
    expense_date: formData.get('expense_date'),
    amount: formData.get('amount'),
    category: formData.get('category'),
    payee: formData.get('payee'),
    description: formData.get('description') || undefined,
    payment_method: formData.get('payment_method') || undefined,
    reference_no: formData.get('reference_no') || undefined,
  }

  const validated = expenseSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: 'Invalid data', issues: validated.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const { error } = await supabase.from('expenses').insert({
    ...validated.data,
    created_by: user!.id,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/money-spent')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateExpense(id: string, formData: FormData) {
  await requireManager()
  
  const rawData = {
    expense_date: formData.get('expense_date'),
    amount: formData.get('amount'),
    category: formData.get('category'),
    payee: formData.get('payee'),
    description: formData.get('description') || undefined,
    payment_method: formData.get('payment_method') || undefined,
    reference_no: formData.get('reference_no') || undefined,
  }

  const validated = expenseSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: 'Invalid data', issues: validated.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  
  const { error } = await supabase.from('expenses').update(validated.data).eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/money-spent')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteExpense(id: string) {
  await requireManager()
  
  const supabase = await createClient()
  
  const { error } = await supabase.from('expenses').update({ is_deleted: true }).eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/money-spent')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function uploadAttachment(file: File, expenseId: string) {
  await requireManager()
  
  const supabase = await createClient()
  const fileExt = file.name.split('.').pop()
  const fileName = `${expenseId}-${Date.now()}.${fileExt}`
  const filePath = `expenses/${fileName}`

  const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file)
  if (uploadError) {
    return { error: uploadError.message }
  }

  const { error: updateError } = await supabase.from('expenses').update({ attachment_path: filePath }).eq('id', expenseId)
  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/money-spent')
  return { success: true, path: filePath }
}

export async function getExpenses(filters?: {
  startDate?: string
  endDate?: string
  category?: string
  paymentMethod?: string
  minAmount?: number
  maxAmount?: number
  search?: string
  page?: number
  pageSize?: number
}) {
  const supabase = await createClient()
  
  let query = supabase
    .from('expenses')
    .select(`
      *,
      profiles:created_by (full_name)
    `, { count: 'exact' })
    .eq('is_deleted', false)
    .order('expense_date', { ascending: false })

  if (filters?.startDate) query = query.gte('expense_date', filters.startDate)
  if (filters?.endDate) query = query.lte('expense_date', filters.endDate)
  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
  if (filters?.minAmount) query = query.gte('amount', filters.minAmount)
  if (filters?.maxAmount) query = query.lte('amount', filters.maxAmount)
  if (filters?.search) {
    query = query.or(`payee.ilike.%${filters.search}%,description.ilike.%${filters.search}%,reference_no.ilike.%${filters.search}%`)
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