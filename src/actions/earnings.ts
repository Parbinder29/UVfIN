'use server'

import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/auth'
import { earningSchema } from '@/lib/validators'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function createEarning(formData: FormData) {
  await requireManager()

  const rawData = {
    earning_date: formData.get('earning_date'),
    amount: formData.get('amount'),
    source: formData.get('source'),
    client_name: formData.get('client_name') || undefined,
    description: formData.get('description') || undefined,
    payment_method: formData.get('payment_method') || undefined,
    reference_no: formData.get('reference_no') || undefined,
  }

  const validated = earningSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: 'Invalid data', issues: validated.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('earnings').insert({
    ...validated.data,
    created_by: user!.id,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/earnings')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateEarning(id: string, formData: FormData) {
  await requireManager()

  const rawData = {
    earning_date: formData.get('earning_date'),
    amount: formData.get('amount'),
    source: formData.get('source'),
    client_name: formData.get('client_name') || undefined,
    description: formData.get('description') || undefined,
    payment_method: formData.get('payment_method') || undefined,
    reference_no: formData.get('reference_no') || undefined,
  }

  const validated = earningSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: 'Invalid data', issues: validated.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('earnings').update(validated.data).eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/earnings')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteEarning(id: string) {
  await requireManager()

  const supabase = await createClient()

  const { error } = await supabase.from('earnings').update({ is_deleted: true }).eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/earnings')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function uploadEarningAttachment(file: File, earningId: string) {
  await requireManager()

  const supabase = await createClient()
  const fileExt = file.name.split('.').pop()
  const fileName = `${earningId}-${Date.now()}.${fileExt}`
  const filePath = `earnings/${fileName}`

  const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file)
  if (uploadError) {
    return { error: uploadError.message }
  }

  const { error: updateError } = await supabase.from('earnings').update({ attachment_path: filePath }).eq('id', earningId)
  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/earnings')
  return { success: true, path: filePath }
}

export async function getEarnings(filters?: {
  startDate?: string
  endDate?: string
  source?: string
  paymentMethod?: string
  minAmount?: number
  maxAmount?: number
  search?: string
  page?: number
  pageSize?: number
}) {
  const supabase = await createClient()

  let query = supabase
    .from('earnings')
    .select(`
      *,
      profiles:created_by (full_name)
    `, { count: 'exact' })
    .eq('is_deleted', false)
    .order('earning_date', { ascending: false })

  if (filters?.startDate) query = query.gte('earning_date', filters.startDate)
  if (filters?.endDate) query = query.lte('earning_date', filters.endDate)
  if (filters?.source) query = query.eq('source', filters.source)
  if (filters?.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
  if (filters?.minAmount) query = query.gte('amount', filters.minAmount)
  if (filters?.maxAmount) query = query.lte('amount', filters.maxAmount)
  if (filters?.search) {
    query = query.or(`client_name.ilike.%${filters.search}%,source.ilike.%${filters.search}%,description.ilike.%${filters.search}%,reference_no.ilike.%${filters.search}%`)
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