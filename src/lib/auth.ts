import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cache } from 'react'

export type UserRole = 'finance_manager' | 'director'

export interface UserProfile {
  id: string
  full_name: string
  role: UserRole
  created_at: string
}

export const getCurrentUser = cache(async (): Promise<{ user: { id: string; email: string } | null; profile: UserProfile | null }> => {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { user: null, profile: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('id', user.id)
    .single()

  return { 
    user: { id: user.id, email: user.email! }, 
    profile: profile as UserProfile | null 
  }
})

export const requireAuth = async () => {
  const { user, profile } = await getCurrentUser()
  
  if (!user || !profile) {
    redirect('/login')
  }
  
  return { user, profile }
}

export const requireManager = async () => {
  const { user, profile } = await requireAuth()
  
  if (profile.role !== 'finance_manager') {
    redirect('/dashboard')
  }
  
  return { user, profile }
}

export const isManager = (profile: UserProfile | null): boolean => {
  return profile?.role === 'finance_manager'
}

export const hasFinanceAccess = (profile: UserProfile | null): boolean => {
  return profile !== null
}