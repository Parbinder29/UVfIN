'use client'

import { createClient } from '@/lib/supabase/client'
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_TYPES } from '@/lib/constants'

export function checkAttachment(file: File): string | null {
  if (!(file.type in ATTACHMENT_TYPES)) return 'Only PDF, JPG or PNG files are allowed.'
  if (file.size > ATTACHMENT_MAX_BYTES) return 'File must be 5 MB or smaller.'
  if (file.size === 0) return 'File is empty.'
  return null
}

/** Upload to the private bucket under <section>/<recordId>/<random>.<ext>. Returns the storage path. */
export async function uploadAttachment(section: 'expenses' | 'earnings', recordId: string, file: File): Promise<string> {
  const problem = checkAttachment(file)
  if (problem) throw new Error(problem)
  const ext = ATTACHMENT_TYPES[file.type as keyof typeof ATTACHMENT_TYPES]
  const path = `${section}/${recordId}/${crypto.randomUUID()}.${ext}`
  const supabase = createClient()
  const { error } = await supabase.storage.from('attachments').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error('Upload failed. Please try again.')
  return path
}
