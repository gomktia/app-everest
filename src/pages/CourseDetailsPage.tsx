import { Link, useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { courseService } from '@/services/courseService'
import { useAuth } from '@/hooks/use-auth'
import { SectionLoader } from '@/components/SectionLoader'
import {
  CheckCircle,
  PlayCircle,
  Clock,
  BookOpen,
  Star,
  ArrowRight,
  Calendar
} from 'lucide-react'
import { cn, getCategoryColor } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { TourButton } from '@/components/TourButton'
import type { DriveStep } from 'driver.js'

const TOUR_STEPS: DriveStep[] = [
  { element: '[data-tour="course-header"]', popover: { title: 'Informações do Curso', description: 'Veja o nome, descrição e estatísticas gerais do curso.' } },
  { element: '[data-tour="course-progress"]', popover: { title: 'Barra de Progresso', description: 'Acompanhe quantas aulas você já concluiu e quantas faltam para terminar o curso.' } },
  { element: '[data-tour="course-modules"]', popover: { title: 'Módulos do Curso', description: 'Clique em um módulo para expandir e ver todas as aulas disponíveis.' } },
  { element: '[data-tour="course-lesson"]', popover: { title: 'Acessar Aula', description: 'Clique em qualquer aula para assistir ao vídeo e acompanhar o material.' } },
  { element: '[data-tour="course-continue"]', popover: { title: 'Continuar de Onde Parou', description: 'Clique aqui para retomar o curso direto de onde você parou.' } },
]

interface CourseModule {
  id: string
  name: string
  description: string | null
  order_index: number
  lessons: CourseLesson[]
}

interface CourseLesson {
  id: string
  title: string
  description: string | null
  order_index: number
  duration_seconds: number | null
  is_preview: boolean
  is_completed?: boolean
  progress_percentage?: number
}

interface CourseDetails {
  id: string
  name: string
  description: string | null
  thumbnail_url: string | null
  modules: CourseModule[]
  total_lessons: number
  completed_lessons: number
  progress_percentage: number
}

export default function CourseDetailsPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [course, setCourse] = useState<CourseDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchCourseDetails = async () => {
      if (!courseId || !user?.id) return

      try {
        setIsLoading(true)
        const courseData = await courseService.getCourseWithModulesAndProgress(courseId, user.id)

        // Transform the data to match our interface
        const transformedCourse: CourseDetails = {
          id: courseData.id,
          name: courseData.name,
          description: courseData.description,
          thumbnail_url: courseData.thumbnail_url,
          modules: courseData.modules.map(module => ({
            id: module.id,
            name: module.name,
            description: module.description,
            order_index: module.order_index,
            lessons: module.lessons.map(lesson => ({
              id: lesson.id,
              title: lesson.title,
              description: lesson.description,
              order_index: lesson.order_index,
              duration_seconds: lesson.duration_seconds,
              is_preview: lesson.is_preview,
              is_completed: lesson.is_completed || false,
              progress_percentage: lesson.progress_percentage || 0
            }))
          })),
          total_lessons: courseData.total_lessons,
          completed_lessons: courseData.completed_lessons,
          progress_percentage: courseData.progress_percentage
        }

        setCourse(transformedCourse)
      } catch (error) {
        logger.error('Error fetching course details:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCourseDetails()
  }, [courseId, user?.id])

  if (isLoading) {
    return <SectionLoader />
  }

  if (!course) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Curso não encontrado</h1>
        <div className="text-center py-24">
          <h2 className="text-2xl font-bold mb-4">Curso não encontrado</h2>
          <p className="text-muted-foreground mb-8">
            O curso que você está procurando não existe ou não está disponível.
          </p>
          <Link to="/meus-cursos">
            <Button>Voltar aos Cursos</Button>
          </Link>
        </div>
      </div>
    )
  }

  const totalLessons = course.total_lessons
  const completedLessons = course.completed_lessons
  const courseProgress = course.progress_percentage
  const totalModules = course.modules.length

  // Calculate real total duration from lessons
  const totalDurationSeconds = course.modules.reduce((acc, mod) =>
    acc + mod.lessons.reduce((lAcc, l) => lAcc + (l.duration_seconds || 0), 0), 0)
  const totalDurationHours = Math.floor(totalDurationSeconds / 3600)
  const totalDurationMinutes = Math.floor((totalDurationSeconds % 3600) / 60)
  const durationLabel = totalDurationHours > 0
    ? `${totalDurationHours}h${totalDurationMinutes > 0 ? `${totalDurationMinutes}min` : ''}`
    : `${totalDurationMinutes}min`

  // Find the first incomplete lesson to continue
  const getNextLessonPath = () => {
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        if (!lesson.is_completed) {
          return `/meus-cursos/${courseId}/lesson/${lesson.id}`
        }
      }
    }
    // All completed — go to first lesson
    if (course.modules.length > 0 && course.modules[0].lessons.length > 0) {
      return `/meus-cursos/${courseId}/lesson/${course.modules[0].lessons[0].id}`
    }
    return `/meus-cursos`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Detalhes do Curso</h1>
        <TourButton steps={TOUR_STEPS} />
      </div>

      <div className="grid gap-8 lg:grid-cols-3 max-w-7xl mx-auto">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Course Header */}
          <Card data-tour="course-header" className="border-border shadow-sm">
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-primary/10">
                        <BookOpen className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold text-foreground">
                          {course.name}
                        </h2>
                        <p className="text-muted-foreground text-lg">
                          {course.description || 'Descrição não disponível'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/20">
                    <Star className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">4.8</span>
                  </div>
                </div>

                {/* Progress Section */}
                <div data-tour="course-progress" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Progresso do Curso</h3>
                    <span className="text-sm text-muted-foreground">
                      {completedLessons || 0} de {totalLessons || 0} aulas
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Progress
                      value={courseProgress}
                      className="h-3 bg-muted/50"
                    />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {courseProgress?.toFixed(0) || 0}% concluído
                      </span>
                      <span className="font-medium text-primary">
                        {(totalLessons || 0) - (completedLessons || 0)} aulas restantes
                      </span>
                    </div>
                  </div>
                </div>

                {/* Course Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-xl bg-blue-100 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-800">
                    <Clock className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-600">{durationLabel}</div>
                    <div className="text-sm text-muted-foreground">Duração</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-green-100 dark:bg-green-950/50 border border-green-300 dark:border-green-800">
                    <PlayCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-600">{totalLessons}</div>
                    <div className="text-sm text-muted-foreground">Aulas</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-purple-100 dark:bg-purple-950/50 border border-purple-300 dark:border-purple-800">
                    <BookOpen className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-purple-600">{totalModules}</div>
                    <div className="text-sm text-muted-foreground">Módulos</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Course Modules */}
          <Card className="border-border shadow-sm">
            <CardContent className="pt-6">
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-foreground">
                  Conteúdo do Curso
                </h2>
                <Accordion data-tour="course-modules" type="multiple" defaultValue={course.modules.length > 0 ? [course.modules[0].id] : []} className="space-y-4">
                  {course.modules.map((module, index) => {
                    const completedInModule = module.lessons.filter(
                      (l) => l.is_completed,
                    ).length
                    const totalInModule = module.lessons.length
                    const moduleProgress = totalInModule > 0 ? (completedInModule / totalInModule) * 100 : 0
                    const moduleColors = getCategoryColor(index)

                    return (
                      <AccordionItem
                        value={module.id}
                        key={module.id}
                        className={cn('border rounded-xl overflow-hidden', moduleColors.border)}
                      >
                        <AccordionTrigger className="font-semibold px-6 py-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-4">
                              <div className={cn('p-2 rounded-lg', moduleColors.bg)}>
                                <span className={cn('text-sm font-bold', moduleColors.text)}>
                                  {String(index + 1).padStart(2, '0')}
                                </span>
                              </div>
                              <div>
                                <span className="text-lg">{module.name}</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <Progress
                                    value={moduleProgress}
                                    className="h-2 w-32 bg-muted/50"
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {moduleProgress.toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground">
                                {completedInModule}/{totalInModule} aulas
                              </span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-4">
                          <div className="space-y-3">
                            {module.lessons.map((lesson, lessonIndex) => {
                              const isCompleted = lesson.is_completed
                              const duration = lesson.duration_seconds
                                ? `${Math.floor(lesson.duration_seconds / 60)}:${(lesson.duration_seconds % 60).toString().padStart(2, '0')}`
                                : 'N/A'

                              return (
                                <Link
                                  key={lesson.id}
                                  to={`/meus-cursos/${courseId}/lesson/${lesson.id}`}
                                  {...(index === 0 && lessonIndex === 0 ? { 'data-tour': 'course-lesson' } : {})}
                                  className={cn(
                                    "group flex items-center justify-between p-4 rounded-xl transition-colors duration-300",
                                    "hover:bg-muted/50",
                                    "hover:shadow-md",
                                    "border border-transparent hover:border-primary/20"
                                  )}
                                >
                                  <div className="flex items-center gap-4">
                                    <div className={cn(
                                      "p-2 rounded-lg transition-colors",
                                      isCompleted
                                        ? "bg-green-100 dark:bg-green-950/50 text-green-600"
                                        : "bg-muted/50 text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                                    )}>
                                      {isCompleted ? (
                                        <CheckCircle className="h-5 w-5" />
                                      ) : (
                                        <PlayCircle className="h-5 w-5" />
                                      )}
                                    </div>
                                    <div>
                                      <span className={cn(
                                        "font-medium transition-colors",
                                        isCompleted
                                          ? "text-muted-foreground line-through"
                                          : "text-foreground group-hover:text-primary"
                                      )}>
                                        {lesson.title}
                                      </span>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">
                                          {duration}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      Aula {lessonIndex + 1}
                                    </span>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                  </div>
                                </Link>
                              )
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Course Card */}
          <Card className="border-border shadow-sm sticky top-24 overflow-hidden">
            <div className="relative">
              <img
                src={course.thumbnail_url || 'https://images.unsplash.com/photo-1516397281156-ca07cf9746fc?w=400&h=200&fit=crop'}
                alt={course.name}
                className="w-full h-48 object-cover rounded-t-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-white/80" />
                  <span className="text-sm text-white/80">Última atualização: Hoje</span>
                </div>
              </div>
            </div>
            <CardContent className="p-6 space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-bold mb-2">Continue seu aprendizado</h3>
                <p className="text-muted-foreground text-sm">
                  Você está {courseProgress?.toFixed(0) || 0}% do caminho para completar este curso
                </p>
              </div>

              <Button
                data-tour="course-continue"
                className="w-full font-semibold py-3 rounded-xl hover:shadow-md transition-all duration-300 inline-flex items-center justify-center"
                size="lg"
                onClick={() => navigate(getNextLessonPath())}
              >
                <PlayCircle className="h-5 w-5 mr-2" />
                Continuar Curso
              </Button>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{courseProgress?.toFixed(0) || 0}%</span>
                </div>
                <Progress
                  value={courseProgress}
                  className="h-2 bg-muted/50"
                />
              </div>

              <div className="pt-4 border-t border-border">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">{completedLessons || 0}</div>
                    <div className="text-xs text-muted-foreground">Concluídas</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-muted-foreground">{(totalLessons || 0) - (completedLessons || 0)}</div>
                    <div className="text-xs text-muted-foreground">Restantes</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
