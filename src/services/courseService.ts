import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export interface Course {
  id: string
  name: string
  description: string
  thumbnail_url?: string
  modules: CourseModule[]
}

export interface CourseModule {
  id: string
  name: string
  description: string
  order_index: number
  parent_module_id?: string | null
  lessons: CourseLesson[]
  children?: CourseModule[]
}

export interface CourseLesson {
  id: string
  title: string
  description: string
  order_index: number
  duration_seconds?: number
  video_source_type?: string
  video_source_id?: string
  is_preview: boolean
  progress?: number
  completed?: boolean
  last_position?: number
}

export interface CourseWithProgress {
  id: string
  title: string
  description: string
  progress: number
  image: string
  modules_count: number
  lessons_count: number
  total_hours: number
  category?: string
}

export interface CourseTrail {
  trailName: string
  totalCourses: number
  totalLessons: number
  completedLessons: number
  averageProgress: number
  completedCourses: number
  courses: CourseWithProgress[]
}

export const courseService = {
  // Buscar todos os cursos
  async getAllCourses(): Promise<Course[]> {
    try {
      const { data: courses, error } = await supabase
        .from('video_courses')
        .select(`
          id,
          name,
          description,
          thumbnail_url,
          video_modules (
            id,
            name,
            description,
            order_index,
            video_lessons (
              id,
              title,
              description,
              order_index,
              duration_seconds,
              video_source_type,
              video_source_id,
              is_preview
            )
          )
        `)
        .eq('is_active', true)
        .order('name')

      if (error) throw error

      return courses?.map(course => ({
        id: course.id,
        name: course.name,
        description: course.description,
        thumbnail_url: course.thumbnail_url,
        modules: course.video_modules?.map(module => ({
          id: module.id,
          name: module.name,
          description: module.description,
          order_index: module.order_index,
          lessons: module.video_lessons?.map(lesson => ({
            id: lesson.id,
            title: lesson.title,
            description: lesson.description,
            order_index: lesson.order_index,
            duration_seconds: lesson.duration_seconds,
            video_source_type: lesson.video_source_type,
            video_source_id: lesson.video_source_id,
            is_preview: lesson.is_preview
          })) || []
        })) || []
      })) || []
    } catch (error) {
      logger.error('Erro ao buscar cursos:', error)
      return []
    }
  },

  // Buscar curso por ID
  async getCourseById(courseId: string): Promise<Course | null> {
    try {
      const { data: course, error } = await supabase
        .from('video_courses')
        .select(`
          id,
          name,
          description,
          thumbnail_url,
          video_modules (
            id,
            name,
            description,
            order_index,
            video_lessons (
              id,
              title,
              description,
              order_index,
              duration_seconds,
              video_source_type,
              video_source_id,
              is_preview
            )
          )
        `)
        .eq('id', courseId)
        .eq('is_active', true)
        .single()

      if (error) throw error

      return {
        id: course.id,
        name: course.name,
        description: course.description,
        thumbnail_url: course.thumbnail_url,
        modules: course.video_modules?.map(module => ({
          id: module.id,
          name: module.name,
          description: module.description,
          order_index: module.order_index,
          lessons: module.video_lessons?.map(lesson => ({
            id: lesson.id,
            title: lesson.title,
            description: lesson.description,
            order_index: lesson.order_index,
            duration_seconds: lesson.duration_seconds,
            video_source_type: lesson.video_source_type,
            video_source_id: lesson.video_source_id,
            is_preview: lesson.is_preview
          })) || []
        })) || []
      }
    } catch (error) {
      logger.error('Erro ao buscar curso:', error)
      return null
    }
  },

  // Buscar progresso do usuário em um curso (optimized: 2 queries instead of 3)
  async getUserCourseProgress(userId: string, courseId: string): Promise<Record<string, number>> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.id !== userId) return {}

      // 1. Get modules + lesson IDs in one nested query
      const { data: modules } = await supabase
        .from('video_modules')
        .select('id, video_lessons ( id )')
        .eq('course_id', courseId)

      const lessonIds = (modules || []).flatMap((m: any) =>
        (m.video_lessons || []).map((l: any) => l.id)
      )
      if (lessonIds.length === 0) return {}

      // 2. Fetch progress in one query
      const { data: progress, error } = await supabase
        .from('video_progress')
        .select('lesson_id, progress_percentage')
        .eq('user_id', userId)
        .in('lesson_id', lessonIds)

      if (error) throw error

      const progressMap: Record<string, number> = {}
      progress?.forEach(p => {
        progressMap[p.lesson_id] = p.progress_percentage
      })

      return progressMap
    } catch (error) {
      logger.error('Erro ao buscar progresso do curso:', error)
      return {}
    }
  },

  // Atualizar progresso do usuário em uma aula
  async updateLessonProgress(
    userId: string,
    lessonId: string,
    progressPercentage: number,
    currentTimeSeconds: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('video_progress')
        .upsert({
          user_id: userId,
          lesson_id: lessonId,
          progress_percentage: progressPercentage,
          current_time_seconds: currentTimeSeconds,
          is_completed: progressPercentage >= 90
        })

      if (error) throw error
    } catch (error) {
      logger.error('Erro ao atualizar progresso da aula:', error)
    }
  },

  /**
   * Get all courses for a user with detailed progress and statistics.
   * Optimized: 4 queries total instead of 4×N per course.
   */
  async getUserCoursesWithDetails(userId: string): Promise<CourseWithProgress[]> {
    try {
      // 1. Get user's classes
      const { data: userClasses, error: classesError } = await supabase
        .from('student_classes')
        .select('class_id')
        .eq('user_id', userId)

      if (classesError) throw classesError
      const classIds = userClasses?.map(uc => uc.class_id) || []
      if (classIds.length === 0) return []

      // 2. Get courses with nested modules+lessons in ONE query
      const { data: classCourses, error: coursesError } = await supabase
        .from('class_courses')
        .select(`
          course_id,
          video_courses (
            id, name, description, thumbnail_url, category,
            video_modules!video_modules_course_id_fkey (
              id, is_active,
              video_lessons ( id, duration_seconds, is_active )
            )
          )
        `)
        .in('class_id', classIds)

      if (coursesError) throw coursesError
      if (!classCourses || classCourses.length === 0) return []

      // 3. Collect ALL lesson IDs across all courses
      const allLessonIds: string[] = []
      const courseMap = new Map<string, { course: any; moduleIds: string[]; lessonIds: string[]; totalSeconds: number }>()

      for (const cc of classCourses) {
        const course = cc.video_courses as any
        if (!course || courseMap.has(cc.course_id)) continue

        const modules = (course.video_modules || []).filter((m: any) => m.is_active !== false)
        const moduleIds = modules.map((m: any) => m.id)
        const lessonIds: string[] = []
        let totalSeconds = 0

        for (const mod of modules) {
          for (const lesson of (mod.video_lessons || []).filter((l: any) => l.is_active !== false)) {
            lessonIds.push(lesson.id)
            totalSeconds += lesson.duration_seconds || 0
          }
        }

        allLessonIds.push(...lessonIds)
        courseMap.set(cc.course_id, { course, moduleIds, lessonIds, totalSeconds })
      }

      // 4. Fetch ALL user progress in ONE query
      const progressMap = new Map<string, { progress_percentage: number; is_completed: boolean }>()

      if (allLessonIds.length > 0) {
        const { data: progressData } = await supabase
          .from('video_progress')
          .select('lesson_id, progress_percentage, is_completed')
          .eq('user_id', userId)
          .in('lesson_id', allLessonIds)

        for (const p of progressData || []) {
          progressMap.set(p.lesson_id, p)
        }
      }

      // 5. Build results from cached data (no more queries)
      const results: CourseWithProgress[] = []

      for (const [courseId, info] of courseMap) {
        const { course, moduleIds, lessonIds, totalSeconds } = info
        const lessonsCount = lessonIds.length

        let courseProgress = 0
        if (lessonsCount > 0) {
          let totalProg = 0
          for (const lid of lessonIds) {
            totalProg += progressMap.get(lid)?.progress_percentage || 0
          }
          courseProgress = Math.round(totalProg / lessonsCount)
        }

        results.push({
          id: courseId,
          title: course.name || 'Curso',
          description: course.description || '',
          progress: courseProgress,
          image: course.thumbnail_url || '/placeholder.svg',
          modules_count: moduleIds.length,
          lessons_count: lessonsCount,
          total_hours: Math.round(totalSeconds / 3600 * 10) / 10,
          category: course.category || 'Geral',
        })
      }

      return results
    } catch (error) {
      logger.error('Error fetching user courses with details:', error)
      return []
    }
  },

  /**
   * Group courses by trail/category for Netflix-style display
   */
  async getUserCoursesByTrail(userId: string): Promise<CourseTrail[]> {
    try {
      const courses = await this.getUserCoursesWithDetails(userId)

      if (courses.length === 0) {
        return []
      }

      // Group courses by category
      const coursesByCategory = courses.reduce((acc, course) => {
        const category = course.category || 'Geral'
        if (!acc[category]) {
          acc[category] = []
        }
        acc[category].push(course)
        return acc
      }, {} as Record<string, CourseWithProgress[]>)

      // Convert to CourseTrail format
      const trails: CourseTrail[] = Object.entries(coursesByCategory).map(([trailName, trailCourses]) => {
        const totalLessons = trailCourses.reduce((sum, c) => sum + c.lessons_count, 0)
        const completedLessons = trailCourses.reduce((sum, c) => {
          return sum + Math.round((c.lessons_count * c.progress) / 100)
        }, 0)
        const averageProgress = trailCourses.length > 0
          ? trailCourses.reduce((sum, c) => sum + c.progress, 0) / trailCourses.length
          : 0
        const completedCourses = trailCourses.filter(c => c.progress === 100).length

        return {
          trailName,
          totalCourses: trailCourses.length,
          totalLessons,
          completedLessons,
          averageProgress: Math.round(averageProgress),
          completedCourses,
          courses: trailCourses
        }
      })

      return trails
    } catch (error) {
      logger.error('Error fetching courses by trail:', error)
      return []
    }
  },

  /**
   * Get a specific course with all its modules and lessons with progress.
   * Optimized: 3 queries total instead of 1 + N_modules + N_lessons.
   */
  async getCourseWithModulesAndProgress(courseId: string, userId: string) {
    try {
      // 1. Get course + modules + lessons in ONE nested query
      const { data: course, error: courseError } = await supabase
        .from('video_courses')
        .select(`
          *,
          video_modules (
            *,
            video_lessons (*)
          )
        `)
        .eq('id', courseId)
        .eq('is_active', true)
        .single()

      if (courseError) throw courseError

      // 2. Collect all lesson IDs (including submodule lessons)
      const allLessonIds: string[] = []
      const allModulesFlat = (course.video_modules || [])
        .filter((m: any) => m.is_active)
        .sort((a: any, b: any) => a.order_index - b.order_index)

      // Build tree: separate root and child modules
      const rootModules = allModulesFlat.filter((m: any) => !m.parent_module_id)
      const childMap = new Map<string, any[]>()
      for (const mod of allModulesFlat) {
        if ((mod as any).parent_module_id) {
          const arr = childMap.get((mod as any).parent_module_id) || []
          arr.push(mod)
          childMap.set((mod as any).parent_module_id, arr)
        }
      }

      const activeModules = rootModules

      for (const mod of allModulesFlat) {
        for (const lesson of (mod as any).video_lessons || []) {
          if (lesson.is_active) allLessonIds.push(lesson.id)
        }
      }

      // 3. Fetch ALL progress in ONE query
      const progressMap = new Map<string, any>()
      if (allLessonIds.length > 0) {
        const { data: progressData } = await supabase
          .from('video_progress')
          .select('lesson_id, progress_percentage, is_completed, current_time_seconds')
          .eq('user_id', userId)
          .in('lesson_id', allLessonIds)

        for (const p of progressData || []) {
          progressMap.set(p.lesson_id, p)
        }
      }

      // 4. Assemble result from cached data (with submodule tree)
      const buildLessons = (mod: any) =>
        ((mod as any).video_lessons || [])
          .filter((l: any) => l.is_active)
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((lesson: any) => {
            const progress = progressMap.get(lesson.id)
            return {
              ...lesson,
              progress: progress?.progress_percentage || 0,
              completed: !!progress?.is_completed,
              last_position: progress?.current_time_seconds || 0,
            }
          })

      const modulesWithLessons = activeModules.map((module: any) => {
        const children = (childMap.get(module.id) || [])
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((child: any) => ({
            ...child,
            video_lessons: undefined,
            lessons: buildLessons(child),
            children: [],
          }))

        return { ...module, video_lessons: undefined, lessons: buildLessons(module), children }
      })

      return {
        ...course,
        video_modules: undefined,
        modules: modulesWithLessons,
      }
    } catch (error) {
      logger.error('Error fetching course with modules:', error)
      return null
    }
  }
}
