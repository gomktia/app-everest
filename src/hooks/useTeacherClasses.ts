import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

interface TeacherContext {
  /** The teacher record ID (from teachers table) */
  teacherId: string | null
  /** IDs of classes this teacher owns */
  classIds: string[]
  /** IDs of students enrolled in the teacher's classes */
  studentIds: string[]
  /** Whether the current user is a teacher (not admin) */
  isTeacher: boolean
  /** Whether the current user is an administrator */
  isAdmin: boolean
  /** Loading state */
  loading: boolean
  /** Error message if teacher record is missing */
  error: string | null
}

/**
 * Hook that provides teacher-scoped filtering context.
 * - For teachers: returns their classIds and studentIds for data filtering
 * - For admins: returns empty arrays (no filtering needed, sees everything)
 */
export function useTeacherClasses(): TeacherContext {
  const { profile } = useAuth()
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [classIds, setClassIds] = useState<string[]>([])
  const [studentIds, setStudentIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isTeacher = profile?.role === 'teacher'
  const isAdmin = profile?.role === 'administrator'

  useEffect(() => {
    if (!profile) {
      setLoading(false)
      return
    }

    if (!isTeacher) {
      // Admin sees everything — no filtering needed
      setLoading(false)
      return
    }

    const fetchTeacherData = async () => {
      setLoading(true)
      try {
        // 1. Get teacher record
        const { data: teacher } = await supabase
          .from('teachers')
          .select('id')
          .eq('user_id', profile.id)
          .single()

        if (!teacher) {
          logger.error('Teacher record not found for user:', profile.id)
          setError('Registro de professor não encontrado. Peça ao administrador para configurar seu perfil de professor.')
          setLoading(false)
          return
        }

        const tid = teacher.id
        setTeacherId(tid)

        // 2. Get class IDs for this teacher
        const { data: classes } = await supabase
          .from('classes')
          .select('id')
          .eq('teacher_id', tid)

        const cids = (classes || []).map((c: any) => c.id as string)
        setClassIds(cids)

        // 3. Get student IDs enrolled in these classes
        if (cids.length > 0) {
          const { data: enrollments } = await supabase
            .from('student_classes')
            .select('user_id')
            .in('class_id', cids)

          const sids = [...new Set((enrollments || []).map((e: any) => e.user_id as string))]
          setStudentIds(sids)
        }
      } catch (error) {
        logger.error('Error fetching teacher classes:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTeacherData()
  }, [profile?.id, isTeacher])

  return { teacherId, classIds, studentIds, isTeacher, isAdmin, loading, error }
}
