import { useState, useEffect } from 'react'
import {
  Play,
  Headphones,
  Lock,
  Disc3,
  Music,
  ShoppingCart,
  Sparkles,
  MessageSquare,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useFeaturePermissions } from '@/hooks/use-feature-permissions'
import { useTrialLimits } from '@/hooks/use-trial-limits'
import { FEATURE_KEYS } from '@/services/classPermissionsService'
import { SectionLoader } from '@/components/SectionLoader'
import { audioLessonService, type AudioLesson, type EvercastCourse } from '@/services/audioLessonService'
import { AudioPlayer } from '@/components/AudioPlayer'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { getSupportWhatsAppUrl } from '@/lib/constants'

export default function EvercastPage() {
  const { isStudent, user } = useAuth()
  const navigate = useNavigate()
  const { hasFeature, loading: permissionsLoading } = useFeaturePermissions()
  const { isTrialUser, loading: trialLoading } = useTrialLimits()
  const [evercastCourses, setEvercastCourses] = useState<EvercastCourse[]>([])
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [currentTrack, setCurrentTrack] = useState<AudioLesson | null>(null)
  const [allLessons, setAllLessons] = useState<AudioLesson[]>([])

  useEffect(() => {
    if (!user || trialLoading) return
    loadCourses()
  }, [user, trialLoading])

  const loadCourses = async () => {
    try {
      setIsLoading(true)

      // For trial users, fetch all evercast courses + their enrollment
      if (isTrialUser) {
        const [courses, enrollmentData] = await Promise.all([
          audioLessonService.getEvercastCourses(user!.id, false, true),
          supabase
            .from('student_classes')
            .select('classes!inner(class_courses!inner(course_id))')
            .eq('user_id', user!.id),
        ])

        const enrolled = new Set<string>(
          (enrollmentData.data || []).flatMap((sc: any) =>
            sc.classes?.class_courses?.map((cc: any) => cc.course_id) || []
          )
        )
        setEnrolledCourseIds(enrolled)
        setEvercastCourses(courses)
        // Only set playable lessons from enrolled courses
        setAllLessons(courses.filter(c => enrolled.has(c.id)).flatMap(c => c.modules.flatMap(m => m.lessons)))
      } else {
        const courses = await audioLessonService.getEvercastCourses(user!.id, !isStudent)
        setEvercastCourses(courses)
        setAllLessons(courses.flatMap(c => c.modules.flatMap(m => m.lessons)))
      }
    } catch (error) {
      logger.error('Error loading evercast courses:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePlay = (lesson: AudioLesson) => {
    setCurrentTrack(lesson)
  }

  // Verificação de permissões para alunos
  if (permissionsLoading || isLoading || trialLoading) {
    return <SectionLoader />
  }

  // Se for aluno e não tiver permissão, mostra página bloqueada
  if (isStudent && !hasFeature(FEATURE_KEYS.EVERCAST)) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Evercast</h1>
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-24">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 mx-auto mb-8 rounded-3xl bg-purple-500/10 flex items-center justify-center">
                <Lock className="w-10 h-10 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Recurso Bloqueado
              </h3>
              <p className="text-muted-foreground mb-8">
                O Evercast (áudio-aulas) não está disponível para sua turma. Entre em contato com seu professor ou administrador para mais informações.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Find any sales_url from courses for the trial banner
  const anySalesUrl = evercastCourses.find(c => c.sales_url)?.sales_url

  return (
    <div className={cn("space-y-6 pb-32", currentTrack ? "mb-20" : "")}>
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row gap-6 items-end p-6">
        <div className="w-32 h-32 shadow-sm rounded-md bg-emerald-600 flex items-center justify-center shrink-0">
          <Headphones className="w-12 h-12 text-white" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="uppercase text-xs font-bold tracking-wider text-muted-foreground">Seus Cursos em Audio</span>
          <h1 className="text-2xl font-bold text-foreground">Evercast</h1>
          <p className="text-muted-foreground max-w-2xl">
            Suas aulas em formato de audio para estudar em qualquer lugar.
          </p>
          <div className="flex items-center gap-4 mt-4">
            <span className="text-sm font-medium">{evercastCourses.length} {evercastCourses.length === 1 ? 'curso' : 'cursos'}</span>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">
              {evercastCourses.reduce((sum, c) => sum + c.total_lessons, 0)} aulas
            </span>
          </div>
        </div>
      </div>

      {/* Trial Upgrade Banner */}
      {isTrialUser && evercastCourses.some(c => !enrolledCourseIds.has(c.id)) && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border-2 border-amber-500/30 rounded-xl p-5 mx-4 md:mx-8">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-6 w-6 text-amber-500" />
            </div>
            <div className="flex-1 space-y-1 text-center sm:text-left">
              <h2 className="text-base font-bold text-foreground">Você está na degustação!</h2>
              <p className="text-muted-foreground text-sm">
                Adquira o acesso completo para ouvir todos os cursos em áudio.
              </p>
            </div>
            <div className="shrink-0">
              {anySalesUrl ? (
                <Button asChild size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg gap-2">
                  <a href={anySalesUrl} target="_blank" rel="noopener noreferrer">
                    <ShoppingCart className="h-4 w-4" />
                    Adquirir acesso completo
                  </a>
                </Button>
              ) : (
                <Button size="lg" variant="outline" className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10 gap-2"
                  onClick={() => window.open(getSupportWhatsAppUrl(), '_blank')}>
                  <MessageSquare className="h-4 w-4" />
                  Falar com o suporte
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-8 px-4 md:px-8">
        {/* Course Albums */}
        {evercastCourses.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {evercastCourses.map(course => {
              const isEnrolled = enrolledCourseIds.has(course.id) || !isTrialUser
              const courseLocked = !isEnrolled

              return (
                <div
                  key={course.id}
                  className="group cursor-pointer"
                  onClick={() => navigate(`/evercast/curso/${course.id}`)}
                >
                  <div className={cn(
                    "relative aspect-square rounded-md overflow-hidden bg-muted mb-3 shadow-sm hover:shadow-md transition-shadow",
                    courseLocked && "opacity-60"
                  )}>
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-emerald-600 flex items-center justify-center">
                        <Disc3 className="w-16 h-16 text-white/80" />
                      </div>
                    )}
                    {courseLocked ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                          <Lock className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="icon"
                        className="absolute bottom-2 right-2 rounded-full w-12 h-12 bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all"
                        onClick={(e) => {
                          e.stopPropagation()
                          const firstLesson = course.modules[0]?.lessons[0]
                          if (firstLesson) handlePlay(firstLesson)
                        }}
                      >
                        <Play className="h-5 w-5 ml-0.5 fill-black" />
                      </Button>
                    )}
                  </div>
                  <p className="font-medium text-sm truncate">{course.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {course.total_lessons} aulas · {Math.floor(course.total_duration_minutes / 60)}h {course.total_duration_minutes % 60}min
                  </p>
                  {courseLocked && isTrialUser && (
                    <p className="text-xs text-amber-500 font-medium mt-0.5 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Adquira o acesso completo
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <Music className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum curso disponível no Evercast ainda.</p>
          </div>
        )}
      </div>

      {/* Persistent Audio Player */}
      <AudioPlayer
        currentTrack={currentTrack}
        playlist={allLessons}
        onTrackChange={setCurrentTrack}
      />
    </div>
  )
}
