/**
 * MemberKit Import Service
 *
 * Fetches data from MemberKit API and Panda Video API,
 * then inserts it into the Everest Supabase database.
 *
 * MemberKit API docs: https://memberkit.com.br/api/v1/
 * Panda Video API docs: https://pandavideo.readme.io/reference
 */

import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportProgress {
  step: string
  current: number
  total: number
  detail?: string
}

export type ProgressCallback = (progress: ImportProgress) => void

export interface PandaVideoInfo {
  id: string
  video_external_id: string | null
  video_player: string
  video_hls: string | null
  thumbnail: string | null
  duration: number | null
}

export interface ImportCourseResult {
  courseId: string
  courseName: string
  modulesCreated: number
  lessonsCreated: number
  attachmentsCreated: number
  errors: string[]
}

export interface ImportUsersResult {
  usersCreated: number
  usersAlreadyExisted: number
  enrollmentsCreated: number
  errors: string[]
}

// MemberKit response shapes

interface MKSection {
  id: number
  name: string
  title?: string
  position: number
  lessons: MKLessonStub[]
}

interface MKLessonStub {
  id: number
  name?: string
  title?: string
  position: number
}

interface MKCourseResponse {
  id: number
  name: string
  description: string | null
  image: string | null
  sections: MKSection[]
}

interface MKLessonFile {
  url: string
  name: string
  content_type: string | null
}

interface MKLessonDetail {
  id: number
  name?: string
  title?: string
  description: string | null
  content: string | null
  video: {
    source: string | null
    uid: string | null
    duration: number | null
    image: string | null
  } | null
  files: MKLessonFile[]
}

interface MKUser {
  id: number
  full_name: string
  email: string
}

