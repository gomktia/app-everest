import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { StudentNotebook } from '@/components/StudentNotebook'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/components/ui/use-toast'
import { courseService } from '@/services/courseService'
import { useAuth } from '@/hooks/use-auth'
import { useTrialLimits } from '@/hooks/use-trial-limits'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { getSupportWhatsAppUrl } from '@/lib/constants'
import { rankingService } from '@/services/rankingService'
import {
  lessonInteractionService,
  type LessonComment,
  type LessonRatingStats,
} from '@/services/lessonInteractionService'
import { logger } from '@/lib/logger'
import { LessonTourButton } from '@/components/courses/LessonTour'
import { LessonSidebar } from '@/components/courses/LessonSidebar'
import { LessonComments } from '@/components/courses/LessonComments'
import { LessonResources } from '@/components/courses/LessonResources'
import { LessonAIChat } from '@/components/lessons/LessonAIChat'
import {
  ArrowLeft,
  CheckCircle,
  Play,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Paperclip,
  Clock,
  Menu,
  X,
  Moon,
  Sun,
  PanelRightOpen,
  PanelRightClose,
  MessageSquare,
  BookOpen,
  SkipForward,
  ShoppingCart,
  Sparkles,
  Brain,
  HelpCircle,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LessonData {
  id: string
  title: string
  description: string | null
  duration_seconds?: number
  video_source_type?: string
  video_source_id?: string
  completed?: boolean
  progress?: number
  last_position?: number
  topic_id?: string | null
  quiz_id?: string | null
  quiz_required?: boolean
  quiz_min_percentage?: number
}

interface ModuleData {
  id: string
  name: string
  order_index: number
  lessons: Array<{
    id: string
    title: string
    duration_seconds?: number
    order_index: number
    completed?: boolean
    is_preview?: boolean
  }>
}

interface CourseData {
  id: string
  name: string
  description?: string
  sales_url?: string | null
  modules: ModuleData[]
}

interface Attachment {
  id: string
  file_name: string
  file_type: string | null
  file_url: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Strip date/time stamps and "- Recording" suffix from lesson titles */
function cleanTitle(title: string): string {
  return title
    .replace(/\s*-\s*\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}\s+GMT[^\s]*/, '')
    .replace(/\s*-\s*Recording\s*$/i, '')
    .trim()
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LessonPlayerPage() {
  const { courseId, lessonId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const { isTrialUser: isTrialUserGlobal } = useTrialLimits()
  const [isTrialForThisCourse, setIsTrialForThisCourse] = useState(false)
  const isTrialUser = isTrialForThisCourse

  const [courseData, setCourseData] = useState<CourseData | null>(null)
  const [lessonData, setLessonData] = useState<LessonData | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  // Theater mode
  const [theaterMode, setTheaterMode] = useState(false)

  // Split view (PDF / Office)
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null)
  const [splitViewerType, setSplitViewerType] = useState<'pdf' | 'office'>('pdf')
  const [splitRatio, setSplitRatio] = useState(55)
  const isDragging = useRef(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  // Sidebar - visible by default
  const [desktopSidebarVisible, setDesktopSidebarVisible] = useState(true)

  // XP animation
  const [showXpAnimation, setShowXpAnimation] = useState(false)

  // Comments & Ratings
  const [comments, setComments] = useState<LessonComment[]>([])
  const [ratingStats, setRatingStats] = useState<LessonRatingStats>({ average: 0, total: 0, userRating: null })
  const [commentText, setCommentText] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [hoverRating, setHoverRating] = useState(0)
  const [activeTab, setActiveTab] = useState<'comments' | 'resources' | 'ai_chat'>('comments')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Notes
  const [noteContent, setNoteContent] = useState('')
  const [noteLastSaved, setNoteLastSaved] = useState<string | null>(null)
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Notebook (drawing + split view)
  const [drawingData, setDrawingData] = useState<string | null>(null)
  const [notebookOpen, setNotebookOpen] = useState(false)
  const [notebookExpanded, setNotebookExpanded] = useState(false)

  // Quiz & flashcards linked to this lesson
  const [hasQuiz, setHasQuiz] = useState(false)
  const [topicFlashcardCount, setTopicFlashcardCount] = useState(0)
  const [topicSubjectId, setTopicSubjectId] = useState<string | null>(null)
  const [quizPassed, setQuizPassed] = useState(false)
  const drawingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refs to track latest values for flush-on-lesson-change
  const noteContentRef = useRef(noteContent)
  const drawingDataRef = useRef(drawingData)
  const prevLessonIdRef = useRef(lessonId)
  noteContentRef.current = noteContent
  drawingDataRef.current = drawingData

  // Auto-play next lesson
  const [autoPlayNext, setAutoPlayNext] = useState(() => {
    return localStorage.getItem('everest-autoplay') !== 'false'
  })

  // Auto-play countdown
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Access rules
  const [blockedModuleIds, setBlockedModuleIds] = useState<Set<string>>(new Set())
  const [blockedLessonIds, setBlockedLessonIds] = useState<Set<string>>(new Set())
  const [freeLessonIds, setFreeLessonIds] = useState<Set<string>>(new Set())

  const mainContentRef = useRef<HTMLDivElement>(null)

  /* ---- flat lesson list for prev / next (respects access rules) ---- */
  const flatLessons = useMemo(() => {
    if (!courseData) return []
    return courseData.modules
      .sort((a, b) => a.order_index - b.order_index)
      .flatMap((m) => {
        const moduleBlocked = blockedModuleIds.has(m.id)
        return [...m.lessons]
          .sort((a, b) => a.order_index - b.order_index)
          .filter((l) => {
            // If lesson has explicit free rule, always include
            if (freeLessonIds.has(l.id)) return true
            // If lesson is explicitly blocked, exclude
            if (blockedLessonIds.has(l.id)) return false
            // If module is blocked and lesson has no override, exclude
            if (moduleBlocked) return false
            return true
          })
      })
  }, [courseData, blockedModuleIds, blockedLessonIds, freeLessonIds])

  const currentIndex = useMemo(
    () => flatLessons.findIndex((l) => l.id === lessonId),
    [flatLessons, lessonId],
  )
  const prevLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : null
  const nextLesson =
    currentIndex >= 0 && currentIndex < flatLessons.length - 1
      ? flatLessons[currentIndex + 1]
      : null

  /* ---- completed / total stats ---- */
  const completedCount = useMemo(
    () => flatLessons.filter((l) => l.completed).length,
    [flatLessons],
  )
  const totalCount = flatLessons.length

  /* ---- PDF attachments ---- */
  const pdfAttachments = useMemo(
    () => attachments.filter((a) => a.file_type?.includes('pdf') || a.file_name?.endsWith('.pdf')),
    [attachments],
  )

  /* ---- fetch course + lesson data ---- */
  useEffect(() => {
    if (authLoading) return
    if (!user?.id) {
      navigate('/login')
      return
    }
    const fetchData = async () => {
      if (!courseId || !lessonId) return
      try {
        setIsLoading(true)
        // Reset quiz/flashcard state to prevent stale values while loading
        setHasQuiz(false)
        setQuizPassed(false)
        setTopicFlashcardCount(0)
        setTopicSubjectId(null)

        // Check enrollment before allowing lesson access
        const { data: enrollment } = await supabase
          .from('student_classes')
          .select('id, class_id, enrollment_date, classes!inner(class_type, class_courses!inner(course_id))')
          .eq('user_id', user.id)

        const enrolledCourseIds = (enrollment || []).flatMap((sc: any) =>
          sc.classes?.class_courses?.map((cc: any) => cc.course_id) || []
        )

        if (!enrolledCourseIds.includes(courseId)) {
          toast({ title: 'Acesso negado', description: 'Você não está matriculado neste curso.', variant: 'destructive' })
          navigate(`/courses/${courseId}`)
          return
        }

        // Find student's class for this course — prefer paid/standard over trial
        const matchingEnrollments = (enrollment || []).filter((sc: any) =>
          sc.classes?.class_courses?.some((cc: any) => cc.course_id === courseId)
        )
        const matchingEnrollment = matchingEnrollments.sort((a: any, b: any) => {
          const aIsTrial = a.classes?.class_type === 'trial'
          const bIsTrial = b.classes?.class_type === 'trial'
          if (aIsTrial && !bIsTrial) return 1
          if (!aIsTrial && bIsTrial) return -1
          return 0
        })[0] || null
        const studentClassId = matchingEnrollment?.class_id || null
        const enrollmentDate = matchingEnrollment?.enrollment_date || null

        // Verificar se este curso é acessado via turma trial ou paga
        setIsTrialForThisCourse(
          matchingEnrollment ? matchingEnrollment.classes?.class_type === 'trial' : isTrialUserGlobal
        )

        // Load module & lesson rules for this class
        const blocked = new Set<string>()
        const blockedLessons = new Set<string>()
        const freeLessons = new Set<string>()

        if (studentClassId) {
          const [{ data: modRules }, { data: lesRules }] = await Promise.all([
            supabase.from('class_module_rules').select('module_id, rule_type, rule_value').eq('class_id', studentClassId),
            supabase.from('class_lesson_rules').select('lesson_id, rule_type, rule_value').eq('class_id', studentClassId),
          ])

          for (const r of (modRules || [])) {
            if (r.rule_type === 'blocked' || r.rule_type === 'hidden') {
              blocked.add(r.module_id)
            } else if (r.rule_type === 'scheduled_date' && r.rule_value) {
              if (new Date(r.rule_value) > new Date()) blocked.add(r.module_id)
            } else if (r.rule_type === 'days_after_enrollment' && r.rule_value && enrollmentDate) {
              const unlockDate = new Date(enrollmentDate)
              unlockDate.setDate(unlockDate.getDate() + parseInt(r.rule_value))
              if (unlockDate > new Date()) blocked.add(r.module_id)
            }
          }

          for (const r of (lesRules || [])) {
            if (r.rule_type === 'free') {
              freeLessons.add(r.lesson_id)
            } else if (r.rule_type === 'blocked' || r.rule_type === 'hidden') {
              blockedLessons.add(r.lesson_id)
            }
          }
        }

        setBlockedModuleIds(blocked)
        setBlockedLessonIds(blockedLessons)
        setFreeLessonIds(freeLessons)

        const course = await courseService.getCourseWithModulesAndProgress(courseId, user.id)
        if (!course) {
          toast({ title: 'Curso não encontrado', variant: 'destructive' })
          navigate('/courses')
          return
        }

        setCourseData(course as CourseData)

        const activeModuleId = (course.modules || []).find((m: ModuleData) =>
          m.lessons.some((l) => l.id === lessonId)
        )?.id
        if (activeModuleId) setSelectedModuleId(activeModuleId)

        let foundLesson: LessonData | null = null
        for (const mod of course.modules) {
          const lesson = (mod.lessons as LessonData[]).find((l) => l.id === lessonId)
          if (lesson) { foundLesson = lesson; break }
        }

        if (!foundLesson) {
          toast({ title: 'Aula não encontrada', variant: 'destructive' })
          navigate(`/courses/${courseId}`)
          return
        }

        // Check if this specific lesson is accessible (use local vars, not state)
        const lessonModuleId = (course.modules || []).find((m: ModuleData) =>
          m.lessons.some((l) => l.id === lessonId)
        )?.id

        if (lessonModuleId && studentClassId) {
          const isModuleBlocked = blocked.has(lessonModuleId)
          const isLessonFree = freeLessons.has(lessonId!)
          const isLessonBlocked = blockedLessons.has(lessonId!)
          const isPreview = foundLesson.is_preview

          if ((isModuleBlocked && !isLessonFree && !isPreview) || isLessonBlocked) {
            toast({ title: 'Aula bloqueada', description: 'Esta aula ainda não foi liberada para sua turma.', variant: 'destructive' })
            navigate(`/courses/${courseId}`)
            return
          }
        }

        setLessonData(foundLesson)

        // Fetch quiz & flashcard data for this lesson
        const hasLinkedQuiz = !!foundLesson.quiz_id
        setHasQuiz(hasLinkedQuiz)

        if (foundLesson.topic_id) {
          const [{ count: fCount }, { data: topicData }] = await Promise.all([
            supabase.from('flashcards').select('*', { count: 'exact', head: true }).eq('topic_id', foundLesson.topic_id),
            supabase.from('topics').select('subject_id').eq('id', foundLesson.topic_id).single(),
          ])
          setTopicFlashcardCount(fCount || 0)
          setTopicSubjectId(topicData?.subject_id || null)

          // Check if student passed the linked quiz
          if (foundLesson.quiz_required && foundLesson.quiz_id && user?.id) {
            const { data: attempts } = await supabase
              .from('quiz_attempts')
              .select('percentage')
              .eq('user_id', user.id)
              .eq('quiz_id', foundLesson.quiz_id)
            const minPct = foundLesson.quiz_min_percentage || 70
            const passed = (attempts || []).some(a => (a.percentage || 0) >= minPct)
            setQuizPassed(passed)
          } else {
            setQuizPassed(true)
          }
        } else {
          setTopicFlashcardCount(0)
          setTopicSubjectId(null)
          // If no topic linked, allow completion even if quiz_required (misconfigured lesson)
          setQuizPassed(!foundLesson.quiz_required || !foundLesson.quiz_id)
        }

        const { data: attData } = await supabase
          .from('lesson_attachments')
          .select('*')
          .eq('lesson_id', lessonId)

        setAttachments((attData as Attachment[]) || [])
        setPdfViewerUrl(null)

        // Fetch comments, ratings, and notes
        const [commentsData, ratingsData, noteData] = await Promise.all([
          lessonInteractionService.getComments(lessonId),
          lessonInteractionService.getRatingStats(lessonId, user.id),
          lessonInteractionService.getNote(lessonId, user.id),
        ])
        setComments(commentsData)
        setRatingStats(ratingsData)
        setNoteContent(noteData.content || noteData as any || '')
        setDrawingData(noteData.drawingData || null)
        setNoteLastSaved(noteData.content ? 'Salvo' : null)
      } catch (error) {
        logger.error('Error fetching lesson data:', error)
        toast({ title: 'Erro ao carregar aula', variant: 'destructive' })
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [courseId, lessonId, user?.id, authLoading, navigate, toast])

  /* ---- scroll to top when lesson changes ---- */
  useEffect(() => {
    if (!isLoading && mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [isLoading, lessonId])

  /* ---- Escape exits theater / closes mobile sidebar ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSidebarOpen) setIsSidebarOpen(false)
        else if (theaterMode) setTheaterMode(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [theaterMode, isSidebarOpen])

  /* ---- Resizable split ---- */
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !splitContainerRef.current) return
      const rect = splitContainerRef.current.getBoundingClientRect()
      setSplitRatio(Math.max(25, Math.min(75, ((ev.clientX - rect.left) / rect.width) * 100)))
    }
    const onUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  /* ---- mark complete ---- */
  const [isMarkingComplete, setIsMarkingComplete] = useState(false)
  const handleMarkComplete = useCallback(async () => {
    if (!user?.id || !lessonId || !lessonData || lessonData.completed || isMarkingComplete) return
    setIsMarkingComplete(true)
    try {
      const { error } = await supabase.from('video_progress').upsert({
        user_id: user.id, lesson_id: lessonId,
        progress_percentage: 100, is_completed: true,
        current_time_seconds: lessonData.duration_seconds || 0,
      })
      if (error) throw error

      // Award XP only if not already completed (check DB to prevent double XP)
      const { data: existing } = await supabase.from('scores')
        .select('id')
        .eq('user_id', user.id)
        .eq('activity_type', 'video_lesson')
        .eq('activity_id', lessonId)
        .limit(1)

      if (!existing || existing.length === 0) {
        await rankingService.addUserScore(user.id, 'video_lesson', 10, lessonId)
        rankingService.checkAndGrantAchievements(user.id).catch(() => {})
        setShowXpAnimation(true)
        setTimeout(() => setShowXpAnimation(false), 2000)
      }

      setLessonData({ ...lessonData, completed: true, progress: 100 })
      setCourseData((prev) => {
        if (!prev) return prev
        return {
          ...prev, modules: prev.modules.map((m) => ({
            ...m, lessons: m.lessons.map((l) => l.id === lessonId ? { ...l, completed: true } : l),
          }))
        }
      })
      toast({ title: 'Aula concluida!', description: 'Parabens! +10 XP. Continue seu progresso.' })
      if (nextLesson) setTimeout(() => navigate(`/courses/${courseId}/lessons/${nextLesson.id}`), 1500)
    } catch (error) {
      logger.error('Erro ao marcar aula como concluída:', error)
      toast({ title: 'Erro', description: 'Não foi possível marcar a aula como concluída.', variant: 'destructive' })
    } finally {
      setIsMarkingComplete(false)
    }
  }, [user?.id, lessonId, lessonData, toast, nextLesson, courseId, navigate, isMarkingComplete])

  /* ---- comment & rating handlers ---- */
  const handleSubmitComment = useCallback(async (parentId?: string) => {
    if (!user?.id || !lessonId) return
    const text = parentId ? replyText : commentText
    if (!text.trim()) return

    setSubmittingComment(true)
    try {
      const newComment = await lessonInteractionService.addComment(lessonId, user.id, text.trim(), parentId)
      if (newComment) {
        // Award XP for commenting (achievements checked on Achievements/Ranking pages)
        await rankingService.addUserScore(user.id, 'lesson_comment', 5, lessonId)
        // Refresh comments
        const updated = await lessonInteractionService.getComments(lessonId)
        setComments(updated)
        setCommentText('')
        setReplyText('')
        setReplyingTo(null)
        toast({ title: 'Comentario enviado! +5 XP' })
      }
    } catch (error) {
      logger.error('Erro ao enviar comentário:', error)
      toast({ title: 'Erro ao enviar comentário', variant: 'destructive' })
    } finally {
      setSubmittingComment(false)
    }
  }, [user?.id, lessonId, commentText, replyText, toast])

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!user?.id || !lessonId) return
    const ok = await lessonInteractionService.deleteComment(commentId, user.id)
    if (ok) {
      const updated = await lessonInteractionService.getComments(lessonId)
      setComments(updated)
      toast({ title: 'Comentario removido' })
    }
  }, [user?.id, lessonId, toast])

  const handleRate = useCallback(async (rating: number) => {
    if (!user?.id || !lessonId) return
    const ok = await lessonInteractionService.rateLesson(lessonId, user.id, rating)
    if (ok) {
      // Award XP for first rating only
      if (!ratingStats.userRating) {
        await rankingService.addUserScore(user.id, 'lesson_rating', 3, lessonId)
        rankingService.checkAndGrantAchievements(user.id).catch(() => {})
        toast({ title: `Avaliacao registrada! +3 XP` })
      } else {
        toast({ title: 'Avaliacao atualizada!' })
      }
      const updated = await lessonInteractionService.getRatingStats(lessonId, user.id)
      setRatingStats(updated)
    }
  }, [user?.id, lessonId, ratingStats.userRating, toast])

  /* ---- notes auto-save (debounced) ---- */
  const handleNoteChange = useCallback((value: string) => {
    setNoteContent(value)
    setNoteLastSaved('Salvando...')
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current)
    noteTimerRef.current = setTimeout(async () => {
      if (!user?.id || !lessonId) return
      const ok = await lessonInteractionService.saveNote(lessonId, user.id, value)
      setNoteLastSaved(ok ? 'Salvo' : 'Erro ao salvar')
    }, 1500)
  }, [user?.id, lessonId])

  // Drawing auto-save (debounced)
  const handleDrawingChange = useCallback((data: string) => {
    setDrawingData(data)
    setNoteLastSaved('Salvando...')
    if (drawingTimerRef.current) clearTimeout(drawingTimerRef.current)
    drawingTimerRef.current = setTimeout(async () => {
      if (!user?.id || !lessonId) return
      const ok = await lessonInteractionService.saveDrawing(lessonId, user.id, data)
      setNoteLastSaved(ok ? 'Salvo' : 'Erro ao salvar')
    }, 1500)
  }, [user?.id, lessonId])

  // Flush pending note/drawing saves when lesson changes or on unmount
  useEffect(() => {
    const prevLesson = prevLessonIdRef.current
    prevLessonIdRef.current = lessonId

    // If lesson changed, flush any pending debounced saves for the OLD lesson
    if (prevLesson && prevLesson !== lessonId && user?.id) {
      if (noteTimerRef.current) {
        clearTimeout(noteTimerRef.current)
        noteTimerRef.current = null
        lessonInteractionService.saveNote(prevLesson, user.id, noteContentRef.current)
      }
      if (drawingTimerRef.current) {
        clearTimeout(drawingTimerRef.current)
        drawingTimerRef.current = null
        if (drawingDataRef.current) {
          lessonInteractionService.saveDrawing(prevLesson, user.id, drawingDataRef.current)
        }
      }
    }

    return () => {
      // Flush any pending debounced saves on unmount to prevent data loss
      if (noteTimerRef.current) {
        clearTimeout(noteTimerRef.current)
        noteTimerRef.current = null
        if (user?.id && lessonId) {
          lessonInteractionService.saveNote(lessonId, user.id, noteContentRef.current)
        }
      }
      if (drawingTimerRef.current) {
        clearTimeout(drawingTimerRef.current)
        drawingTimerRef.current = null
        if (user?.id && lessonId && drawingDataRef.current) {
          lessonInteractionService.saveDrawing(lessonId, user.id, drawingDataRef.current)
        }
      }
    }
  }, [lessonId, user?.id])

  /* ---- auto-play toggle ---- */
  const toggleAutoPlay = useCallback(() => {
    setAutoPlayNext(prev => {
      const next = !prev
      localStorage.setItem('everest-autoplay', String(next))
      return next
    })
  }, [])

  /* ---- listen for video end (Panda Video postMessage) ---- */
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data?.event === 'onEnded' || data?.message === 'ended' || data?.type === 'ended') {
          if (autoPlayNext && nextLesson) {
            setAutoPlayCountdown(5)
          }
        }
      } catch { /* ignore non-JSON messages */ }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [autoPlayNext, nextLesson])

  /* ---- auto-play countdown timer ---- */
  useEffect(() => {
    if (autoPlayCountdown === null) return
    if (autoPlayCountdown <= 0 && nextLesson) {
      navigate(`/courses/${courseId}/lessons/${nextLesson.id}`)
      setAutoPlayCountdown(null)
      return
    }
    countdownRef.current = setInterval(() => {
      setAutoPlayCountdown(prev => prev !== null ? prev - 1 : null)
    }, 1000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [autoPlayCountdown, nextLesson, courseId, navigate])

  // Reset countdown on lesson change
  useEffect(() => {
    setAutoPlayCountdown(null)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [lessonId])

  /* ---- module helpers ---- */
  const sortedModules = useMemo(() => {
    if (!courseData) return []
    return [...courseData.modules].sort((a, b) => a.order_index - b.order_index)
  }, [courseData])

  const currentModule = useMemo(
    () => sortedModules.find((m) => m.id === selectedModuleId) || sortedModules[0] || null,
    [sortedModules, selectedModuleId],
  )
  const currentModuleIndex = useMemo(
    () => sortedModules.findIndex((m) => m.id === currentModule?.id),
    [sortedModules, currentModule],
  )

  /** Check if a lesson is accessible (not blocked by module or lesson rule) */
  const isLessonAccessible = useCallback((lessonId: string, moduleId: string) => {
    if (freeLessonIds.has(lessonId)) return true
    if (blockedLessonIds.has(lessonId)) return false
    if (blockedModuleIds.has(moduleId)) return false
    return true
  }, [freeLessonIds, blockedLessonIds, blockedModuleIds])

  const openPdfViewer = async (url: string, type: 'pdf' | 'office' = 'pdf') => {
    // Revoke previous blob URL to prevent memory leaks
    if (pdfViewerUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfViewerUrl)
    if (pdfViewerUrl === url) { setPdfViewerUrl(null); return }

    // Office files use Google Docs Viewer (Microsoft's viewer can't access Supabase Storage URLs)
    if (type === 'office') {
      setPdfViewerUrl(url); setSplitViewerType('office'); setSplitRatio(55)
      return
    }

    // For PDFs: try to proxy via fetch+blob to bypass X-Frame-Options
    // External URLs (e.g. MemberKit) block iframe embedding
    const isExternal = !url.includes('supabase.co')
    if (isExternal) {
      try {
        toast({ title: 'Carregando PDF...' })
        const res = await fetch(url)
        if (!res.ok) throw new Error('Fetch failed')
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        setPdfViewerUrl(blobUrl); setSplitViewerType('pdf'); setSplitRatio(55)
        return
      } catch {
        // Fallback: open in new tab if fetch fails (CORS)
        window.open(url, '_blank')
        return
      }
    }

    setPdfViewerUrl(url); setSplitViewerType('pdf'); setSplitRatio(55)
  }

  const videoEmbedUrl = useMemo(() => {
    if (!lessonData) return ''
    const { video_source_type, video_source_id } = lessonData
    if (video_source_type === 'panda_video' && video_source_id)
      return `https://player-vz-e9d62059-4a4.tv.pandavideo.com.br/embed/?v=${video_source_id}`
    if (video_source_type === 'youtube' && video_source_id)
      return `https://www.youtube.com/embed/${video_source_id}`
    if (video_source_type === 'vimeo' && video_source_id)
      return `https://player.vimeo.com/video/${video_source_id}`
    return ''
  }, [lessonData])

  /* ---------------------------------------------------------------- */
  /*  Loading                                                          */
  /* ---------------------------------------------------------------- */

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="h-12 border-b border-border flex items-center px-4 gap-3">
          <div className="h-6 w-6 rounded bg-muted animate-pulse" />
          <div className="h-3 w-40 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex-1 p-0">
          <div className="w-full bg-muted/50 animate-pulse" style={{ paddingBottom: '56.25%' }} />
          <div className="p-6 space-y-3">
            <div className="h-5 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-4 w-1/3 rounded bg-muted/70 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!lessonData || !courseData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 bg-background">
        <h2 className="text-xl font-semibold text-foreground">Aula não encontrada</h2>
        <Button variant="outline" onClick={() => navigate(`/courses/${courseId}`)}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Voltar ao Curso
        </Button>
      </div>
    )
  }

  const modCompleted = currentModule?.lessons.filter((l) => l.completed).length || 0
  const modTotal = currentModule?.lessons.length || 0

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <>
      {/* Theater overlay */}
      {theaterMode && (
        <div
          className="fixed inset-0 z-[60] bg-black/90"
          onClick={() => setTheaterMode(false)}
          style={{ animation: 'lp-fade-in 0.3s ease-out' }}
        />
      )}

      <div className={cn("flex flex-col min-h-screen", theaterMode ? "bg-black" : "bg-background")}>

        {/* ============================================================ */}
        {/* Top bar                                                       */}
        {/* ============================================================ */}
        <header className={cn(
          "sticky top-0 z-[70] h-16 flex items-center gap-4 px-6 border-b transition-colors duration-300",
          theaterMode ? "bg-black border-transparent" : "bg-card border-border"
        )}>
          {theaterMode ? (
            /* Theater mode: only show "Acender Luz" button */
            <>
              <div className="flex-1" />
              <button
                onClick={() => setTheaterMode(false)}
                className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-500 transition-all hover:bg-emerald-500/30"
                title="Acender Luz"
              >
                <Sun className="h-5 w-5" />
              </button>
            </>
          ) : (
            /* Normal mode: full header */
            <>
              <button
                onClick={() => navigate(`/courses/${courseId}`)}
                className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-all group"
              >
                <ArrowLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
              </button>

              <div className="h-5 w-px bg-border mx-1" />

              <span className="text-[13px] text-muted-foreground truncate flex-1 font-medium">
                {courseData.name}
              </span>

              {/* Progress bar */}
              <div className="hidden sm:flex flex-col justify-center min-w-[200px] gap-1 ml-4 mr-2">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                  <span>Módulo Atual</span>
                  <span className="tabular-nums">{modCompleted}/{modTotal} ({modTotal > 0 ? Math.round((modCompleted / modTotal) * 100) : 0}%)</span>
                </div>
                <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out shadow-sm"
                    style={{ width: `${modTotal > 0 ? (modCompleted / modTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Tour guide */}
              <LessonTourButton />

              {/* Apagar Luz */}
              <button
                data-tour="theater-mode"
                onClick={() => setTheaterMode(true)}
                className="p-2.5 rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"
                title="Apagar Luz"
              >
                <Moon className="h-5 w-5" />
              </button>

              {/* Sidebar toggle */}
              <button
                data-tour="sidebar-toggle"
                onClick={() => setDesktopSidebarVisible(!desktopSidebarVisible)}
                className="hidden lg:block p-2.5 rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"
              >
                {desktopSidebarVisible ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
              </button>

              <button
                className="lg:hidden p-2.5 rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"
                onClick={() => { setDrawerOpen(false); setIsSidebarOpen(true) }}
              >
                <Menu className="h-5 w-5" />
              </button>
            </>
          )}
        </header>

        {/* ── Trial upgrade banner ── */}
        {isTrialUser && !theaterMode && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border-b border-amber-300 dark:border-amber-800">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-sm text-amber-700 dark:text-amber-400 truncate">
                Você está na degustação — adquira o acesso completo para desbloquear todo o conteúdo
              </span>
            </div>
            {courseData?.sales_url ? (
              <a
                href={courseData.sales_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-all shrink-0"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Comprar
              </a>
            ) : (
              <button
                onClick={() => window.open(getSupportWhatsAppUrl(), '_blank')}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border border-amber-500/50 text-amber-600 hover:bg-amber-500/10 transition-all shrink-0"
              >
                Falar com suporte
              </button>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* Main layout                                                    */}
        {/* ============================================================ */}
        <div className="flex flex-1 overflow-hidden">
          <div ref={mainContentRef} className="flex-1 overflow-y-auto">
            <div className={cn(
              "mx-auto transition-all duration-300",
              theaterMode ? "max-w-none" : desktopSidebarVisible ? "max-w-none" : "max-w-[1400px]"
            )}>

              {/* ======================================================== */}
              {/* Video + PDF                                                */}
              {/* ======================================================== */}
              <div
                ref={splitContainerRef}
                className={cn("relative", theaterMode ? "z-[65]" : "")}
              >
                {pdfViewerUrl ? (
                  <>
                    {/* Desktop split */}
                    <div className="hidden md:flex w-full px-4 pt-4" style={{ height: '70vh' }}>
                      <div style={{ width: `${splitRatio}%` }} className="relative shrink-0 bg-black rounded-xl overflow-hidden border border-border shadow-sm">
                        {videoEmbedUrl ? (
                          <iframe src={videoEmbedUrl} title={lessonData.title}
                            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                            allowFullScreen className="absolute inset-0 w-full h-full border-0" />
                        ) : <VideoPlaceholder />}
                      </div>
                      <div
                        onMouseDown={handleDragStart}
                        className="w-1.5 bg-muted/30 hover:bg-primary/60 cursor-col-resize flex items-center justify-center transition-colors group shrink-0"
                      >
                        <div className="w-0.5 h-8 rounded-full bg-muted-foreground/20 group-hover:bg-primary/80 transition-colors" />
                      </div>
                      <div className="flex-1 flex flex-col min-w-0 bg-card">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className={cn("h-3.5 w-3.5 shrink-0", splitViewerType === 'office' ? "text-orange-500" : "text-primary")} />
                            <span className="text-xs text-muted-foreground truncate">
                              {attachments.find(p => p.file_url === pdfViewerUrl)?.file_name || (splitViewerType === 'office' ? 'Documento' : 'PDF')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <a href={pdfViewerUrl!} download target="_blank" rel="noopener noreferrer"
                              className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors">
                              <Download className="h-4 w-4" />
                            </a>
                            <button onClick={() => setPdfViewerUrl(null)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                              <X className="h-3.5 w-3.5" />
                              Fechar
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 relative">
                          <iframe
                            src={splitViewerType === 'office'
                              ? `https://docs.google.com/gview?url=${encodeURIComponent(pdfViewerUrl!)}&embedded=true`
                              : pdfViewerUrl!}
                            title={splitViewerType === 'office' ? 'Documento' : 'PDF'}
                            className="absolute inset-0 w-full h-full border-0"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Mobile stacked — no duplicate video iframe to prevent double audio */}
                    <div className="md:hidden p-3 pb-0">
                      <div className="border-t border-border">
                        <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className={cn("h-3.5 w-3.5", splitViewerType === 'office' ? "text-orange-500" : "text-primary")} />
                            <span className="text-xs text-muted-foreground truncate">
                              {attachments.find(p => p.file_url === pdfViewerUrl)?.file_name || (splitViewerType === 'office' ? 'Documento' : 'PDF')}
                            </span>
                          </div>
                          <button onClick={() => setPdfViewerUrl(null)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors min-h-[44px]">
                            <X className="h-3.5 w-3.5" />
                            Fechar
                          </button>
                        </div>
                        <div style={{ height: '50vh' }}>
                          <iframe
                            src={splitViewerType === 'office'
                              ? `https://docs.google.com/gview?url=${encodeURIComponent(pdfViewerUrl!)}&embedded=true`
                              : pdfViewerUrl!}
                            title={splitViewerType === 'office' ? 'Documento' : 'PDF'}
                            className="w-full h-full border-0"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Normal video */
                  <div className={cn("relative w-full transition-all duration-300", theaterMode ? "bg-black" : "px-4 md:px-6 lg:px-8 py-4 sm:py-6 bg-background")}>
                    <div data-tour="video-player" className={cn("relative bg-black transition-all duration-300", theaterMode ? "w-full" : "rounded-2xl overflow-hidden border border-border shadow-sm")}>
                      {videoEmbedUrl ? (
                        <div style={{ paddingBottom: theaterMode ? '52%' : '56.25%' }} className="relative transition-all duration-300">
                          <iframe src={videoEmbedUrl} title={lessonData.title}
                            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                            allowFullScreen className="absolute inset-0 w-full h-full border-0" />
                        </div>
                      ) : (
                        <div style={{ paddingBottom: '56.25%' }} className="relative">
                          <VideoPlaceholder />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* Below video — info + actions                               */}
              {/* ======================================================== */}
              <div className={cn(
                "px-4 sm:px-6 lg:px-8 py-5 bg-card border-b border-border",
                theaterMode ? "hidden" : ""
              )}>
                {/* Title row */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug tracking-tight">
                      {cleanTitle(lessonData.title)}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {currentModule && (
                        <span className="text-xs text-muted-foreground">
                          Modulo {currentModuleIndex + 1} · {currentModule.name}
                        </span>
                      )}
                      {lessonData.duration_seconds != null && lessonData.duration_seconds > 0 && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDuration(lessonData.duration_seconds)}
                        </span>
                      )}
                      {lessonData.completed && (
                        <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
                          <CheckCircle className="h-3 w-3" />
                          Concluida
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 shrink-0 relative">
                    {/* Auto-play toggle */}
                    <button
                      data-tour="auto-play"
                      onClick={toggleAutoPlay}
                      className={cn(
                        "flex items-center gap-1.5 text-xs transition-colors",
                        autoPlayNext ? "text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className={cn(
                        "relative w-7 h-[16px] rounded-full transition-colors",
                        autoPlayNext ? "bg-primary" : "bg-muted"
                      )}>
                        <div className={cn(
                          "absolute top-[2px] w-[12px] h-[12px] rounded-full bg-white shadow-sm transition-all",
                          autoPlayNext ? "left-[13px]" : "left-[2px]"
                        )} />
                      </div>
                      Auto-play
                    </button>

                    {/* Mark complete */}
                    {lessonData.quiz_required && !quizPassed && !lessonData.completed ? (
                      <button
                        onClick={() => {
                          if (lessonData.quiz_id) {
                            navigate(`/quiz/${lessonData.quiz_id}?returnTo=${encodeURIComponent(`/courses/${courseId}/lessons/${lessonId}`)}`)
                          } else {
                            toast({ title: 'Quiz obrigatório', description: 'Esta aula exige aprovação no quiz para ser concluída, mas nenhum quiz foi vinculado ainda.', variant: 'destructive' })
                          }
                        }}
                        className="flex items-center gap-2.5 h-10 px-5 rounded-xl text-sm font-semibold transition-all min-h-[44px] bg-amber-100 dark:bg-amber-950/50 text-amber-600 border border-amber-300 dark:border-amber-800 hover:bg-amber-500/20"
                      >
                        <HelpCircle className="h-4 w-4" />
                        Fazer Quiz ({lessonData.quiz_min_percentage || 70}% para concluir)
                      </button>
                    ) : (
                      <button data-tour="complete-lesson" onClick={handleMarkComplete} disabled={lessonData.completed || isMarkingComplete}
                        className={cn(
                          "flex items-center gap-2.5 h-10 px-5 rounded-xl text-sm font-semibold transition-all min-h-[44px]",
                          lessonData.completed
                            ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-500 cursor-default"
                            : "bg-primary hover:bg-emerald-500 text-primary-foreground hover:text-white shadow-sm hover:shadow-md active:scale-[0.97]"
                        )}
                      >
                        <CheckCircle className="h-4 w-4" />
                        {lessonData.completed ? 'Concluída' : 'Concluir aula'}
                      </button>
                    )}

                    {/* XP animation */}
                    {showXpAnimation && (
                      <span
                        className="absolute -top-6 right-0 text-sm font-bold text-emerald-500 animate-bounce"
                        style={{ animation: 'lp-xp-float 1.5s ease-out forwards' }}
                      >
                        +10 XP
                      </span>
                    )}
                  </div>
                </div>

                {/* Navigation */}
                <div data-tour="lesson-nav" className="flex flex-col sm:flex-row gap-3 mt-4 pt-5 border-t border-border">
                  {prevLesson && (
                    <Link to={`/courses/${courseId}/lessons/${prevLesson.id}`}
                      className="flex-1 flex items-center gap-3 p-3.5 sm:p-4 rounded-xl border border-border bg-card hover:bg-emerald-500/5 hover:border-emerald-500/30 transition-all duration-200 group">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 group-hover:text-emerald-500 transition-colors">
                        <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Aula Anterior</span>
                        <p className="text-sm font-semibold text-foreground truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{cleanTitle(prevLesson.title)}</p>
                      </div>
                    </Link>
                  )}
                  {nextLesson && (
                    <Link to={`/courses/${courseId}/lessons/${nextLesson.id}`}
                      className="flex-1 flex items-center gap-3 p-3.5 sm:p-4 rounded-xl border border-border bg-card hover:bg-emerald-500/5 hover:border-emerald-500/30 transition-all duration-200 group text-right">
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Próxima Aula</span>
                        <p className="text-sm font-semibold text-foreground truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{cleanTitle(nextLesson.title)}</p>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 group-hover:bg-emerald-600 transition-colors shadow-sm">
                        <ChevronRight className="h-5 w-5" />
                      </div>
                    </Link>
                  )}
                </div>
              </div>

              {/* ======================================================== */}
              {/* Action buttons — open drawer for content                    */}
              {/* ======================================================== */}
              <div className={cn("px-4 sm:px-6 lg:px-8 py-4 bg-card border-t border-border", theaterMode ? "hidden" : "")}>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    data-tour="comments-btn"
                    onClick={() => { setActiveTab('comments'); setDrawerOpen(true) }}
                    className="flex items-center gap-2 h-10 sm:h-9 px-4 rounded-lg text-xs font-medium transition-all border border-border hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-primary"
                  >
                    <MessageSquare className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    Comentários
                    {comments.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted min-w-[18px] text-center">
                        {comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0)}
                      </span>
                    )}
                  </button>
                  {attachments.length > 0 && (
                    <button
                      data-tour="attachments-btn"
                      onClick={() => { setActiveTab('resources'); setDrawerOpen(true) }}
                      className="flex items-center gap-2 h-10 sm:h-9 px-4 rounded-lg text-xs font-medium transition-all border border-border hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-primary"
                    >
                      <Paperclip className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                      Arquivos
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted min-w-[18px] text-center">{attachments.length}</span>
                    </button>
                  )}
                  <button
                    data-tour="notebook-btn"
                    onClick={() => setNotebookOpen(prev => !prev)}
                    className={cn(
                      "flex items-center gap-2 h-10 sm:h-9 px-4 rounded-lg text-xs font-medium transition-all border",
                      notebookOpen
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-primary"
                    )}
                  >
                    <BookOpen className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    Caderno
                  </button>
                  {lessonData?.quiz_id && hasQuiz && (
                    <button
                      onClick={() => navigate(`/quiz/${lessonData.quiz_id}?returnTo=${encodeURIComponent(`/courses/${courseId}/lessons/${lessonId}`)}`)}
                      className="flex items-center gap-2 h-10 sm:h-9 px-4 rounded-lg text-xs font-medium transition-all border border-border hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-primary"
                    >
                      <HelpCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                      Quiz
                    </button>
                  )}
                  {lessonData?.topic_id && topicFlashcardCount > 0 && topicSubjectId && (
                    <button
                      onClick={() => navigate(`/flashcards/${topicSubjectId}/${lessonData.topic_id}/study?returnTo=${encodeURIComponent(`/courses/${courseId}/lessons/${lessonId}`)}`)}
                      className="flex items-center gap-2 h-10 sm:h-9 px-4 rounded-lg text-xs font-medium transition-all border border-border hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-primary"
                    >
                      <Brain className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                      Flashcards
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted min-w-[18px] text-center">{topicFlashcardCount}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ======================================================== */}
              {/* Caderno Digital (below action buttons)                     */}
              {/* ======================================================== */}
              {notebookOpen && (
                <div className={cn(
                  "bg-card transition-all duration-300",
                  notebookExpanded ? "h-[80vh]" : "h-[50vh]",
                  "px-4 sm:px-6 lg:px-8 py-3"
                )}>
                  <StudentNotebook
                    noteContent={noteContent}
                    onNoteChange={handleNoteChange}
                    drawingData={drawingData}
                    onDrawingChange={handleDrawingChange}
                    lessonTitle={lessonData?.title || 'Aula'}
                    saveStatus={noteLastSaved}
                    expanded={notebookExpanded}
                    onToggleExpand={() => setNotebookExpanded(prev => !prev)}
                    className="h-full"
                  />
                </div>
              )}

              {/* ======================================================== */}
              {/* Drawer / Sheet for Comments, Resources, Notes             */}
              {/* ======================================================== */}
              <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetContent side="bottom" className="h-[75vh] flex flex-col p-0 rounded-t-2xl border-t-2 border-primary/20 !bg-white dark:!bg-card">
                  {/* Drawer handle */}
                  <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-border" />
                  </div>
                  {/* Header with tabs */}
                  <SheetHeader className="px-6 pb-3 shrink-0">
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-muted/40 rounded-xl p-1 border border-border/30">
                      <button
                        onClick={() => setActiveTab('comments')}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all rounded-lg flex-1 justify-center",
                          activeTab === 'comments'
                            ? "bg-white dark:bg-background text-primary shadow border border-border/40"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/50"
                        )}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Comentários
                        {comments.length > 0 && (
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                            activeTab === 'comments' ? "bg-primary text-white" : "bg-gray-200 dark:bg-muted text-muted-foreground"
                          )}>
                            {comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0)}
                          </span>
                        )}
                      </button>
                      {attachments.length > 0 && (
                        <button
                          onClick={() => setActiveTab('resources')}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all rounded-lg flex-1 justify-center",
                            activeTab === 'resources'
                              ? "bg-white dark:bg-background text-primary shadow border border-border/40"
                              : "text-muted-foreground hover:text-foreground hover:bg-white/50"
                          )}
                        >
                          <Paperclip className="h-4 w-4" />
                          Arquivos
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                            activeTab === 'resources' ? "bg-primary text-white" : "bg-gray-200 dark:bg-muted text-muted-foreground"
                          )}>{attachments.length}</span>
                        </button>
                      )}
                      {attachments.some((a) => a.file_type?.includes('pdf') || a.file_name?.toLowerCase().endsWith('.pdf')) && (
                        <button
                          onClick={() => setActiveTab('ai_chat')}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all rounded-lg flex-1 justify-center",
                            activeTab === 'ai_chat'
                              ? "bg-white dark:bg-background text-primary shadow border border-border/40"
                              : "text-muted-foreground hover:text-foreground hover:bg-white/50"
                          )}
                        >
                          <Sparkles className="h-4 w-4" />
                          IA
                        </button>
                      )}
                    </div>
                    <SheetTitle className="sr-only">
                      {activeTab === 'comments' ? 'Comentários' : activeTab === 'resources' ? 'Arquivos' : 'IA'}
                    </SheetTitle>
                  </SheetHeader>

                  <div className="flex-1 overflow-y-auto px-6 py-5 bg-[#f5f5f7] dark:bg-background">
                    {/* Comments */}
                    {activeTab === 'comments' && (
                      <LessonComments
                        comments={comments}
                        commentText={commentText}
                        onCommentTextChange={setCommentText}
                        replyingTo={replyingTo}
                        onReplyingToChange={(id) => { setReplyingTo(id); if (id !== null) setReplyText('') }}
                        replyText={replyText}
                        onReplyTextChange={setReplyText}
                        submittingComment={submittingComment}
                        onSubmitComment={handleSubmitComment}
                        onDeleteComment={handleDeleteComment}
                        userEmail={user?.email}
                        userId={user?.id}
                      />
                    )}

                    {/* AI Chat */}
                    {activeTab === 'ai_chat' && (
                      <LessonAIChat
                        lessonTitle={lessonData?.title ?? ''}
                        moduleName={currentModule?.name ?? ''}
                        attachments={attachments.map((a) => ({
                          name: a.file_name,
                          url: a.file_url,
                          type: a.file_type ?? undefined,
                        }))}
                      />
                    )}

                    {/* Resources */}
                    {activeTab === 'resources' && attachments.length > 0 && (
                      <LessonResources
                        attachments={attachments}
                        onOpenViewer={openPdfViewer}
                        onCloseDrawer={() => setDrawerOpen(false)}
                      />
                    )}

                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* ============================================================ */}
          {/* Desktop Sidebar                                               */}
          {/* ============================================================ */}
          <aside className={cn(
            "hidden lg:block shrink-0 overflow-hidden transition-all duration-300 border-l",
            "bg-card border-border",
            theaterMode ? "w-0 min-w-0 border-l-0" :
              desktopSidebarVisible ? "w-[320px] min-w-[320px]" : "w-0 min-w-0 border-l-0"
          )}>
            {desktopSidebarVisible && (
              <LessonSidebar
                courseId={courseId!}
                lessonId={lessonId!}
                sortedModules={sortedModules}
                currentModule={currentModule}
                currentModuleIndex={currentModuleIndex}
                selectedModuleId={selectedModuleId}
                onSelectModule={setSelectedModuleId}
                blockedModuleIds={blockedModuleIds}
                isLessonAccessible={isLessonAccessible}
                ratingStats={ratingStats}
                hoverRating={hoverRating}
                onHoverRating={setHoverRating}
                onRate={handleRate}
                isMobile={false}
                cleanTitle={cleanTitle}
                formatDuration={formatDuration}
              />
            )}
          </aside>

        </div>
      </div>

      {/* ============================================================ */}
      {/* Mobile sidebar (outside overflow-hidden container)            */}
      {/* ============================================================ */}
      {isSidebarOpen && (
        <LessonSidebar
          courseId={courseId!}
          lessonId={lessonId!}
          sortedModules={sortedModules}
          currentModule={currentModule}
          currentModuleIndex={currentModuleIndex}
          selectedModuleId={selectedModuleId}
          onSelectModule={setSelectedModuleId}
          blockedModuleIds={blockedModuleIds}
          isLessonAccessible={isLessonAccessible}
          ratingStats={ratingStats}
          hoverRating={hoverRating}
          onHoverRating={setHoverRating}
          onRate={handleRate}
          isMobile={true}
          onCloseMobile={() => setIsSidebarOpen(false)}
          cleanTitle={cleanTitle}
          formatDuration={formatDuration}
        />
      )}

      {/* ============================================================ */}
      {/* Auto-play countdown overlay                                   */}
      {/* ============================================================ */}
      {autoPlayCountdown !== null && nextLesson && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-3 bg-card border border-border rounded-xl px-5 py-3 shadow-lg" style={{ animation: 'lp-fade-in 0.3s ease-out' }}>
          <SkipForward className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm text-foreground">
            Próxima aula em <strong className="text-primary tabular-nums">{autoPlayCountdown}s</strong>
          </span>
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{cleanTitle(nextLesson.title)}</span>
          <button
            onClick={() => { setAutoPlayCountdown(null); if (countdownRef.current) clearInterval(countdownRef.current) }}
            className="ml-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={() => { setAutoPlayCountdown(null); navigate(`/courses/${courseId}/lessons/${nextLesson.id}`) }}
            className="text-xs font-semibold text-white bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-lg transition-colors"
          >
            Ir agora
          </button>
        </div>
      )}

      <style>{`
        @keyframes lp-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lp-slide-in { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes lp-xp-float {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-24px); }
        }
      `}</style>
    </>
  )
}

/* Small presentational sub-component */
function VideoPlaceholder() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
        <Play className="h-6 w-6 text-muted-foreground ml-0.5" />
      </div>
      <p className="text-xs text-muted-foreground">Vídeo não disponível</p>
    </div>
  )
}
