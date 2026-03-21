import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { logger } from '@/lib/logger'

export type User = Database['public']['Tables']['users']['Row']

export interface PaginatedUsers {
  data: User[]
  count: number
}

export const getUsers = async (
  page: number = 0,
  pageSize: number = 50,
  search?: string,
  role?: string
): Promise<PaginatedUsers> => {
  let query = supabase
    .from('users')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (role) {
    query = query.eq('role', role)
  }

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data, error, count } = await query

  if (error) {
    logger.warn('Error fetching users:', error.message)
    throw error
  }

  return { data: data || [], count: count || 0 }
}

export const getUserById = async (id: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()
  if (error) {
    logger.error(error)
    return null
  }
  return data
}

export const updateUser = async (
  id: string,
  updates: Partial<User>,
): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    logger.error(error)
    return null
  }
  return data
}

export const getUserClasses = async (userId: string) => {
  const { data, error } = await supabase
    .from('student_classes')
    .select(`
      id,
      user_id,
      class_id,
      enrollment_date,
      class:classes!class_id (
        id,
        name,
        description,
        status,
        start_date,
        end_date
      )
    `)
    .eq('user_id', userId)

  if (error) {
    logger.error('Error fetching user classes:', error)
    throw error
  }

  return data || []
}

export const addUserToClass = async (userId: string, classId: string, expiresAt?: string) => {
  const { error } = await supabase
    .from('student_classes')
    .insert({
      user_id: userId,
      class_id: classId,
      enrollment_date: new Date().toISOString(),
      subscription_expires_at: expiresAt || null
    })

  if (error) {
    logger.error('Error adding user to class:', error)
    throw error
  }
}

export const removeUserFromClass = async (studentClassId: string) => {
  const { error } = await supabase
    .from('student_classes')
    .delete()
    .eq('id', studentClassId)

  if (error) {
    logger.error('Error removing user from class:', error)
    throw error
  }
}

/**
 * Busca todos os usuários com informações das turmas
 * Inclui um campo booleano indicando se está na turma Degustação
 */
export interface UserWithClasses extends User {
  classes?: Array<{
    id: string
    name: string
    class_type: string
  }>
  isInTastingClass?: boolean
}

export interface PaginatedUsersWithClasses {
  data: UserWithClasses[]
  count: number
}

export const getUsersWithClasses = async (
  page: number = 0,
  pageSize: number = 50,
  search?: string,
  role?: string
): Promise<PaginatedUsersWithClasses> => {
  // 1. Buscar usuarios paginados
  let query = supabase
    .from('users')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (role) query = query.eq('role', role)
  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data: users, error: usersError, count } = await query

  if (usersError) {
    logger.warn('Error fetching users:', usersError.message)
    throw usersError
  }

  if (!users || users.length === 0) {
    return { data: [], count: 0 }
  }

  const userIds = users.map(u => u.id)

  // 2. Buscar turmas APENAS dos usuarios da pagina atual (2 queries paralelas)
  const [studentClassesResult, teacherClassesResult] = await Promise.all([
    supabase
      .from('student_classes')
      .select('user_id, classes!inner(id, name, class_type)')
      .in('user_id', userIds),
    supabase
      .from('classes')
      .select('id, name, class_type, teacher_id')
      .in('teacher_id', userIds)
  ])

  // Mapear turmas por user_id (alunos)
  const classesMap = new Map<string, Array<{ id: string; name: string; class_type: string }>>()
  for (const sc of studentClassesResult.data || []) {
    const arr = classesMap.get(sc.user_id) || []
    arr.push(sc.classes as any)
    classesMap.set(sc.user_id, arr)
  }

  // Mapear turmas por teacher_id (professores)
  const teacherClassesMap = new Map<string, Array<{ id: string; name: string; class_type: string }>>()
  for (const tc of teacherClassesResult.data || []) {
    if (!tc.teacher_id) continue
    const arr = teacherClassesMap.get(tc.teacher_id) || []
    arr.push({ id: tc.id, name: tc.name, class_type: tc.class_type })
    teacherClassesMap.set(tc.teacher_id, arr)
  }

  // 3. Combinar dados
  const usersWithClasses: UserWithClasses[] = users.map(user => {
    const userClasses = user.role === 'teacher' || user.role === 'administrator'
      ? teacherClassesMap.get(user.id) || []
      : classesMap.get(user.id) || []
    const isInTastingClass = userClasses.some(c =>
      c.name?.toLowerCase().includes('degustação') ||
      c.name?.toLowerCase().includes('degustacao')
    )
    return { ...user, classes: userClasses, isInTastingClass }
  })

  return { data: usersWithClasses, count: count || 0 }
}

export async function banUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ is_banned: true })
    .eq('id', userId)
  if (error) throw error
}

export async function unbanUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ is_banned: false })
    .eq('id', userId)
  if (error) throw error
}

export async function setUnlimitedAccess(userId: string, unlimited: boolean): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ is_unlimited_access: unlimited })
    .eq('id', userId)
  if (error) throw error
}

export async function getEnrollmentsByUser(userId: string) {
  const { data, error } = await supabase
    .from('student_classes')
    .select('*, classes(id, name, class_courses(video_courses(id, name)))')
    .eq('user_id', userId)
  if (error) throw error
  return data || []
}

export async function unenrollFromClass(userId: string, classId: string): Promise<void> {
  const { error } = await supabase
    .from('student_classes')
    .delete()
    .eq('user_id', userId)
    .eq('class_id', classId)
  if (error) throw error
}

export async function updateLastSeen(userId: string): Promise<void> {
  await supabase.rpc('update_last_seen', { p_user_id: userId })
}
