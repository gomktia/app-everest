import { useState, useEffect, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  PlayCircle,
  Clock,
  BookOpen,
  ChevronRight,
  LayoutGrid,
  List,
  Layers,
  Trophy,
  Lock,
  ExternalLink,
  MessageSquare,
  ShoppingCart,
  Crown,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { SectionLoader } from '@/components/SectionLoader'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useTrialLimits } from '@/hooks/use-trial-limits'
import { courseService } from '@/services/courseService'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { getSupportWhatsAppUrl } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LessonWithProgress {
  id: string
  title: string
  description: string | null
  order_index: number
  duration_seconds: number | null
  is_preview: boolean
  progress: number
  completed: boolean
  last_position: number
}

interface ModuleWithLessons {
  id: string
  name: string
  description: string | null
  order_index: number
  lessons: LessonWithProgress[]
}

interface CourseData {
  id: string
  name: string
  description: string | null
  thumbnail_url: string | null
  sales_url: string | null
  modules: ModuleWithLessons[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return ''
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  if (sec === 0) return `${min}min`
  return `${min}min ${sec}s`
}

function formatTotalDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0min'
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}min`
  return `${mins}min`
}

type ViewMode = 'card' | 'list'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CourseDetailPage() {
  const { courseId } = useParams()
  const { user, effectiveUserId } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isTrialUser } = useTrialLimits()
  const [course, setCourse] = useState<CourseData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [enrollmentChecked, setEnrollmentChecked] = useState(false)
  const [moduleRules, setModuleRules] = useState<Record<string, { rule_type: string; rule_value: string | null }>>({})
  const [lessonRules, setLessonRules] = useState<Record<string, { rule_type: string; rule_value: string | null }>>({})
  const [studentClassId, setStudentClassId] = useState<string | null>(null)
  const [enrollmentDate, setEnrollmentDate] = useState<string | null>(null)

  // ---- Enrollment check ----
  useEffect(() => {
    async function checkEnrollment() {
      if (!effectiveUserId || !courseId) {
        setEnrollmentChecked(true)
        return
      }
      const { data } = await supabase
        .from('student_classes')
        .select('id, class_id, enrollment_date, classes!inner(class_courses!inner(course_id))')
        .eq('user_id', effectiveUserId)

      const enrolledCourseIds = (data || []).flatMap((sc: any) =>
        sc.classes?.class_courses?.map((cc: any) => cc.course_id) || []
      )
      setIsEnrolled(enrolledCourseIds.includes(courseId))

      // Find the class_id that has this course
      const matchingEntry = (data || []).find((sc: any) =>
        sc.classes?.class_courses?.some((cc: any) => cc.course_id === courseId)
      )
      if (matchingEntry) {
        setStudentClassId(matchingEntry.class_id)
        setEnrollmentDate(matchingEntry.enrollment_date)
      }

      setEnrollmentChecked(true)
    }
    checkEnrollment()
  }, [effectiveUserId, courseId])

  // ---- Module rules for the student's class ----
  useEffect(() => {
    async function fetchRules() {
      if (!studentClassId) return

      const [{ data: modRules }, { data: lesRules }] = await Promise.all([
        supabase.from('class_module_rules').select('module_id, rule_type, rule_value').eq('class_id', studentClassId),
        supabase.from('class_lesson_rules').select('lesson_id, rule_type, rule_value').eq('class_id', studentClassId),
      ])

      if (modRules) {
        const rules: Record<string, { rule_type: string; rule_value: string | null }> = {}
        for (const r of modRules) rules[r.module_id] = { rule_type: r.rule_type, rule_value: r.rule_value }
        setModuleRules(rules)
      }
      if (lesRules) {
        const rules: Record<string, { rule_type: string; rule_value: string | null }> = {}
        for (const r of lesRules) rules[r.lesson_id] = { rule_type: r.rule_type, rule_value: r.rule_value }
        setLessonRules(rules)
      }
    }
    fetchRules()
  }, [studentClassId])

  // ---- Data fetching ----
  useEffect(() => {
    const fetchCourseDetails = async () => {
      if (!courseId || !effectiveUserId) return

      try {
        setIsLoading(true)
        const data = await courseService.getCourseWithModulesAndProgress(courseId, effectiveUserId)
        if (data) {
          setCourse({
            id: data.id,
            name: data.name,
            description: data.description,
            thumbnail_url: data.thumbnail_url,
            sales_url: data.sales_url || null,
            modules: (data.modules || [])
              .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
              .map((m: ModuleWithLessons) => ({
              id: m.id,
              name: m.name,
              description: m.description,
              order_index: m.order_index,
              lessons: (m.lessons || [])
                .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
                .map((l: LessonWithProgress) => ({
                id: l.id,
                title: l.title,
                description: l.description,
                order_index: l.order_index,
                duration_seconds: l.duration_seconds,
                is_preview: l.is_preview,
                progress: l.progress || 0,
                completed: l.completed || false,
                last_position: l.last_position || 0,
              })),
            })),
          })
        }
      } catch (error) {
        logger.error('Error fetching course details:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCourseDetails()
  }, [courseId, effectiveUserId])

  // ---- Module access check helper ----
  const getModuleAccess = (moduleId: string): { accessible: boolean; hidden: boolean; message: string } => {
    const rule = moduleRules[moduleId]
    if (!rule || rule.rule_type === 'free') return { accessible: true, hidden: false, message: '' }

    switch (rule.rule_type) {
      case 'hidden':
        return { accessible: false, hidden: true, message: '' }
      case 'blocked':
        return { accessible: false, hidden: false, message: 'Conteúdo bloqueado' }
      case 'scheduled_date': {
        const date = new Date(rule.rule_value!)
        if (date <= new Date()) return { accessible: true, hidden: false, message: '' }
        return { accessible: false, hidden: false, message: `Disponível em ${date.toLocaleDateString('pt-BR')}` }
      }
      case 'days_after_enrollment': {
        if (!enrollmentDate) return { accessible: false, hidden: false, message: 'Data de matricula nao encontrada' }
        const days = parseInt(rule.rule_value!)
        const unlockDate = new Date(new Date(enrollmentDate).getTime() + days * 86400000)
        if (unlockDate <= new Date()) return { accessible: true, hidden: false, message: '' }
        return { accessible: false, hidden: false, message: `Disponível em ${unlockDate.toLocaleDateString('pt-BR')}` }
      }
      default:
        return { accessible: true, hidden: false, message: '' }
    }
  }

  // ---- Lesson access check (overrides module rule) ----
  const getLessonAccess = (lessonId: string, moduleAccess: { accessible: boolean }): { accessible: boolean; message: string } => {
    const rule = lessonRules[lessonId]
    if (!rule) {
      // No lesson-specific rule → inherit module access
      return { accessible: moduleAccess.accessible, message: '' }
    }
    // Lesson rule overrides module rule
    if (rule.rule_type === 'free') return { accessible: true, message: '' }
    if (rule.rule_type === 'hidden') return { accessible: false, message: '' }
    if (rule.rule_type === 'blocked') return { accessible: false, message: 'Aula bloqueada' }
    if (rule.rule_type === 'scheduled_date') {
      const date = new Date(rule.rule_value!)
      if (date <= new Date()) return { accessible: true, message: '' }
      return { accessible: false, message: `Disponível em ${date.toLocaleDateString('pt-BR')}` }
    }
    return { accessible: moduleAccess.accessible, message: '' }
  }

  // ---- Computed stats ----
  const stats = useMemo(() => {
    if (!course) return { totalLessons: 0, completedLessons: 0, progressPercent: 0, totalDuration: 0 }
    let totalLessons = 0
    let completedLessons = 0
    let totalDuration = 0
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        totalLessons++
        if (lesson.completed) completedLessons++
        if (lesson.duration_seconds) totalDuration += lesson.duration_seconds
      }
    }
    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
    return { totalLessons, completedLessons, progressPercent, totalDuration }
  }, [course])

  // ---- First incomplete lesson ----
  const firstIncompleteLesson = useMemo(() => {
    if (!course) return null
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        if (!lesson.completed) {
          return { moduleId: mod.id, lessonId: lesson.id, lessonTitle: lesson.title }
        }
      }
    }
    return null
  }, [course])

  // ---- Default open accordion module ----
  const defaultOpenModule = useMemo(() => {
    if (firstIncompleteLesson) return [firstIncompleteLesson.moduleId]
    if (course?.modules?.[0]) return [course.modules[0].id]
    return []
  }, [firstIncompleteLesson, course])

  // ---- Loading state ----
  if (isLoading || !enrollmentChecked) {
    return <SectionLoader />
  }

  // ---- Course not found ----
  if (!course) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Curso não encontrado</h1>
          <p className="text-sm text-muted-foreground mt-1">O curso solicitado não foi encontrado</p>
        </div>
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Curso não encontrado</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              O curso que você está procurando não existe ou não está disponível.
            </p>
            <Link to="/courses">
              <Button>Voltar aos Cursos</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isCompleted = stats.progressPercent === 100

  // ====================================================================
  // RENDER
  // ====================================================================
  return (
    <div className="space-y-6">
        {/* ── Back button ── */}
        <div>
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar aos Cursos
          </Link>
        </div>

        {/* ── Storefront Banner (non-enrolled) ── */}
        {!isEnrolled && course && (
          <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-2 border-orange-500/30 rounded-xl p-6">
            <div className="flex flex-col md:flex-row gap-6 items-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center shrink-0">
                <Lock className="h-8 w-8 text-orange-500" />
              </div>
              <div className="flex-1 space-y-2 text-center md:text-left">
                <h2 className="text-xl font-bold text-foreground">Este curso está bloqueado</h2>
                <p className="text-muted-foreground text-sm">Adquira o acesso para desbloquear todas as aulas, materiais e funcionalidades.</p>
              </div>
              <div className="shrink-0">
                {course.sales_url ? (
                  <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg gap-2">
                    <a href={course.sales_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Adquirir este curso
                    </a>
                  </Button>
                ) : (
                  <Button size="lg" variant="outline" className="border-orange-500/50 text-orange-600 hover:bg-orange-500/10 gap-2"
                    onClick={() => window.open(getSupportWhatsAppUrl('Olá! Tenho interesse no curso ' + course.name), '_blank')}>
                    <MessageSquare className="h-4 w-4" />
                    Falar com o suporte
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Trial Upgrade Banner (enrolled but trial) ── */}
        {isEnrolled && isTrialUser && course && (
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border-2 border-amber-500/30 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="h-6 w-6 text-amber-500" />
              </div>
              <div className="flex-1 space-y-1 text-center sm:text-left">
                <h2 className="text-base font-bold text-foreground">Você está na degustação!</h2>
                <p className="text-muted-foreground text-sm">
                  Gostou do conteúdo? Adquira o acesso completo para desbloquear todos os módulos e aulas.
                </p>
              </div>
              <div className="shrink-0">
                {course.sales_url ? (
                  <Button asChild size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg gap-2">
                    <a href={course.sales_url} target="_blank" rel="noopener noreferrer">
                      <ShoppingCart className="h-4 w-4" />
                      Adquirir acesso completo
                    </a>
                  </Button>
                ) : (
                  <Button size="lg" variant="outline" className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10 gap-2"
                    onClick={() => window.open(getSupportWhatsAppUrl('Olá! Tenho interesse no curso ' + course.name), '_blank')}>
                    <MessageSquare className="h-4 w-4" />
                    Falar com o suporte
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Hero / Course Header ── */}
        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="p-6 md:p-8 space-y-6">
            {/* Top row: thumbnail + info */}
            <div className="flex flex-col md:flex-row gap-6">
              {course.thumbnail_url && (
                <div className="flex-shrink-0 w-full md:w-80 rounded-xl overflow-hidden bg-muted self-stretch min-h-[180px]">
                  <img
                    src={course.thumbnail_url}
                    alt={course.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex-1 min-w-0 space-y-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
                    {course.name}
                  </h1>
                  {course.description && (
                    <p className="text-muted-foreground mt-2 text-sm md:text-base leading-relaxed max-w-2xl">
                      {course.description}
                    </p>
                  )}
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <StatBadge icon={<BookOpen className="h-4 w-4" />} label={`${stats.totalLessons} aulas`} />
                  <StatBadge icon={<Layers className="h-4 w-4" />} label={`${course.modules.length} módulos`} />
                  {stats.totalDuration > 0 && (
                    <StatBadge icon={<Clock className="h-4 w-4" />} label={formatTotalDuration(stats.totalDuration)} />
                  )}
                  <StatBadge
                    icon={isCompleted ? <Trophy className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    label={`${stats.progressPercent}% concluído`}
                    highlight={isCompleted}
                  />
                </div>

                {/* Continue button - only for enrolled students */}
                {firstIncompleteLesson && isEnrolled ? (
                  <Button
                    size="lg"
                    onClick={() =>
                      navigate(`/courses/${courseId}/lessons/${firstIncompleteLesson.lessonId}`)
                    }
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    <PlayCircle className="h-5 w-5 mr-2" />
                    Continuar de onde parou
                  </Button>
                ) : isCompleted ? (
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-green-500">
                    <Trophy className="h-5 w-5" />
                    Curso concluído!
                  </div>
                ) : null}
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso geral</span>
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    isCompleted ? 'text-green-500' : 'text-primary'
                  )}
                >
                  {stats.completedLessons}/{stats.totalLessons} aulas ({stats.progressPercent}%)
                </span>
              </div>
              <Progress
                value={stats.progressPercent}
                className="h-2.5 bg-muted [&>div]:bg-blue-500"
              />
            </div>
          </div>
        </section>

        {/* ── View Toggle + Section Title ── */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Módulos do curso</h2>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
            <button
              onClick={() => setViewMode('card')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200',
                viewMode === 'card'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </button>
          </div>
        </div>

        {/* ── Modules Content (filtered by module rules, with lesson overrides) ── */}
        {(() => {
          const filteredCourse = {
            ...course,
            modules: course.modules
              .filter(m => !getModuleAccess(m.id).hidden)
              .map(m => {
                const modAccess = getModuleAccess(m.id)
                return {
                  ...m,
                  _locked: !modAccess.accessible,
                  _lockMessage: modAccess.message,
                  lessons: m.lessons
                    .filter(l => lessonRules[l.id]?.rule_type !== 'hidden')
                    .map(l => {
                      const lesAccess = getLessonAccess(l.id, modAccess)
                      return { ...l, _locked: !lesAccess.accessible, _lockMessage: lesAccess.message }
                    })
                }
              })
          }

          const handleLockedClick = () => {
            if (isTrialUser) {
              if (course.sales_url) {
                window.open(course.sales_url, '_blank')
              } else {
                toast({
                  title: 'Conteúdo exclusivo para assinantes',
                  description: 'Entre em contato para adquirir o acesso completo.',
                })
              }
            } else {
              toast({ title: 'Adquira o curso para acessar este conteúdo', variant: 'destructive' })
            }
          }

          return viewMode === 'card' ? (
            <ModuleCardView
              course={filteredCourse}
              courseId={courseId!}
              firstIncompleteLessonId={firstIncompleteLesson?.lessonId ?? null}
              isEnrolled={isEnrolled}
              isTrialUser={isTrialUser}
              salesUrl={course.sales_url}
              onLockedClick={handleLockedClick}
            />
          ) : (
            <ModuleListView
              course={filteredCourse}
              courseId={courseId!}
              firstIncompleteLessonId={firstIncompleteLesson?.lessonId ?? null}
              defaultOpenModule={defaultOpenModule}
              isEnrolled={isEnrolled}
              isTrialUser={isTrialUser}
              salesUrl={course.sales_url}
              onLockedClick={handleLockedClick}
            />
          )
        })()}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatBadge
// ---------------------------------------------------------------------------

function StatBadge({
  icon,
  label,
  highlight = false,
}: {
  icon: React.ReactNode
  label: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm cursor-default transition-all duration-200',
        highlight
          ? 'border-green-500/30 bg-green-500/10 text-green-500 hover:bg-green-500/20 hover:border-green-500/50'
          : 'border-primary/20 bg-primary/5 text-primary hover:bg-primary/15 hover:border-primary/40 hover:shadow-sm'
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ModuleCardView
// ---------------------------------------------------------------------------

function ModuleCardView({
  course,
  courseId,
  firstIncompleteLessonId,
  isEnrolled,
  isTrialUser,
  salesUrl,
  onLockedClick,
}: {
  course: CourseData
  courseId: string
  firstIncompleteLessonId: string | null
  isEnrolled: boolean
  isTrialUser: boolean
  salesUrl: string | null
  onLockedClick: () => void
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {course.modules.map((module, idx) => {
        const completedInModule = module.lessons.filter((l) => l.completed).length
        const totalInModule = module.lessons.length
        const allCompleted = totalInModule > 0 && completedInModule === totalInModule
        const moduleProgress =
          totalInModule > 0 ? Math.round((completedInModule / totalInModule) * 100) : 0
        const previewLessons = module.lessons.slice(0, 4)

        return (
          <div
            key={module.id}
            className={cn(
              'group relative flex flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 shadow-sm',
              'hover:border-primary/30 hover:shadow-lg'
            )}
          >
            {/* Module number badge */}
            <div
              className={cn(
                'absolute -top-3 left-4 inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold',
                allCompleted
                  ? 'bg-green-500 text-white'
                  : 'bg-primary text-primary-foreground'
              )}
            >
              Módulo {idx + 1}
            </div>

            {/* Module name */}
            <h3 className="mt-2 font-semibold text-foreground leading-snug line-clamp-2">
              {module.name}
            </h3>

            {/* Progress info */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {completedInModule}/{totalInModule} aulas
                </span>
                <span
                  className={cn(
                    'font-semibold',
                    allCompleted ? 'text-green-500' : 'text-foreground'
                  )}
                >
                  {moduleProgress}%
                </span>
              </div>
              <Progress
                value={moduleProgress}
                className="h-1.5 bg-muted [&>div]:bg-blue-500"
              />
            </div>

            {/* Lesson preview list */}
            <ul className="mt-4 flex-1 space-y-1.5">
              {previewLessons.map((lesson) => {
                const isHighlighted = lesson.id === firstIncompleteLessonId
                const lessonLocked = (lesson as any)._locked
                const isLocked = lessonLocked || (!isEnrolled && !lesson.is_preview)
                return (
                  <li key={lesson.id} className="flex items-center gap-2 min-w-0">
                    {isLocked ? (
                      <Lock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/40" />
                    ) : lesson.completed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                    ) : isHighlighted ? (
                      <PlayCircle className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/40" />
                    )}
                    <span
                      className={cn(
                        'truncate text-xs',
                        lesson.completed
                          ? 'text-muted-foreground line-through decoration-muted-foreground/40'
                          : isHighlighted
                            ? 'text-foreground font-medium'
                            : 'text-foreground'
                      )}
                    >
                      {lesson.title}
                    </span>
                  </li>
                )
              })}
              {module.lessons.length > 4 && (
                <li className="text-xs text-muted-foreground pl-5.5">
                  +{module.lessons.length - 4} aula{module.lessons.length - 4 !== 1 ? 's' : ''}
                </li>
              )}
            </ul>

            {/* View module link */}
            {(module as any)._locked ? (
              <div className="mt-4 space-y-2 text-center">
                <div className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold',
                  'bg-muted text-muted-foreground'
                )}>
                  <Lock className="h-4 w-4" />
                  {(module as any)._lockMessage || 'Bloqueado'}
                </div>
                {isTrialUser && salesUrl && (
                  <a
                    href={salesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200',
                      'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm hover:shadow-md'
                    )}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Adquirir acesso
                  </a>
                )}
              </div>
            ) : isEnrolled ? (
              <Link
                to={`/courses/${courseId}/lessons/${(module.lessons.find(l => !(l as any)._locked && !l.completed) || module.lessons.find(l => !(l as any)._locked) || module.lessons[0])?.id ?? ''}`}
                className={cn(
                  'mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200',
                  'bg-primary text-primary-foreground hover:bg-green-600 hover:shadow-md'
                )}
              >
                Ver módulo
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                onClick={onLockedClick}
                className={cn(
                  'mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200',
                  'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <Lock className="h-4 w-4" />
                Bloqueado
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ModuleListView (Accordion)
// ---------------------------------------------------------------------------

function ModuleListView({
  course,
  courseId,
  firstIncompleteLessonId,
  defaultOpenModule,
  isEnrolled,
  isTrialUser,
  salesUrl,
  onLockedClick,
}: {
  course: CourseData
  courseId: string
  firstIncompleteLessonId: string | null
  defaultOpenModule: string[]
  isEnrolled: boolean
  isTrialUser: boolean
  salesUrl: string | null
  onLockedClick: () => void
}) {
  // When not enrolled, check which modules have any preview lessons
  const modulesWithPreview = new Set(
    course.modules
      .filter(m => m.lessons.some(l => l.is_preview))
      .map(m => m.id)
  )

  return (
    <Accordion type="multiple" defaultValue={isEnrolled ? defaultOpenModule : []} className="space-y-3">
      {course.modules.map((module, idx) => {
        const completedInModule = module.lessons.filter((l) => l.completed).length
        const totalInModule = module.lessons.length
        const allCompleted = totalInModule > 0 && completedInModule === totalInModule
        const moduleProgress =
          totalInModule > 0 ? Math.round((completedInModule / totalInModule) * 100) : 0
        const isModuleLocked = (module as any)._locked || (!isEnrolled && !modulesWithPreview.has(module.id))
        const moduleLockMessage = (module as any)._lockMessage

        return (
          <AccordionItem
            key={module.id}
            value={module.id}
            className={cn(
              "border border-border rounded-xl overflow-hidden bg-card",
              isModuleLocked && "opacity-60"
            )}
          >
            <AccordionTrigger
              className="px-5 py-4 hover:bg-muted/30 hover:no-underline transition-colors"
              onClick={(e) => {
                if (isModuleLocked) {
                  e.preventDefault()
                  onLockedClick()
                }
              }}
            >
              <div className="flex items-center justify-between w-full pr-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Module number or lock */}
                  {isModuleLocked ? (
                    <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-muted">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold',
                        allCompleted
                          ? 'bg-green-500/15 text-green-500'
                          : 'bg-primary/10 text-primary'
                      )}
                    >
                      {idx + 1}
                    </span>
                  )}
                  <span className={cn("font-semibold text-left truncate", isModuleLocked ? "text-muted-foreground" : "text-foreground")}>
                    {module.name}
                  </span>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                  {!isModuleLocked && (
                    <>
                      {/* Mini progress bar */}
                      <div className="hidden sm:flex items-center gap-2 w-24">
                        <Progress
                          value={moduleProgress}
                          className="h-1.5 bg-muted [&>div]:bg-blue-500"
                        />
                        <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
                          {moduleProgress}%
                        </span>
                      </div>
                      {/* Lesson count */}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {completedInModule}/{totalInModule} aula{totalInModule !== 1 ? 's' : ''}
                      </span>
                      {allCompleted && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
                    </>
                  )}
                  {isModuleLocked && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {totalInModule} aula{totalInModule !== 1 ? 's' : ''} · {moduleLockMessage || 'Bloqueado'}
                      </span>
                      {isTrialUser && salesUrl && (
                        <a
                          href={salesUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-all"
                        >
                          <ShoppingCart className="h-3 w-3" />
                          Comprar
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-3 pb-3">
              <div className="space-y-0.5">
                {module.lessons.map((lesson, lessonIndex) => {
                  const isFirstIncomplete = lesson.id === firstIncompleteLessonId
                  const duration = formatDuration(lesson.duration_seconds)
                  const lessonLocked = (lesson as any)._locked
                  const isLocked = lessonLocked || (!isEnrolled && !lesson.is_preview)

                  const rowClasses = cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                    isLocked ? 'opacity-60 cursor-pointer' : 'hover:bg-muted/50',
                    !isLocked && isFirstIncomplete ? 'bg-primary/5 border border-primary/20 shadow-sm' : !isLocked && lessonIndex % 2 === 1 && 'bg-muted/30'
                  )

                  const statusIcon = isLocked ? (
                    <Lock className="h-5 w-5 text-muted-foreground/40" />
                  ) : lesson.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : isFirstIncomplete ? (
                    <PlayCircle className="h-5 w-5 text-primary animate-pulse" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )

                  const titleClasses = cn(
                    'flex-1 text-sm',
                    isLocked
                      ? 'text-muted-foreground'
                      : lesson.completed
                        ? 'text-muted-foreground line-through decoration-muted-foreground/30'
                        : isFirstIncomplete
                          ? 'text-foreground font-medium'
                          : 'text-foreground'
                  )

                  if (isLocked) {
                    return (
                      <div
                        key={lesson.id}
                        className={rowClasses}
                        onClick={onLockedClick}
                      >
                        <div className="flex-shrink-0">{statusIcon}</div>
                        <span className={titleClasses}>{lesson.title}</span>
                        {duration && (
                          <span className="flex-shrink-0 text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {duration}
                          </span>
                        )}
                        <Lock className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={lesson.id}
                      to={`/courses/${courseId}/lessons/${lesson.id}`}
                      className={rowClasses}
                    >
                      <div className="flex-shrink-0">{statusIcon}</div>
                      <span className={titleClasses}>{lesson.title}</span>
                      {duration && (
                        <span className="flex-shrink-0 text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {duration}
                        </span>
                      )}
                      {isFirstIncomplete && (
                        <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
