import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Play, Clock, ChevronLeft, Disc3, Lock, ShoppingCart, Sparkles, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionLoader } from '@/components/SectionLoader'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useFeaturePermissions } from '@/hooks/use-feature-permissions'
import { useTrialLimits } from '@/hooks/use-trial-limits'
import { useToast } from '@/hooks/use-toast'
import { FEATURE_KEYS } from '@/services/classPermissionsService'
import { audioLessonService, type AudioLesson, type EvercastCourse } from '@/services/audioLessonService'
import { AudioPlayer } from '@/components/AudioPlayer'
import { supabase } from '@/lib/supabase/client'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

type RuleMap = Record<string, { rule_type: string; rule_value: string | null }>

export default function EvercastAlbumPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { user, isStudent } = useAuth()
  const { hasFeature, loading: permissionsLoading } = useFeaturePermissions()
  const { isTrialUser } = useTrialLimits()
  const { toast } = useToast()
  const [course, setCourse] = useState<EvercastCourse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentTrack, setCurrentTrack] = useState<AudioLesson | null>(null)
  const [allLessons, setAllLessons] = useState<AudioLesson[]>([])

  // Access rules
  const [moduleRules, setModuleRules] = useState<RuleMap>({})
  const [lessonRules, setLessonRules] = useState<RuleMap>({})
  const [enrollmentDate, setEnrollmentDate] = useState<string | null>(null)
  const [isEnrolledInCourse, setIsEnrolledInCourse] = useState(true)

  useEffect(() => {
    if (!user || !courseId) return
    loadCourse()
    if (isStudent) loadAccessRules()
  }, [user, courseId])

  const loadCourse = async () => {
    try {
      setIsLoading(true)
      // Trial users can browse all courses; regular users only enrolled ones
      const courses = await audioLessonService.getEvercastCourses(user!.id, !isStudent, isTrialUser)
      const found = courses.find(c => c.id === courseId)
      if (found) {
        setCourse(found)
        setAllLessons(found.modules.flatMap(m => m.lessons))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const loadAccessRules = async () => {
    if (!user?.id || !courseId) return

    // Find the student's class for this course
    const { data } = await supabase
      .from('student_classes')
      .select('class_id, enrollment_date, classes!inner(class_courses!inner(course_id))')
      .eq('user_id', user.id)

    const matchingEntry = (data || []).find((sc: any) =>
      sc.classes?.class_courses?.some((cc: any) => cc.course_id === courseId)
    )
    if (!matchingEntry) {
      setIsEnrolledInCourse(false)
      return
    }

    setEnrollmentDate(matchingEntry.enrollment_date)
    const classId = matchingEntry.class_id

    const [{ data: modRules }, { data: lesRules }] = await Promise.all([
      supabase.from('class_module_rules').select('module_id, rule_type, rule_value').eq('class_id', classId),
      supabase.from('class_lesson_rules').select('lesson_id, rule_type, rule_value').eq('class_id', classId),
    ])

    if (modRules) {
      const rules: RuleMap = {}
      for (const r of modRules) rules[r.module_id] = { rule_type: r.rule_type, rule_value: r.rule_value }
      setModuleRules(rules)
    }
    if (lesRules) {
      const rules: RuleMap = {}
      for (const r of lesRules) rules[r.lesson_id] = { rule_type: r.rule_type, rule_value: r.rule_value }
      setLessonRules(rules)
    }
  }

  // --- Access check helpers (same logic as CourseDetailPage) ---
  const getModuleAccess = useCallback((moduleId: string) => {
    if (!isStudent) return { accessible: true, hidden: false }
    const rule = moduleRules[moduleId]
    if (!rule || rule.rule_type === 'free') return { accessible: true, hidden: false }

    switch (rule.rule_type) {
      case 'hidden': return { accessible: false, hidden: true }
      case 'blocked': return { accessible: false, hidden: false }
      case 'scheduled_date': {
        const date = new Date(rule.rule_value!)
        return date <= new Date() ? { accessible: true, hidden: false } : { accessible: false, hidden: false }
      }
      case 'days_after_enrollment': {
        if (!enrollmentDate) return { accessible: false, hidden: false }
        const unlockDate = new Date(new Date(enrollmentDate).getTime() + parseInt(rule.rule_value!) * 86400000)
        return unlockDate <= new Date() ? { accessible: true, hidden: false } : { accessible: false, hidden: false }
      }
      default: return { accessible: true, hidden: false }
    }
  }, [moduleRules, enrollmentDate, isStudent])

  const isLessonLocked = useCallback((lesson: AudioLesson) => {
    if (!isStudent) return false
    // Not enrolled in this course = everything locked (except previews)
    if (!isEnrolledInCourse && !lesson.is_preview) return true
    // Preview lessons are always accessible
    if (lesson.is_preview) return false

    const modAccess = getModuleAccess(lesson.module_id)

    // Check lesson-specific rule
    const realLessonId = lesson.lesson_id || lesson.id.replace('video_', '')
    const lesRule = lessonRules[realLessonId]
    if (lesRule) {
      if (lesRule.rule_type === 'free') return false
      if (lesRule.rule_type === 'blocked' || lesRule.rule_type === 'hidden') return true
      if (lesRule.rule_type === 'scheduled_date') {
        return new Date(lesRule.rule_value!) > new Date()
      }
    }

    // Inherit module access
    return !modAccess.accessible
  }, [lessonRules, getModuleAccess, isStudent, isEnrolledInCourse])

  const handlePlay = (lesson: AudioLesson) => {
    if (isLessonLocked(lesson)) {
      if (isTrialUser && course?.sales_url) {
        window.open(course.sales_url, '_blank')
      } else {
        toast({
          title: 'Aula bloqueada',
          description: isTrialUser
            ? 'Adquira o acesso completo para ouvir esta aula.'
            : 'Esta aula não está disponível para sua turma.',
        })
      }
      return
    }
    setCurrentTrack(lesson)
  }

  const handlePlayAll = () => {
    // Play the first unlocked lesson
    const firstUnlocked = allLessons.find(l => !isLessonLocked(l))
    if (firstUnlocked) handlePlay(firstUnlocked)
  }

  // Filter playlist to only unlocked lessons (for auto-advance)
  const playableLessons = allLessons.filter(l => !isLessonLocked(l))

  if (permissionsLoading || isLoading) return <SectionLoader />

  if (isStudent && !hasFeature(FEATURE_KEYS.EVERCAST)) {
    navigate('/evercast')
    return null
  }

  if (!course) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Curso não encontrado</h1>
        <div className="text-center py-24">
          <p className="text-muted-foreground mb-4">Este curso não está disponível no Evercast.</p>
          <Button variant="outline" onClick={() => navigate('/evercast')}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Voltar ao Evercast
          </Button>
        </div>
      </div>
    )
  }

  const hasLockedLessons = allLessons.some(l => isLessonLocked(l))

  return (
    <div className={cn("space-y-6 pb-32", currentTrack ? "mb-20" : "")}>
      {/* Back button */}
      <div className="mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/evercast')}
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar ao Evercast
        </Button>
      </div>

      {/* Trial Upgrade Banner */}
      {isTrialUser && hasLockedLessons && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border-2 border-amber-500/30 rounded-xl p-5 mx-4 md:mx-8">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-6 w-6 text-amber-500" />
            </div>
            <div className="flex-1 space-y-1 text-center sm:text-left">
              <h2 className="text-base font-bold text-foreground">Você está na degustação!</h2>
              <p className="text-muted-foreground text-sm">
                Adquira o acesso completo para ouvir todas as aulas em áudio.
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
                  onClick={() => window.open('https://wa.me/5555999999999?text=Olá! Tenho interesse no acesso completo.', '_blank')}>
                  <MessageSquare className="h-4 w-4" />
                  Falar com o suporte
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Album Header */}
      <div className="flex flex-col items-center md:flex-row md:items-end gap-6 p-6">
        <div className="w-32 h-32 shadow-sm rounded-md overflow-hidden shrink-0">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt={course.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-emerald-600 flex items-center justify-center">
              <Disc3 className="w-12 h-12 text-white" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 text-center md:text-left">
          <span className="uppercase text-xs font-bold tracking-wider text-muted-foreground">Curso em Audio</span>
          <h1 className="text-2xl font-bold text-foreground">{course.name}</h1>
          {course.description && (
            <p className="text-muted-foreground max-w-2xl">{course.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm font-medium">{course.total_lessons} aulas</span>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">
              {Math.floor(course.total_duration_minutes / 60)}h {course.total_duration_minutes % 60}min
            </span>
            {hasLockedLessons && (
              <>
                <span className="text-sm text-muted-foreground">·</span>
                <span className="text-sm text-amber-500 font-medium">
                  {playableLessons.length} liberadas
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        {/* Play All */}
        <div className="flex items-center gap-4">
          <Button
            size="lg"
            className="rounded-full w-14 h-14 bg-emerald-500 hover:bg-emerald-600 text-black shadow-sm hover:shadow-md transition-shadow"
            onClick={handlePlayAll}
          >
            <Play className="h-6 w-6 ml-1 fill-black" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {hasLockedLessons ? 'Reproduzir aulas liberadas' : 'Reproduzir tudo'}
          </span>
        </div>

        {/* Modules Accordion */}
        <Accordion type="multiple" defaultValue={course.modules.map(m => m.id)} className="space-y-2">
          {course.modules
            .filter(m => !getModuleAccess(m.id).hidden)
            .map((mod, modIndex) => {
            const modLocked = !getModuleAccess(mod.id).accessible
            const freeLessonsInMod = mod.lessons.filter(l => !isLessonLocked(l)).length

            return (
              <AccordionItem key={mod.id} value={mod.id} className={cn("border rounded-lg px-4", modLocked && "opacity-70")}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 w-full">
                    {modLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    <span className="text-sm text-muted-foreground">Modulo {modIndex + 1}</span>
                    <span className="font-semibold">{mod.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({mod.lessons.length} aulas{modLocked && freeLessonsInMod > 0 ? ` · ${freeLessonsInMod} liberadas` : ''})
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1 pb-2">
                    {mod.lessons.map((lesson, lessonIndex) => {
                      const locked = isLessonLocked(lesson)
                      const isPlaying = currentTrack?.id === lesson.id

                      return (
                        <div
                          key={lesson.id}
                          className={cn(
                            "flex items-center gap-4 p-3 rounded-md transition-colors group",
                            locked
                              ? "cursor-pointer opacity-50 hover:opacity-70"
                              : "cursor-pointer hover:bg-white/5",
                            isPlaying ? "bg-emerald-500/10 border border-emerald-500/20" : ""
                          )}
                          onClick={() => handlePlay(lesson)}
                        >
                          <span className={cn(
                            "w-6 text-center text-sm",
                            isPlaying ? "text-emerald-400" : "text-muted-foreground"
                          )}>
                            {locked ? (
                              <Lock className="h-4 w-4 mx-auto text-muted-foreground/60" />
                            ) : isPlaying ? (
                              <div className="w-4 h-4 mx-auto flex items-end justify-between gap-[2px]">
                                <div className="w-1 bg-emerald-400 animate-[music-bar_0.6s_ease-in-out_infinite] h-full" />
                                <div className="w-1 bg-emerald-400 animate-[music-bar_0.8s_ease-in-out_infinite_0.1s] h-2/3" />
                                <div className="w-1 bg-emerald-400 animate-[music-bar_1.0s_ease-in-out_infinite_0.2s] h-1/2" />
                              </div>
                            ) : (
                              <>
                                <span className="group-hover:hidden">{lessonIndex + 1}</span>
                                <Play className="h-4 w-4 mx-auto hidden group-hover:block fill-white" />
                              </>
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "font-medium truncate",
                              isPlaying ? "text-emerald-400" : locked ? "text-muted-foreground" : ""
                            )}>
                              {lesson.title}
                            </p>
                          </div>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {lesson.duration_minutes ? `${lesson.duration_minutes} min` : '-'}
                          </span>
                          {locked && isTrialUser && course.sales_url && (
                            <ShoppingCart className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>

      {/* Persistent Audio Player - only unlocked lessons in playlist */}
      <AudioPlayer
        currentTrack={currentTrack}
        playlist={playableLessons}
        onTrackChange={setCurrentTrack}
      />
    </div>
  )
}
