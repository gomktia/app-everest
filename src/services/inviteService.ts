import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export interface Invite {
  id?: string
  slug: string
  title: string
  description?: string | null
  course_id?: string | null
  class_id?: string | null
  access_duration_days?: number | null
  max_slots?: number | null
  cover_image_url?: string | null
  status: 'active' | 'archived'
  created_by_user_id?: string
}

export async function getAllInvites() {
  const { data, error } = await supabase
    .from('invites')
    .select('*, invite_registrations(count)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getInviteBySlug(slug: string) {
  const { data, error } = await supabase
    .from('invites')
    .select('*, video_courses(id, name, thumbnail_url, description), classes(id, name)')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()
  if (error) throw error
  return data
}

export async function getRegistrationCount(inviteId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_invite_registration_count', {
    p_invite_id: inviteId,
  })
  if (error) throw error
  return data || 0
}

export async function createInvite(invite: Omit<Invite, 'id'>) {
  const { data, error } = await supabase
    .from('invites')
    .insert(invite)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateInvite(id: string, invite: Partial<Invite>) {
  const { error } = await supabase
    .from('invites')
    .update({ ...invite, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function archiveInvite(id: string) {
  return updateInvite(id, { status: 'archived' })
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function registerForInvite(inviteId: string, userData: {
  name: string
  email: string
  phone?: string
  cpf_cnpj?: string
  password: string
}): Promise<{ userId: string; isNewUser: boolean }> {
  // 1. Get invite details
  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .select('*')
    .eq('id', inviteId)
    .eq('status', 'active')
    .single()

  if (inviteError || !invite) throw new Error('Convite nao encontrado ou inativo')

  // 2. Check slots (pre-check only — atomic check happens in step 6)
  if (invite.max_slots) {
    const count = await getRegistrationCount(inviteId)
    if (count >= invite.max_slots) throw new Error('Vagas esgotadas')
  }


  // 3. Try to create user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: userData.email,
    password: userData.password,
    options: {
      data: { first_name: userData.name.split(' ')[0] }
    }
  })

  let userId: string

  if (authError) {
    if (authError.message?.includes('weak_password') || authError.message?.includes('weak password') || (authError as any)?.code === 'weak_password') {
      throw new Error('WEAK_PASSWORD')
    }
    if (authError.message?.includes('already registered') || authError.message?.includes('already been registered')) {
      // User exists — try to sign in to get their ID and still enroll them
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: userData.password,
      })
      if (signInError || !signInData.user) {
        throw new Error('EMAIL_EXISTS')
      }
      userId = signInData.user.id
      // Sign out immediately — they'll login properly from the login page
      await supabase.auth.signOut()
    } else {
      throw authError
    }
  } else if (!authData.user) {
    throw new Error('EMAIL_EXISTS')
  } else {
    userId = authData.user.id
  }

  // 4. Create user profile
  const nameParts = userData.name.split(' ')
  const { error: profileError } = await supabase.from('users').upsert({
    id: userId,
    email: userData.email,
    first_name: nameParts[0],
    last_name: nameParts.slice(1).join(' ') || null,
    phone: userData.phone || null,
    cpf_cnpj: userData.cpf_cnpj || null,
    role: 'student',
    is_active: true
  })

  if (profileError) {
    logger.error('Profile upsert failed:', profileError)
    // Continue anyway — profile might already exist via trigger
  }

  // 5. Atomic slot check + enrollment via SECURITY DEFINER RPC
  // The RPC handles: invite_registrations, student_classes, and class_courses
  // This bypasses RLS restrictions that prevent students from self-enrolling
  logger.error(`[INVITE] Calling register_invite_slot: invite=${inviteId}, user=${userId}`)
  const { data: slotOk, error: slotError } = await supabase.rpc('register_invite_slot', {
    p_invite_id: inviteId,
    p_user_id: userId
  })

  logger.error(`[INVITE] RPC result: slotOk=${slotOk}, error=${slotError?.message || 'none'}`)

  if (slotError) {
    logger.error('[INVITE] register_invite_slot RPC failed:', slotError)
    throw new Error('Erro ao registrar. Tente novamente.')
  } else if (slotOk === false) {
    throw new Error('Vagas esgotadas')
  }

  // 6. Set subscription expiration (RPC should handle this but as fallback)
  if (invite.access_duration_days && invite.class_id) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + invite.access_duration_days)
    await supabase
      .from('student_classes')
      .update({ subscription_expires_at: expiresAt.toISOString() })
      .eq('user_id', userId)
      .eq('class_id', invite.class_id)
      .is('subscription_expires_at', null)
  }

  return { userId, isNewUser: true }
}
