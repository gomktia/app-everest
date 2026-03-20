import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { logger } from '@/lib/logger'

export type User = Database['public']['Tables']['users']['Row']

export const getUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    logger.warn('Error fetching users:', error.message)
    throw error
  }

  return data || []
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

export const getUsersWithClasses = async (): Promise<UserWithClasses[]> => {
  // Buscar todos os usuários
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  if (usersError) {
    logger.warn('Error fetching users:', usersError.message)
    throw usersError
  }

  if (!users || users.length === 0) {
    return []
  }

  // Buscar turmas de todos os usuários
  // Note: class_type may not exist yet in production — fall back to query without it
  let studentClasses: any[] | null = null
  const { data: scData, error: classesError } = await supabase
    .from('student_classes')
    .select(`
      user_id,
      classes!inner (
        id,
        name,
        class_type
      )
    `)

  if (classesError) {
    // If error is about class_type column, retry without it
    if (classesError.message?.includes('class_type') || classesError.code === '42703') {
      logger.warn('class_type column not found, retrying without it')
      const { data: fallback } = await supabase
        .from('student_classes')
        .select(`user_id, classes!inner(id, name)`)
      studentClasses = fallback
    } else {
      logger.warn('Error fetching student classes (non-fatal):', classesError.message)
    }
  } else {
    studentClasses = scData
  }

  // Buscar turmas de professores (via teacher_id na tabela classes)
  const { data: teacherClasses } = await supabase
    .from('classes')
    .select('id, name, class_type, teacher_id')
    .not('teacher_id', 'is', null)

  // Mapear turmas por user_id (alunos)
  const classesMap = new Map<string, Array<{ id: string; name: string; class_type: string }>>()

  if (studentClasses) {
    studentClasses.forEach((sc: any) => {
      const userId = sc.user_id
      const classInfo = sc.classes

      if (!classesMap.has(userId)) {
        classesMap.set(userId, [])
      }
      classesMap.get(userId)?.push(classInfo)
    })
  }

  // Mapear turmas por teacher_id (professores)
  const teacherClassesMap = new Map<string, Array<{ id: string; name: string; class_type: string }>>()

  if (teacherClasses) {
    teacherClasses.forEach((tc: any) => {
      const teacherId = tc.teacher_id
      if (!teacherClassesMap.has(teacherId)) {
        teacherClassesMap.set(teacherId, [])
      }
      teacherClassesMap.get(teacherId)?.push({ id: tc.id, name: tc.name, class_type: tc.class_type })
    })
  }

  // Combinar dados
  const usersWithClasses: UserWithClasses[] = users.map(user => {
    const userClasses = user.role === 'teacher' || user.role === 'administrator'
      ? teacherClassesMap.get(user.id) || []
      : classesMap.get(user.id) || []
    const isInTastingClass = userClasses.some(c =>
      c.name.toLowerCase().includes('degustação') ||
      c.name.toLowerCase().includes('degustacao')
    )

    return {
      ...user,
      classes: userClasses,
      isInTastingClass
    }
  })

  return usersWithClasses
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
