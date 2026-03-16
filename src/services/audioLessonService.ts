import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export interface AudioLesson {
  id: string
  lesson_id?: string // Real video_lesson ID (without prefix)
  title: string
  description?: string
  series?: string // Mapped from module name
  module_id: string
  duration_minutes?: number
  audio_url?: string // Mapped from audio_source_url
  audio_source_type: 'panda_video_hls' | 'mp3_url'
  thumbnail_url?: string
  is_preview?: boolean
  rating?: number
  listens_count?: number
  created_at?: string
}

export interface AudioModule {
  id: string
  name: string
  course_id: string
}

export interface EvercastCourse {
  id: string
  name: string
  description: string | null
  thumbnail_url: string | null
  sales_url: string | null
  modules: EvercastModule[]
  total_lessons: number
  total_duration_minutes: number
}

export interface EvercastModule {
  id: string
  name: string
  order_index: number
  lessons: AudioLesson[]
}

export const audioLessonService = {
  // Buscar todas as audioaulas
  async getAudioLessons(): Promise<AudioLesson[]> {
    try {
      logger.debug('🔍 Fetching audio lessons from database...')

      const { data: lessons, error } = await supabase
        .from('audio_lessons')
        .select(`
            *,
            audio_modules (
                name,
                audio_courses (
                    thumbnail_url
                )
            )
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        logger.error('❌ Error fetching audio lessons:', error)
        throw error
      }

      logger.debug('✅ Found audio lessons:', lessons?.length || 0)

      return lessons?.map(lesson => {
        // @ts-ignore
        const moduleName = lesson.audio_modules?.name || 'Geral'
        // @ts-ignore
        const courseThumb = lesson.audio_modules?.audio_courses?.thumbnail_url

        return {
          id: lesson.id,
          title: lesson.title,
          description: lesson.description || '',
          series: moduleName,
          module_id: lesson.module_id,
          duration_minutes: lesson.duration_seconds ? Math.round(lesson.duration_seconds / 60) : 0,
          audio_url: lesson.audio_source_url,
          // Use course thumbnail or default
          thumbnail_url: courseThumb || `https://img.usecurling.com/p/400/400?q=${encodeURIComponent(lesson.title || 'audio lesson')}`,
          audio_source_type: lesson.audio_source_type || 'panda_video_hls',
          rating: 5.0, // Not in DB yet
          listens_count: 0, // Not in DB yet
          created_at: lesson.created_at
        }
      }) || []
    } catch (error) {
      logger.error('Erro ao buscar audioaulas:', error)
      return []
    }
  },

  // Buscar audioaula por ID
  async getAudioLessonById(id: string): Promise<AudioLesson | null> {
    try {
      const { data: lesson, error } = await supabase
        .from('audio_lessons')
        .select(`
            *,
            audio_modules (
                name,
                audio_courses (
                    thumbnail_url
                )
            )
        `)
        .eq('id', id)
        .single()

      if (error) throw error

      // @ts-ignore
      const moduleName = lesson.audio_modules?.name || 'Geral'
      // @ts-ignore
      const courseThumb = lesson.audio_modules?.audio_courses?.thumbnail_url

      return {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description || '',
        series: moduleName,
        module_id: lesson.module_id,
        duration_minutes: lesson.duration_seconds ? Math.round(lesson.duration_seconds / 60) : 0,
        audio_url: lesson.audio_source_url,
        thumbnail_url: courseThumb || `https://img.usecurling.com/p/400/400?q=${encodeURIComponent(lesson.title || 'audio lesson')}`,
        audio_source_type: lesson.audio_source_type || 'panda_video_hls',
        rating: 5.0,
        listens_count: 0,
        created_at: lesson.created_at
      }
    } catch (error) {
      logger.error('Erro ao buscar audioaula:', error)
      return null
    }
  },

  async getAudioModules(): Promise<AudioModule[]> {
    const { data, error } = await supabase
      .from('audio_modules')
      .select('id, name, course_id')
      .eq('is_active', true)
      .order('name')

    if (error) return []
    return data
  },

  async createAudioLesson(lesson: {
    title: string,
    module_id: string,
    duration_seconds: number,
    audio_source_url: string,
    audio_source_type: 'panda_video_hls' | 'mp3_url',
    description?: string
  }): Promise<AudioLesson | null> {
    try {
      // Find next order index
      const { count } = await supabase.from('audio_lessons').select('*', { count: 'exact', head: true }).eq('module_id', lesson.module_id)

      const { data, error } = await supabase
        .from('audio_lessons')
        .insert({
          ...lesson,
          order_index: (count || 0) + 1,
          is_active: true,
          is_preview: false
        })
        .select()
        .single()

      if (error) throw error
      return data as any
    } catch (error) {
      logger.error('Error creating audio lesson:', error)
      throw error
    }
  },

  async updateAudioLesson(id: string, updates: Partial<AudioLesson>): Promise<AudioLesson | null> {
    try {
      const dbUpdates: any = {}
      if (updates.title) dbUpdates.title = updates.title
      if (updates.description) dbUpdates.description = updates.description
      if (updates.module_id) dbUpdates.module_id = updates.module_id
      if (updates.duration_minutes) dbUpdates.duration_seconds = updates.duration_minutes * 60
      if (updates.audio_url) dbUpdates.audio_source_url = updates.audio_url
      if (updates.audio_source_type) dbUpdates.audio_source_type = updates.audio_source_type

      const { data, error } = await supabase
        .from('audio_lessons')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as any
    } catch (error) {
      logger.error('Error updating audio lesson:', error)
      throw error
    }
  },

  async deleteAudioLesson(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('audio_lessons')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      logger.error('Error deleting audio lesson:', error)
      throw error
    }
  },

  // Incrementar contador de visualizações
  async incrementListens(id: string): Promise<void> {
    // Placeholder as DB doesn't have it yet
    logger.debug('Increment listen', id)
  },

  async getEvercastCourses(userId: string, isAdmin?: boolean, showAll?: boolean): Promise<EvercastCourse[]> {
    try {
      let courseIds: string[] | null = null

      // Students need enrollment check (unless showAll for trial browsing)
      if (!isAdmin && !showAll) {
        const { data: userClasses, error: classesError } = await supabase
          .from('student_classes')
          .select('class_id')
          .eq('user_id', userId)

        if (classesError) throw classesError
        const classIds = userClasses?.map(uc => uc.class_id) || []
        if (classIds.length === 0) return []

        const { data: classCourses, error: coursesError } = await supabase
          .from('class_courses')
          .select('course_id')
          .in('class_id', classIds)

        if (coursesError) throw coursesError
        courseIds = [...new Set(classCourses?.map(cc => cc.course_id) || [])]
        if (courseIds.length === 0) return []
      }

      // Get evercast-enabled courses
      let query = supabase
        .from('video_courses')
        .select('id, name, description, thumbnail_url, sales_url')
        .eq('evercast_enabled', true)
        .eq('is_active', true)

      if (courseIds) {
        query = query.in('id', courseIds)
      }

      const { data: courses, error: coursesErr } = await query

      // If evercast_enabled column doesn't exist yet, return empty
      if (coursesErr) {
        logger.error('Evercast query failed (column may not exist yet):', coursesErr)
        return []
      }
      if (!courses || courses.length === 0) return []

      // Get modules and lessons for these courses
      const result: EvercastCourse[] = await Promise.all(
        courses.map(async (course) => {
          const { data: modules } = await supabase
            .from('video_modules')
            .select('id, name, order_index')
            .eq('course_id', course.id)
            .eq('is_active', true)
            .order('order_index')

          const moduleIds = modules?.map(m => m.id) || []
          let lessons: any[] = []

          if (moduleIds.length > 0) {
            const { data: lessonData } = await supabase
              .from('video_lessons')
              .select('id, title, description, duration_seconds, module_id, order_index, video_source_id, video_source_type, is_preview')
              .in('module_id', moduleIds)
              .eq('is_active', true)
              .not('video_source_id', 'is', null)
              .order('order_index')

            lessons = lessonData || []
          }

          const evercastModules: EvercastModule[] = (modules || []).map(mod => ({
            id: mod.id,
            name: mod.name,
            order_index: mod.order_index,
            lessons: lessons
              .filter(l => l.module_id === mod.id)
              .map(l => ({
                id: `video_${l.id}`,
                lesson_id: l.id,
                title: l.title,
                description: l.description || '',
                series: course.name,
                module_id: l.module_id,
                duration_minutes: l.duration_seconds ? Math.round(l.duration_seconds / 60) : 0,
                audio_url: l.video_source_id
                  ? `https://b-vz-d0b3ae60-2ea.tv.pandavideo.com.br/${l.video_source_id}/playlist.m3u8`
                  : undefined,
                audio_source_type: 'panda_video_hls' as const,
                thumbnail_url: course.thumbnail_url || undefined,
                is_preview: l.is_preview || false,
                created_at: undefined,
              }))
          }))

          const totalLessons = lessons.length
          const totalDuration = lessons.reduce((sum: number, l: any) => sum + (l.duration_seconds || 0), 0)

          return {
            id: course.id,
            name: course.name,
            description: course.description,
            thumbnail_url: course.thumbnail_url,
            sales_url: (course as any).sales_url || null,
            modules: evercastModules,
            total_lessons: totalLessons,
            total_duration_minutes: Math.round(totalDuration / 60),
          }
        })
      )

      return result
    } catch (error) {
      logger.error('Error fetching evercast courses:', error)
      return []
    }
  },

  async getEvercastCourseFlatLessons(userId: string, isAdmin?: boolean): Promise<AudioLesson[]> {
    const courses = await this.getEvercastCourses(userId, isAdmin)
    return courses.flatMap(course =>
      course.modules.flatMap(mod => mod.lessons)
    )
  },
}
