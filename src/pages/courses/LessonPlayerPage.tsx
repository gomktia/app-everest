import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import DOMPurify from 'dompurify'
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
import {
  ArrowLeft,
  CheckCircle,
  Play,
  ChevronDown,
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
  Eye,
  ListVideo,
  MessageSquare,
  Star,
  Send,
  Trash2,
  Reply,
  Search,
  BookOpen,
  SkipForward,
  ShoppingCart,
  Sparkles,
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
  const { isTrialUser } = useTrialLimits()

  const [courseData, setCourseData] = useState<CourseData | null>(null)
  const [lessonData, setLessonData] = useState<LessonData | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [showModuleSelector, setShowModuleSelector] = useState(false)
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
  const [activeTab, setActiveTab] = useState<'comments' | 'resources'>('comments')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Notes
  const [noteContent, setNoteContent] = useState('')
  const [noteLastSaved, setNoteLastSaved] = useState<string | null>(null)
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Notebook (drawing + split view)
  const [drawingData, setDrawingData] = useState<string | null>(null)
  const [notebookOpen, setNotebookOpen] = useState(false)
  const [notebookExpanded, setNotebookExpanded] = useState(false)
  const drawingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-play next lesson
  const [autoPlayNext, setAutoPlayNext] = useState(() => {
    return localStorage.getItem('everest-autoplay') !== 'false'
  })

  // Auto-play countdown
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Search in sidebar
  const [lessonSearch, setLessonSearch] = useState('')

  const currentLessonRef = useRef<HTMLAnchorElement>(null)
  const mainContentRef = useRef<HTMLDivElement>(null)

  /* ---- flat lesson list for prev / next ---- */
  const flatLessons = useMemo(() => {
    if (!courseData) return []
    return courseData.modules
      .sort((a, b) => a.order_index - b.order_index)
      .flatMap((m) =>
        [...m.lessons].sort((a, b) => a.order_index - b.order_index),
      )
  }, [courseData])

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

        // Check enrollment before allowing lesson access
        const { data: enrollment } = await supabase
          .from('student_classes')
          .select('id, classes!inner(class_courses!inner(course_id))')
          .eq('user_id', user.id)

        const enrolledCourseIds = (enrollment || []).flatMap((sc: any) =>
          sc.classes?.class_courses?.map((cc: any) => cc.course_id) || []
        )

        if (!enrolledCourseIds.includes(courseId)) {
          toast({ title: 'Acesso negado', description: 'Você não está matriculado neste curso.', variant: 'destructive' })
          navigate(`/courses/${courseId}`)
          return
        }

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

        setLessonData(foundLesson)

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

  /* ---- auto-scroll sidebar to current lesson ---- */
  useEffect(() => {
    if (!isLoading && currentLessonRef.current) {
      currentLessonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
  const handleMarkComplete = useCallback(async () => {
    if (!user?.id || !lessonId || !lessonData) return
    try {
      const { error } = await supabase.from('video_progress').upsert({
        user_id: user.id, lesson_id: lessonId,
        progress_percentage: 100, is_completed: true,
        current_time_seconds: lessonData.duration_seconds || 0,
      })
      if (error) throw error

      // Award XP and check achievements
      await rankingService.addUserScore(user.id, 'video_lesson', 10, lessonId)
      rankingService.checkAndGrantAchievements(user.id).catch(() => {})
      setShowXpAnimation(true)
      setTimeout(() => setShowXpAnimation(false), 2000)

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
    }
  }, [user?.id, lessonId, lessonData, toast, nextLesson, courseId, navigate])

  /* ---- comment & rating handlers ---- */
  const handleSubmitComment = useCallback(async (parentId?: string) => {
    if (!user?.id || !lessonId) return
    const text = parentId ? replyText : commentText
    if (!text.trim()) return

    setSubmittingComment(true)
    try {
      const newComment = await lessonInteractionService.addComment(lessonId, user.id, text.trim(), parentId)
      if (newComment) {
        // Award XP for commenting and check achievements
        await rankingService.addUserScore(user.id, 'lesson_comment', 5, lessonId)
        rankingService.checkAndGrantAchievements(user.id).catch(() => {})
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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current)
      if (drawingTimerRef.current) clearTimeout(drawingTimerRef.current)
    }
  }, [])

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
  const currentModuleLessons = useMemo(() => {
    if (!currentModule) return []
    return [...currentModule.lessons].sort((a, b) => a.order_index - b.order_index)
  }, [currentModule])
  const currentModuleIndex = useMemo(
    () => sortedModules.findIndex((m) => m.id === currentModule?.id),
    [sortedModules, currentModule],
  )

  /* ---- filtered lessons for search ---- */
  const filteredLessons = useMemo(() => {
    if (!lessonSearch.trim()) return currentModuleLessons
    const q = lessonSearch.toLowerCase()
    return currentModuleLessons.filter(l => l.title.toLowerCase().includes(q))
  }, [currentModuleLessons, lessonSearch])

  const openPdfViewer = async (url: string, type: 'pdf' | 'office' = 'pdf') => {
    if (pdfViewerUrl === url) { setPdfViewerUrl(null); return }

    // Office files use Microsoft's viewer (always works via embed)
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
  /*  Sidebar content (shared between desktop and mobile)              */
  /* ---------------------------------------------------------------- */

  const renderModuleSelector = (isMobile: boolean) => (
    <div className="shrink-0 relative">
      <button onClick={() => setShowModuleSelector((v) => !v)}
        className={cn(
          "w-full px-3 flex items-center gap-2 transition-colors border-b border-border",
          "py-1.5",
          showModuleSelector ? "bg-muted/30" : "hover:bg-muted/20"
        )}>
        <div className={cn(
          "rounded-md flex items-center justify-center shrink-0 font-bold w-6 h-6 text-[10px]",
          modCompleted === modTotal && modTotal > 0
            ? "bg-emerald-500/10 text-emerald-600"
            : "bg-primary/10 text-primary"
        )}>
          {modCompleted === modTotal && modTotal > 0 ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <span>{currentModuleIndex + 1}</span>
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-xs font-semibold text-foreground truncate">
            {currentModule?.name}
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">{modCompleted}/{modTotal} concluídas</span>
        </div>
        <ChevronDown className={cn(
          "text-muted-foreground shrink-0 transition-transform duration-200 h-3 w-3",
          showModuleSelector ? "rotate-180" : ""
        )} />
      </button>
      {showModuleSelector && (
        <div className="absolute left-0 right-0 top-full z-20 bg-card border-b border-border shadow-md max-h-[400px] overflow-y-auto">
          <div className="p-2 space-y-0.5">
            {sortedModules.map((mod, idx) => {
              const mc = mod.lessons.filter((l) => l.completed).length
              const mt = mod.lessons.length
              const modProgress = mt > 0 ? Math.round((mc / mt) * 100) : 0
              const isSel = mod.id === currentModule?.id
              return (
                <button key={mod.id}
                  onClick={() => { setSelectedModuleId(mod.id); setShowModuleSelector(false) }}
                  className={cn(
                    "w-full px-3 py-3 flex items-center gap-3 text-left rounded-lg transition-all group/mod",
                    isSel ? "bg-primary/5 border border-primary/15" : "border border-transparent hover:bg-muted/40"
                  )}>
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold transition-all",
                    modProgress === 100
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : isSel
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-muted text-muted-foreground group-hover/mod:bg-primary/10 group-hover/mod:text-primary group-hover/mod:border-primary/20 border border-transparent"
                  )}>
                    {modProgress === 100 ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={cn(
                      "text-[13px] truncate block tracking-tight transition-colors",
                      isSel ? "text-foreground font-semibold" : "text-foreground/80 group-hover/mod:text-foreground font-medium"
                    )}>{mod.name}</span>
                    <div className="flex items-center gap-2.5 mt-1.5">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[140px]">
                        <div className={cn(
                          "h-full rounded-full transition-all duration-500",
                          modProgress === 100 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : isSel ? "bg-gradient-to-r from-primary to-primary/70" : "bg-muted-foreground/30 group-hover/mod:bg-primary"
                        )} style={{ width: `${modProgress}%` }} />
                      </div>
                      <span className={cn(
                        "text-[10px] font-medium tabular-nums shrink-0",
                        modProgress === 100 ? "text-emerald-500" : "text-muted-foreground"
                      )}>{modProgress}%</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  const renderLessonList = (isMobile: boolean) => (
    <>
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Search */}
        <div className="px-3 py-2 shrink-0 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <input
              type="text"
              value={lessonSearch}
              onChange={(e) => setLessonSearch(e.target.value)}
              placeholder="Buscar aula..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-muted/60 text-foreground placeholder:text-muted-foreground/50 transition-all"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredLessons.map((lesson, idx) => {
            const isCurrent = lesson.id === lessonId
            const isLast = idx === filteredLessons.length - 1
            const prevCompleted = idx > 0 && filteredLessons[idx - 1]?.completed
            return (
              <Link key={lesson.id}
                ref={isCurrent ? currentLessonRef : undefined}
                to={`/courses/${courseId}/lessons/${lesson.id}`}
                onClick={isMobile ? () => setIsSidebarOpen(false) : undefined}
                className={cn(
                  "group/lesson relative flex items-start gap-3 pl-4 pr-4 py-0 transition-all",
                  isCurrent
                    ? "bg-primary/10"
                    : "hover:bg-muted/40"
                )}>
                {/* Timeline node + lines */}
                <div className="relative shrink-0 w-6 flex flex-col items-center self-stretch">
                  {/* Line above */}
                  {idx > 0 ? (
                    <div className={cn(
                      "w-0.5 h-3",
                      prevCompleted && lesson.completed ? "bg-emerald-500"
                        : prevCompleted || (idx > 0 && filteredLessons[idx - 1]?.completed) ? "bg-emerald-500/30"
                        : "bg-border"
                    )} />
                  ) : (
                    <div className="h-3" />
                  )}
                  {/* Node */}
                  <div className={cn(
                    "relative z-10 flex items-center justify-center rounded-full shrink-0 transition-all duration-200",
                    isMobile ? "w-5 h-5" : "w-7 h-7",
                    lesson.completed
                      ? "bg-emerald-500 text-white border-2 border-emerald-500"
                      : isCurrent
                        ? "bg-primary text-white border-2 border-primary"
                        : "border-2 border-muted-foreground/20 bg-card group-hover/lesson:border-primary/40"
                  )}>
                    {lesson.completed ? (
                      <CheckCircle className={cn(isMobile ? "h-3 w-3" : "h-3.5 w-3.5")} />
                    ) : isCurrent ? (
                      <Play className={cn(isMobile ? "h-2.5 w-2.5" : "h-3 w-3", "ml-px")} />
                    ) : (
                      <span className="text-[9px] font-bold text-muted-foreground tabular-nums">{idx + 1}</span>
                    )}
                  </div>
                  {/* Line below */}
                  {!isLast ? (
                    <div className={cn(
                      "w-0.5 flex-1 min-h-[12px]",
                      lesson.completed ? "bg-emerald-500" : "bg-border"
                    )} />
                  ) : (
                    <div className="h-3" />
                  )}
                </div>
                <div className="flex-1 min-w-0 py-2">
                  <div className={cn(
                    "truncate leading-tight",
                    isMobile ? "text-xs" : "text-[13px]",
                    isCurrent ? "text-primary font-semibold" : lesson.completed ? "text-foreground/60" : "text-foreground/80 group-hover/lesson:text-foreground"
                  )}>
                    {cleanTitle(lesson.title)}
                  </div>
                  {lesson.duration_seconds != null && lesson.duration_seconds > 0 && (
                    <div className="text-[11px] text-muted-foreground/70 mt-0.5 tabular-nums">
                      {formatDuration(lesson.duration_seconds)}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
          {filteredLessons.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground/60">Nenhuma aula encontrada</div>
          )}
        </div>
      </div>
      {/* Sidebar footer - always visible */}
      <div className="shrink-0 border-t border-border bg-muted/20 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground font-medium">Avalie esta aula</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRate(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <Star className={cn(
                  "h-5 w-5 transition-colors",
                  (hoverRating || ratingStats.userRating || 0) >= star
                    ? "text-amber-500 fill-amber-500"
                    : "text-muted-foreground/25"
                )} />
              </button>
            ))}
          </div>
        </div>
        {ratingStats.total > 0 && (
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
            <span>{ratingStats.average.toFixed(1)} média</span>
            <span>·</span>
            <span>{ratingStats.total} {ratingStats.total === 1 ? 'voto' : 'votos'}</span>
          </div>
        )}
      </div>
    </>
  )

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
                className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-500 transition-all hover:bg-emerald-500/30"
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

              {/* Apagar Luz */}
              <button
                onClick={() => setTheaterMode(true)}
                className="p-2.5 rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"
                title="Apagar Luz"
              >
                <Moon className="h-5 w-5" />
              </button>

              {/* Sidebar toggle */}
              <button
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
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border-b border-amber-500/20">
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
                          <div className="flex items-center gap-0.5 shrink-0">
                            <a href={pdfViewerUrl!} download target="_blank" rel="noopener noreferrer"
                              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                              <Download className="h-3.5 w-3.5" />
                            </a>
                            <button onClick={() => setPdfViewerUrl(null)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 relative">
                          <iframe
                            src={splitViewerType === 'office'
                              ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(pdfViewerUrl!)}`
                              : pdfViewerUrl!}
                            title={splitViewerType === 'office' ? 'Documento' : 'PDF'}
                            className="absolute inset-0 w-full h-full border-0"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Mobile stacked */}
                    <div className="md:hidden p-3 pb-0">
                      <div className="relative w-full bg-black rounded-lg overflow-hidden border border-border shadow-sm" style={{ paddingBottom: '56.25%' }}>
                        {videoEmbedUrl ? (
                          <iframe src={videoEmbedUrl} title={lessonData.title}
                            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                            allowFullScreen className="absolute inset-0 w-full h-full border-0" />
                        ) : <VideoPlaceholder />}
                      </div>
                      <div className="border-t border-border">
                        <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className={cn("h-3.5 w-3.5", splitViewerType === 'office' ? "text-orange-500" : "text-primary")} />
                            <span className="text-xs text-muted-foreground truncate">
                              {attachments.find(p => p.file_url === pdfViewerUrl)?.file_name || (splitViewerType === 'office' ? 'Documento' : 'PDF')}
                            </span>
                          </div>
                          <button onClick={() => setPdfViewerUrl(null)} className="p-1.5 rounded text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div style={{ height: '50vh' }}>
                          <iframe
                            src={splitViewerType === 'office'
                              ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(pdfViewerUrl!)}`
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
                    <div className={cn("relative bg-black transition-all duration-300", theaterMode ? "w-full" : "rounded-2xl overflow-hidden border border-border shadow-sm")}>
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
                    <button onClick={handleMarkComplete} disabled={lessonData.completed}
                      className={cn(
                        "flex items-center gap-2.5 h-10 px-5 rounded-xl text-sm font-semibold transition-all min-h-[44px]",
                        lessonData.completed
                          ? "bg-emerald-500/10 text-emerald-500 cursor-default"
                          : "bg-primary hover:bg-emerald-500 text-primary-foreground hover:text-white shadow-sm hover:shadow-md active:scale-[0.97]"
                      )}
                    >
                      <CheckCircle className="h-4 w-4" />
                      {lessonData.completed ? 'Concluída' : 'Concluir aula'}
                    </button>

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
                <div className="flex flex-col sm:flex-row gap-3 mt-4 pt-5 border-t border-border">
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
                      onClick={() => { setActiveTab('resources'); setDrawerOpen(true) }}
                      className="flex items-center gap-2 h-10 sm:h-9 px-4 rounded-lg text-xs font-medium transition-all border border-border hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-primary"
                    >
                      <Paperclip className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                      Arquivos
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted min-w-[18px] text-center">{attachments.length}</span>
                    </button>
                  )}
                  <button
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
                    </div>
                    <SheetTitle className="sr-only">
                      {activeTab === 'comments' ? 'Comentários' : 'Arquivos'}
                    </SheetTitle>
                  </SheetHeader>

                  <div className="flex-1 overflow-y-auto px-6 py-5 bg-[#f5f5f7] dark:bg-background">
                    {/* Comments */}
                    {activeTab === 'comments' && (
                      <div className="space-y-5 max-w-3xl mx-auto">
                        {/* Comment input */}
                        <div className="flex gap-3 bg-white dark:bg-card rounded-2xl p-4 border border-border/40 shadow">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
                            <span className="text-sm font-bold text-white">
                              {user?.email?.[0]?.toUpperCase() || 'A'}
                            </span>
                          </div>
                          <div className="flex-1">
                            <textarea
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder="Compartilhe sua dúvida ou comentário sobre esta aula..."
                              rows={2}
                              maxLength={2000}
                              className="w-full px-4 py-3 text-sm bg-muted/30 border-0 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-muted/50 text-foreground placeholder:text-muted-foreground/50 transition-all"
                            />
                            {commentText.trim() && (
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-[11px] text-muted-foreground tabular-nums">{commentText.length}/2000</span>
                                <Button
                                  size="sm"
                                  onClick={() => handleSubmitComment()}
                                  disabled={submittingComment || !commentText.trim()}
                                  className="h-9 px-4 text-xs gap-2 bg-primary hover:bg-primary/90"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  Enviar
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Comments list */}
                        {comments.length === 0 ? (
                          <div className="text-center py-14 bg-white dark:bg-card rounded-2xl border border-border/40 shadow">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                              <MessageSquare className="h-7 w-7 text-primary/60" />
                            </div>
                            <h3 className="text-base font-semibold text-foreground mb-1.5">Nenhum comentário ainda</h3>
                            <p className="text-sm text-muted-foreground max-w-[300px] mx-auto leading-relaxed">Seja o primeiro a comentar! Compartilhe suas dúvidas ou insights sobre esta aula.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {comments.map((comment) => (
                              <div key={comment.id} className="bg-white dark:bg-card rounded-xl border border-border/40 shadow overflow-hidden">
                                {/* Main comment */}
                                <div className="flex gap-3 p-4 group">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-sm">
                                    {comment.user_avatar ? (
                                      <img src={comment.user_avatar} alt="" className="w-9 h-9 rounded-full object-cover" loading="lazy" />
                                    ) : (
                                      <span className="text-xs font-bold text-white">
                                        {(comment.user_name || 'A')[0].toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-semibold text-foreground">{comment.user_name || 'Aluno'}</span>
                                      <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                                        {new Date(comment.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">{DOMPurify.sanitize(comment.content, { ALLOWED_TAGS: [] })}</p>
                                    <div className="flex items-center gap-3 mt-2.5">
                                      <button
                                        onClick={() => { setReplyingTo(replyingTo === comment.id ? null : comment.id); setReplyText('') }}
                                        className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors font-semibold"
                                      >
                                        <Reply className="h-3.5 w-3.5" />
                                        Responder
                                      </button>
                                      {comment.user_id === user?.id && (
                                        <button
                                          onClick={() => handleDeleteComment(comment.id)}
                                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 font-medium"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          Excluir
                                        </button>
                                      )}
                                    </div>

                                    {/* Reply input */}
                                    {replyingTo === comment.id && (
                                      <div className="flex gap-2 mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                                        <input
                                          value={replyText}
                                          onChange={(e) => setReplyText(e.target.value)}
                                          placeholder="Escreva uma resposta..."
                                          maxLength={2000}
                                          className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground/50"
                                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(comment.id) } }}
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() => handleSubmitComment(comment.id)}
                                          disabled={submittingComment || !replyText.trim()}
                                          className="h-9 px-3 text-xs"
                                        >
                                          <Send className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Replies */}
                                {comment.replies && comment.replies.length > 0 && (
                                  <div className="ml-12 mr-4 mb-3 border-l-2 border-primary/15 pl-4 space-y-1 bg-muted/20 rounded-r-lg py-2">
                                    {comment.replies.map((reply) => (
                                      <div key={reply.id} className="flex gap-3 p-3 rounded-lg hover:bg-background/60 transition-colors group">
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0">
                                          {reply.user_avatar ? (
                                            <img src={reply.user_avatar} alt="" className="w-7 h-7 rounded-full object-cover" loading="lazy" />
                                          ) : (
                                            <span className="text-[10px] font-bold text-white">
                                              {(reply.user_name || 'A')[0].toUpperCase()}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-xs font-semibold text-foreground">{reply.user_name || 'Aluno'}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                              {new Date(reply.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                          </div>
                                          <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">{DOMPurify.sanitize(reply.content, { ALLOWED_TAGS: [] })}</p>
                                          {reply.user_id === user?.id && (
                                            <button
                                              onClick={() => handleDeleteComment(reply.id)}
                                              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 mt-1 font-medium"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                              Excluir
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Resources */}
                    {activeTab === 'resources' && attachments.length > 0 && (
                      <div className="max-w-3xl mx-auto">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {attachments.map((att) => {
                            const isPdf = att.file_type?.includes('pdf') || att.file_name?.endsWith('.pdf')
                            const ext = att.file_name?.split('.').pop()?.toLowerCase() || ''
                            const isOffice = ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)
                            const isViewable = isPdf || isOffice
                            const fileLabel = isPdf ? 'PDF' : isOffice ? ext.toUpperCase() : 'Arquivo'
                            const accentColor = isPdf ? 'red' : isOffice ? 'orange' : 'primary'
                            return (
                              <div key={att.id} className={cn(
                                "flex flex-col p-4 rounded-xl border bg-white dark:bg-card transition-all group hover:shadow-lg shadow",
                                isViewable ? `border-border/60 hover:border-${accentColor}-500/30` : "border-border/60 hover:border-primary/20"
                              )}>
                                <div className="flex items-start gap-3">
                                  <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                                    isPdf ? "bg-red-500/10 text-red-500" : isOffice ? "bg-orange-500/10 text-orange-500" : "bg-primary/10 text-primary"
                                  )}>
                                    <FileText className="h-6 w-6" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{att.file_name}</span>
                                    <span className={cn(
                                      "text-[11px] font-medium mt-1 block",
                                      isPdf ? "text-red-500/70" : isOffice ? "text-orange-500/70" : "text-muted-foreground"
                                    )}>{fileLabel}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                                  {isPdf && (
                                    <button onClick={() => { openPdfViewer(att.file_url); setDrawerOpen(false) }}
                                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-all shadow-sm">
                                      <Eye className="h-3.5 w-3.5" />
                                      Visualizar
                                    </button>
                                  )}
                                  {isOffice && (
                                    <button onClick={() => { openPdfViewer(att.file_url, 'office'); setDrawerOpen(false) }}
                                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-all shadow-sm">
                                      <Eye className="h-3.5 w-3.5" />
                                      Visualizar
                                    </button>
                                  )}
                                  <a href={att.file_url} download target="_blank" rel="noopener noreferrer"
                                    className={cn(
                                      "flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all",
                                      isPdf
                                        ? "flex-1 text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-border/60"
                                        : "flex-1 text-white bg-primary hover:bg-primary/90 shadow-sm"
                                    )}>
                                    <Download className="h-3.5 w-3.5" />
                                    Baixar
                                  </a>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
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
              <div className="sticky top-16 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
                {renderModuleSelector(false)}
                {renderLessonList(false)}
                <div className="shrink-0 h-[0.80rem]" />
              </div>
            )}
          </aside>

        </div>
      </div>

      {/* ============================================================ */}
      {/* Mobile sidebar (outside overflow-hidden container)            */}
      {/* ============================================================ */}
      {isSidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setIsSidebarOpen(false)} />
          <aside
            className="fixed inset-y-0 right-0 z-50 w-[85%] max-w-[360px] lg:hidden bg-card border-l border-border shadow-lg flex flex-col"
            style={{ animation: 'lp-slide-in 0.2s ease-out' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <ListVideo className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Aulas</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>

            {renderModuleSelector(true)}
            {renderLessonList(true)}
          </aside>
        </>
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
