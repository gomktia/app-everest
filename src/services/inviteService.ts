import { supabase } from '@/lib/supabase/client'

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
  const { count, error } = await supabase
    .from('invite_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('invite_id', inviteId)
  if (error) throw error
  return count || 0
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

  // 2. Check slots
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

  if (authError) {
    if (authError.message?.includes('already registered') || authError.message?.includes('already been registered')) {
      throw new Error('EMAIL_EXISTS')
    }
    throw authError
  }

  const userId = authData.user!.id

  // 4. Create user profile
  const nameParts = userData.name.split(' ')
  await supabase.from('users').upsert({
    id: userId,
    email: userData.email,
    first_name: nameParts[0],
    last_name: nameParts.slice(1).join(' ') || null,
    role: 'student',
    is_active: true
  })

  // 5. Enroll in class
  if (invite.class_id) {
    const expiresAt = invite.access_duration_days
      ? new Date(Date.now() + invite.access_duration_days * 86400000).toISOString()
      : null

    await supabase.from('student_classes').upsert({
      user_id: userId,
      class_id: invite.class_id,
      source: 'invite',
      enrollment_date: new Date().toISOString(),
      subscription_expires_at: expiresAt
    }, { onConflict: 'user_id,class_id' }).catch(() => {
      // Ignore if already enrolled
    })

    // 5b. Ensure course is linked to class (class_courses)
    if (invite.course_id) {
      await supabase.from('class_courses').upsert({
        class_id: invite.class_id,
        course_id: invite.course_id
      }, { onConflict: 'class_id,course_id' }).catch(() => {
        // Ignore if already linked
      })
    }
  }

  // 6. Track registration
  await supabase.from('invite_registrations').insert({
    invite_id: inviteId,
    user_id: userId
  }).catch(() => {
    // Ignore duplicate registration
  })

  return { userId, isNewUser: true }
}
