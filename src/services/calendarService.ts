import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { getMonth, getYear } from 'date-fns'
import { logger } from '@/lib/logger'

export type CalendarEvent =
  Database['public']['Tables']['calendar_events']['Row']

export const getCalendarEvents = async (
  date: Date,
): Promise<CalendarEvent[]> => {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const year = getYear(date)
  const month = getMonth(date)

  const firstDayOfMonth = new Date(year, month, 1).toISOString()
  const lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

  // Buscar perfil do usuário
  const { data: userProfile } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single()

  // Buscar turmas do aluno (se for aluno)
  let visibleClassIds: string[] = []
  if (userProfile?.role === 'student') {
    const { data: studentClasses } = await supabase
      .from('student_classes')
      .select('class_id')
      .eq('user_id', user.id)

    const enrolledClassIds = studentClasses?.map(sc => sc.class_id) || []
    visibleClassIds = [...enrolledClassIds]

    // For trial students: also show events from other classes that share the same courses
    // This lets degustacao students see the Extensivo EAOF schedule
    if (enrolledClassIds.length > 0) {
      const { data: enrolledCourses } = await supabase
        .from('class_courses')
        .select('course_id')
        .in('class_id', enrolledClassIds)

      const courseIds = enrolledCourses?.map(cc => cc.course_id) || []
      if (courseIds.length > 0) {
        const { data: siblingClasses } = await supabase
          .from('class_courses')
          .select('class_id')
          .in('course_id', courseIds)

        const siblingIds = siblingClasses?.map(cc => cc.class_id) || []
        for (const id of siblingIds) {
          if (!visibleClassIds.includes(id)) visibleClassIds.push(id)
        }
      }
    }
  }

  // Buscar eventos do mês
  let query = supabase
    .from('calendar_events')
    .select('*')
    .gte('start_time', firstDayOfMonth)
    .lte('start_time', lastDayOfMonth)

  // Se for aluno, filtrar por:
  // - Eventos das turmas do aluno + turmas irmas (mesmo curso)
  // - OU eventos globais (class_id NULL)
  if (userProfile?.role === 'student') {
    if (visibleClassIds.length > 0) {
      query = query.or(`class_id.in.(${visibleClassIds.join(',')}),class_id.is.null`)
    } else {
      query = query.is('class_id', null)
    }
  }
  // Professores e admins veem TODOS os eventos (sem filtro)

  query = query.order('start_time', { ascending: true })

  const { data, error } = await query

  if (error) {
    logger.error('❌ Error fetching calendar events:', error)
    throw new Error('Não foi possível carregar os eventos do calendário.')
  }

  return data || []
}

export const createEvent = async (event: {
  title: string
  description?: string
  start_time: string
  end_time?: string
  event_type: 'LIVE_CLASS' | 'ESSAY_DEADLINE' | 'SIMULATION' | 'GENERAL'
  class_id?: string | null
  related_entity_id?: string | null
}): Promise<CalendarEvent> => {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert(event)
    .select()
    .single()

  if (error) {
    logger.error('Error creating calendar event:', error)
    throw error
  }
  return data
}

export const updateEvent = async (eventId: string, event: {
  title: string
  description?: string
  start_time: string
  end_time?: string
  event_type: 'LIVE_CLASS' | 'ESSAY_DEADLINE' | 'SIMULATION' | 'GENERAL'
  class_id?: string | null
}): Promise<CalendarEvent> => {
  const { data, error } = await supabase
    .from('calendar_events')
    .update(event)
    .eq('id', eventId)
    .select()
    .single()

  if (error) {
    logger.error('Error updating calendar event:', error)
    throw error
  }
  return data
}

export const deleteEvent = async (eventId: string): Promise<void> => {
  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', eventId)

  if (error) {
    logger.error('Error deleting calendar event:', error)
    throw error
  }
}