interface MKMembership {
  id: number
  membership_level_id: number
  status: string
  user: MKUser
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PANDA_BASE = 'https://api-v2.pandavideo.com.br'

const RATE_LIMIT_DELAY_MS = 550 // ~109 req/min, safely under 120

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function mkFetch<T>(path: string, apiKey: string): Promise<T> {
  // Always route through Supabase Edge Function to avoid CORS
  const { data, error } = await supabase.functions.invoke('memberkit-proxy', {
    body: { endpoint: path, method: 'GET', apiKey },
  })

  if (error) {
    throw new Error(`MemberKit proxy error: ${error.message}`)
  }

  if (data?.error) {
    throw new Error(`MemberKit API error: ${data.error}`)
  }

  return data as T
}

interface PandaListResponse {
  videos: Array<{
    id: string
    title: string
    video_external_id: string | null
    video_player: string | null
    video_hls: string | null
    thumbnail: string | null
    length: number | null
  }>
  pages: number
  total: number
}

async function pandaFetch<T>(
  path: string,
  apiKey: string,
): Promise<T> {
  const url = `${PANDA_BASE}${path}`
  const res = await fetch(url, {
    headers: {
      Authorization: apiKey,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Panda Video API error ${res.status} on ${path}: ${body}`)
  }

  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// 1. Build Panda Video Map
// ---------------------------------------------------------------------------

/**
 * Fetches ALL videos from Panda Video and builds a lookup map
 * keyed by `video_external_id` (which matches MemberKit lesson video UIDs).
 */
export async function buildPandaVideoMap(
  pandaApiKey: string,
  onProgress?: ProgressCallback,
): Promise<Map<string, PandaVideoInfo>> {
  const map = new Map<string, PandaVideoInfo>()

  // Fetch first page to discover total pages
  const firstPage = await pandaFetch<PandaListResponse>(
    '/videos?page=1&limit=50',
    pandaApiKey,
  )

  const totalPages = firstPage.pages || 1
  const totalVideos = firstPage.total || 0

  onProgress?.({
    step: 'Carregando videos do Panda',
    current: 0,
    total: totalVideos,
    detail: `${totalPages} paginas encontradas`,
  })

  // Process first page — index by both video_external_id AND internal id
  for (const v of firstPage.videos) {
    const info: PandaVideoInfo = {
      id: v.id,
      video_external_id: v.video_external_id || null,
      video_player: v.video_player || '',
      video_hls: v.video_hls || null,
      thumbnail: v.thumbnail || null,
      duration: v.length ?? null,
    }
    if (v.video_external_id) {
      map.set(v.video_external_id, info)
    }
    // Also index by Panda internal ID so MemberKit UIDs that match it will resolve
    map.set(v.id, info)
  }

  onProgress?.({
    step: 'Carregando videos do Panda',
    current: firstPage.videos.length,
    total: totalVideos,
    detail: `Pagina 1/${totalPages}`,
  })

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    const pageData = await pandaFetch<PandaListResponse>(
      `/videos?page=${page}&limit=50`,
      pandaApiKey,
    )

    for (const v of pageData.videos) {
      const info: PandaVideoInfo = {
        id: v.id,
        video_external_id: v.video_external_id || null,
        video_player: v.video_player || '',
        video_hls: v.video_hls || null,
        thumbnail: v.thumbnail || null,
        duration: v.length ?? null,
      }
      if (v.video_external_id) {
        map.set(v.video_external_id, info)
      }
      map.set(v.id, info)
    }

    onProgress?.({
      step: 'Carregando videos do Panda',
      current: Math.min(page * 50, totalVideos),
      total: totalVideos,
      detail: `Pagina ${page}/${totalPages}`,
    })
  }

  logger.info(`Panda Video map built: ${map.size} videos with external IDs`)
  return map
}

// ---------------------------------------------------------------------------
// 2. Import a MemberKit Course
// ---------------------------------------------------------------------------

/**
 * Imports a single MemberKit course into Everest:
 * - Creates `video_courses` row
 * - Creates `video_modules` for each section
 * - Creates `video_lessons` for each lesson (with Panda video lookup)
 * - Creates `lesson_attachments` for each file
 */
export async function importMemberkitCourse(
  memberkitApiKey: string,
  courseId: number,
  pandaVideoMap: Map<string, PandaVideoInfo>,
  adminUserId: string,
  onProgress?: ProgressCallback,
): Promise<ImportCourseResult> {
  const errors: string[] = []

  // --- Fetch course data from MemberKit ---
  onProgress?.({
    step: 'Buscando curso no MemberKit',
    current: 0,
    total: 1,
    detail: `Curso ID ${courseId}`,
  })

  const mkCourse = await mkFetch<MKCourseResponse>(
    `/courses/${courseId}`,
    memberkitApiKey,
  )

  // Count total lessons for progress
  const totalLessons = mkCourse.sections.reduce(
    (sum, s) => sum + s.lessons.length,
    0,
  )

  onProgress?.({
    step: 'Curso encontrado',
    current: 1,
    total: 1,
    detail: `${mkCourse.name} - ${mkCourse.sections.length} modulos, ${totalLessons} aulas`,
  })

  // --- Create video_course in Supabase ---
  const { data: courseData, error: courseError } = await supabase
    .from('video_courses')
    .insert({
      name: mkCourse.name,
      description: mkCourse.description,
      thumbnail_url: mkCourse.image_url || mkCourse.image,
      created_by_user_id: adminUserId,
      is_active: true,
    })
    .select('id')
    .single()

  if (courseError || !courseData) {
    throw new Error(
      `Falha ao criar curso no Supabase: ${courseError?.message ?? 'sem dados'}`,
    )
  }

  const everestCourseId = courseData.id
  let modulesCreated = 0
  let lessonsCreated = 0
  let attachmentsCreated = 0
  let lessonIndex = 0

  // --- Process each section -> module ---
  for (const section of mkCourse.sections) {
    const sectionName = section.name || section.title || `Modulo ${section.id}`

    const { data: moduleData, error: moduleError } = await supabase
      .from('video_modules')
      .insert({
        course_id: everestCourseId,
        name: sectionName,
        description: null,
        order_index: section.position,
        is_active: true,
      })
      .select('id')
      .single()

    if (moduleError || !moduleData) {
      errors.push(
        `Modulo "${sectionName}": ${moduleError?.message ?? 'sem dados'}`,
      )
      continue
    }

    modulesCreated++
    const moduleId = moduleData.id

    // --- Process each lesson in the section ---
    for (const lessonStub of section.lessons) {
      lessonIndex++

      const stubName = lessonStub.name || lessonStub.title || `Aula ${lessonStub.id}`

      onProgress?.({
        step: 'Importando aulas',
        current: lessonIndex,
        total: totalLessons,
        detail: `${section.name || section.title || 'Modulo'} > ${stubName}`,
      })

      // Fetch full lesson detail from MemberKit
      await delay(RATE_LIMIT_DELAY_MS)

      let lessonDetail: MKLessonDetail
      try {
        lessonDetail = await mkFetch<MKLessonDetail>(
          `/lessons/${lessonStub.id}`,
          memberkitApiKey,
        )
      } catch (err) {
        errors.push(
          `Aula "${stubName}" (${lessonStub.id}): falha ao buscar detalhe - ${err}`,
        )
        continue
      }

      // Resolve lesson title: detail.name > detail.title > stub name > fallback
      const lessonTitle = lessonDetail.name || lessonDetail.title || stubName

      // Resolve video from Panda map
      const videoUid = lessonDetail.video?.uid ?? null
      let videoSourceId: string | null = null
      let durationSeconds: number | null = null

      if (videoUid) {
        const pandaInfo = pandaVideoMap.get(videoUid)
        if (pandaInfo) {
          // Use video_external_id for embed URLs (that's what Panda player expects)
          // Fall back to extracting from video_player URL, then to internal id
          videoSourceId = pandaInfo.video_external_id
            || (pandaInfo.video_player.includes('v=') ? pandaInfo.video_player.split('v=')[1] : null)
            || pandaInfo.id
          durationSeconds =
            pandaInfo.duration != null
              ? Math.round(pandaInfo.duration)
              : lessonDetail.video?.duration ?? null
        } else {
          // Video UID exists in MemberKit but not found in Panda — do NOT use raw UID as embed ID
          videoSourceId = null
          durationSeconds = lessonDetail.video?.duration ?? null
          errors.push(
            `Aula "${lessonTitle}": video UID ${videoUid} nao encontrado no Panda (video nao sera vinculado)`,
          )
        }
      }

      // Strip HTML tags from content for description (keep first 500 chars)
      const plainDescription = lessonDetail.content
        ? lessonDetail.content.replace(/<[^>]*>/g, '').substring(0, 500)
        : lessonDetail.description ?? null

      // Insert video_lesson
      const { data: lessonData, error: lessonError } = await supabase
        .from('video_lessons')
        .insert({
          module_id: moduleId,
          title: lessonTitle,
          description: plainDescription,
          order_index: lessonStub.position,
          video_source_type: videoSourceId ? 'panda_video' : null,
          video_source_id: videoSourceId,
          duration_seconds: durationSeconds,
          is_active: true,
          is_preview: false,
        })
        .select('id')
        .single()

      if (lessonError || !lessonData) {
        errors.push(
          `Aula "${lessonTitle}": ${lessonError?.message ?? 'sem dados'}`,
        )
        continue
      }

      lessonsCreated++

      // Insert lesson_attachments
      if (lessonDetail.files && lessonDetail.files.length > 0) {
        // Filter out files without a URL and ensure file_name is never null
        const validFiles = lessonDetail.files.filter((f) => f.url)
        const attachments = validFiles.map((f, idx) => ({
          lesson_id: lessonData.id,
          file_url: f.url,
          file_name: f.name || `anexo-${idx + 1}`,
          file_type: f.content_type ?? null,
        }))

        if (attachments.length > 0) {
          const { error: attachError, data: attachData } = await supabase
            .from('lesson_attachments')
            .insert(attachments)
            .select('id')

          if (attachError) {
            errors.push(
              `Anexos da aula "${lessonTitle}": ${attachError.message}`,
            )
          } else {
            attachmentsCreated += attachData?.length ?? 0
          }
        }
      }
    }
  }

  const result: ImportCourseResult = {
    courseId: everestCourseId,
    courseName: mkCourse.name,
    modulesCreated,
    lessonsCreated,
    attachmentsCreated,
    errors,
  }

  logger.info('MemberKit course import complete', result)
  return result
}

// ---------------------------------------------------------------------------
// 3. Import Users from MemberKit classroom
// ---------------------------------------------------------------------------

/**
 * Imports users from a MemberKit classroom:
 * - Fetches memberships for the given classroom
 * - Creates auth users via Supabase Auth Admin API (requires service role key)
 * - Creates public.users rows
 * - Enrolls students in the specified Everest class
 */
export async function importMemberkitUsers(
  memberkitApiKey: string,
  classroomId: number,
  everestClassId: string,
  defaultPassword: string,
  onProgress?: ProgressCallback,
  supabaseServiceRoleKey?: string,
): Promise<ImportUsersResult> {
  const errors: string[] = []
  let usersCreated = 0
  let usersAlreadyExisted = 0
  let enrollmentsCreated = 0

  // --- Fetch memberships from MemberKit ---
  onProgress?.({
    step: 'Buscando membros no MemberKit',
    current: 0,
    total: 0,
    detail: `Classroom ID ${classroomId}`,
  })

  const allMemberships: MKMembership[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const memberships = await mkFetch<MKMembership[]>(
      `/memberships?membership_level_id=${classroomId}&page=${page}`,
      memberkitApiKey,
    )

    if (!memberships || memberships.length === 0) {
      hasMore = false
    } else {
      allMemberships.push(...memberships)
      page++

      onProgress?.({
        step: 'Buscando membros no MemberKit',
        current: allMemberships.length,
        total: 0,
        detail: `Pagina ${page - 1} carregada (${allMemberships.length} membros)`,
      })

      if (memberships.length < 50) {
        hasMore = false
      }

      await delay(RATE_LIMIT_DELAY_MS)
    }
  }

  // Import all memberships (active, expired, and inactive)
  // Previously filtered only 'active' which excluded most students
  const activeMemberships = allMemberships

  onProgress?.({
    step: 'Importando usuarios',
    current: 0,
    total: activeMemberships.length,
    detail: `${activeMemberships.length} membros ativos encontrados`,
  })

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  // --- Process each membership ---
  for (let i = 0; i < activeMemberships.length; i++) {
    const membership = activeMemberships[i]
    const user = membership.user

    onProgress?.({
      step: 'Importando usuarios',
      current: i + 1,
      total: activeMemberships.length,
      detail: `${user.full_name} (${user.email})`,
    })

    // Split full_name into first_name and last_name
    const nameParts = user.full_name.trim().split(/\s+/)
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    // Check if user already exists in public.users
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()

    let userId: string

    if (existingUser) {
      userId = existingUser.id
      usersAlreadyExisted++
    } else {
      // Create auth user via Supabase Auth Admin API
      if (!supabaseServiceRoleKey) {
        errors.push(
          `Usuario "${user.email}": service role key necessaria para criar usuario`,
        )
        continue
      }

      try {
        const authRes = await fetch(
          `${supabaseUrl}/auth/v1/admin/users`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${supabaseServiceRoleKey}`,
              apikey: supabaseAnonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: user.email,
              password: defaultPassword,
              email_confirm: true,
              user_metadata: {
                first_name: firstName,
                last_name: lastName,
              },
            }),
          },
        )

        if (!authRes.ok) {
          const errBody = await authRes.text().catch(() => '')
          // Check if user already exists in auth (409 or specific error)
          if (authRes.status === 422 && errBody.includes('already been registered')) {
            // User exists in auth but not in public.users - look up by email
            const lookupRes = await fetch(
              `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(user.email)}`,
              {
                headers: {
                  Authorization: `Bearer ${supabaseServiceRoleKey}`,
                  apikey: supabaseAnonKey,
                },
              },
            )

            if (lookupRes.ok) {
              const lookupData = await lookupRes.json()
              const authUser = lookupData.users?.find(
                (u: { email: string }) => u.email === user.email,
              )
              if (authUser) {
                userId = authUser.id
                // Create/update the public.users record (trigger may have created it)
                await supabase.from('users').upsert({
                  id: userId,
                  email: user.email,
                  first_name: firstName,
                  last_name: lastName,
                  role: 'student',
                  is_active: true,
                }, { onConflict: 'id' })
                usersCreated++
              } else {
                errors.push(
                  `Usuario "${user.email}": encontrado no auth mas sem ID`,
                )
                continue
              }
            } else {
              errors.push(
                `Usuario "${user.email}": erro ao buscar usuario existente no auth`,
              )
              continue
            }
          } else {
            errors.push(
              `Usuario "${user.email}": erro ao criar no auth (${authRes.status}): ${errBody}`,
            )
            continue
          }
        } else {
          const authData = await authRes.json()
          userId = authData.id

          // Create/update the public.users record (trigger may have created it)
          const { error: userError } = await supabase.from('users').upsert({
            id: userId,
            email: user.email,
            first_name: firstName,
            last_name: lastName,
            role: 'student',
            is_active: true,
          }, { onConflict: 'id' })

          if (userError) {
            errors.push(
              `Usuario "${user.email}": criado no auth mas erro no public.users: ${userError.message}`,
            )
            continue
          }

          usersCreated++
        }
      } catch (err) {
        errors.push(`Usuario "${user.email}": ${err}`)
        continue
      }
    }

    // Enroll in the Everest class
    // Check if enrollment already exists
    const { data: existingEnrollment } = await supabase
      .from('student_classes')
      .select('id')
      .eq('user_id', userId!)
      .eq('class_id', everestClassId)
      .maybeSingle()

    if (!existingEnrollment) {
      const { error: enrollError } = await supabase
        .from('student_classes')
        .insert({
          user_id: userId!,
          class_id: everestClassId,
          enrollment_date: new Date().toISOString().split('T')[0],
        })

      if (enrollError) {
        errors.push(
          `Matricula "${user.email}": ${enrollError.message}`,
        )
      } else {
        enrollmentsCreated++
      }
    }
  }

  const result: ImportUsersResult = {
    usersCreated,
    usersAlreadyExisted,
    enrollmentsCreated,
    errors,
  }

  logger.info('MemberKit user import complete', result)
  return result
}

// ---------------------------------------------------------------------------
// 4. Helper: Fetch MemberKit classrooms (for the admin UI picker)
// ---------------------------------------------------------------------------

export interface MKClassroom {
  id: number
  name: string
  course_name: string
  users_count: number
}

/**
 * Fetches all classrooms from MemberKit so the admin can pick which to import.
 */
export async function fetchMemberkitClassrooms(
  memberkitApiKey: string,
): Promise<MKClassroom[]> {
  const data = await mkFetch<MKClassroom[]>('/classrooms', memberkitApiKey)
  return data || []
}

// ---------------------------------------------------------------------------
// 5. Helper: Fetch MemberKit courses (for the admin UI picker)
// ---------------------------------------------------------------------------

export interface MKCourse {
  id: number
  name: string
  description: string | null
  image: string | null
  image_url: string | null
}

/**
 * Fetches all courses from MemberKit so the admin can pick which to import.
 */
export async function fetchMemberkitCourses(
  memberkitApiKey: string,
): Promise<MKCourse[]> {
  const data = await mkFetch<MKCourse[]>('/courses', memberkitApiKey)
  return data || []
}
