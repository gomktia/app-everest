import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Play, Clock, Users, Star, BookOpen, Brain, ArrowRight, Award, TrendingUp, Zap, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStaggeredAnimation } from '@/hooks/useAnimations'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { courseService, CourseTrail } from '@/services/courseService'
import { useAuth } from '@/hooks/use-auth'
import { SectionLoader } from '@/components/SectionLoader'
import { CourseTrailCard } from '@/components/courses/CourseTrailCard'
import { useFeaturePermissions } from '@/hooks/use-feature-permissions'
import { FEATURE_KEYS } from '@/services/classPermissionsService'
import { logger } from '@/lib/logger'
import { TourButton } from '@/components/TourButton'
import type { DriveStep } from 'driver.js'

const TOUR_STEPS: DriveStep[] = [
  { element: '[data-tour="courses-search"]', popover: { title: 'Busca de Cursos', description: 'Pesquise pelo nome do curso e filtre por categoria para encontrar rapidamente o que precisa.' } },
  { element: '[data-tour="courses-filters"]', popover: { title: 'Filtros por Categoria', description: 'Use os botões para filtrar cursos por categoria. Clique em "Todos" para ver tudo.' } },
  { element: '[data-tour="courses-cards"]', popover: { title: 'Seus Cursos', description: 'Cada card mostra o curso, quantidade de aulas, duração e sua barra de progresso.' } },
  { element: '[data-tour="courses-card-link"]', popover: { title: 'Acessar Curso', description: 'Clique em qualquer card para abrir o curso e ver os módulos e aulas disponíveis.' } },
]

export default function CoursesPage() {
  const { user, isStudent } = useAuth()
  const { hasFeature, loading: permissionsLoading } = useFeaturePermissions()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('Todos')
  const [courseTrails, setCourseTrails] = useState<CourseTrail[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        if (!user?.id) { setIsLoading(false); return }

        const trails = await courseService.getUserCoursesByTrail(user.id)
        setCourseTrails(trails)
      } catch (error) {
        logger.error('Error fetching courses:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCourses()
  }, [user?.id])

  // Filter trails by search term and category
  const filteredTrails = courseTrails.map(trail => ({
    ...trail,
    courses: trail.courses.filter(course =>
      course.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (filterCategory === 'Todos' || course.category === filterCategory)
    )
  })).filter(trail => trail.courses.length > 0)

  const categories = ['Todos', ...Array.from(new Set(courseTrails.flatMap(t => t.courses.map(c => c.category || 'Geral'))))]

  const delays = useStaggeredAnimation(filteredTrails.length, 100)

  // Calculate overall stats from all trails
  const totalActiveCourses = filteredTrails.reduce((sum, trail) => sum + trail.courses.length, 0)
  const totalLessonsCompleted = filteredTrails.reduce((sum, trail) => sum + trail.completedLessons, 0)
  const totalLessons = filteredTrails.reduce((sum, trail) => sum + trail.totalLessons, 0)
  const averageProgress = filteredTrails.length > 0
    ? filteredTrails.reduce((sum, trail) => sum + trail.averageProgress, 0) / filteredTrails.length
    : 0


  if (permissionsLoading || isLoading) {
    return <SectionLoader />
  }

  // Se for aluno e não tiver permissão, mostra página bloqueada
  if (isStudent && !hasFeature(FEATURE_KEYS.VIDEO_LESSONS)) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Meus Cursos</h1>
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto mb-8 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Recurso Bloqueado
              </h3>
              <p className="text-muted-foreground mb-8">
                O sistema de videoaulas não está disponível para sua turma. Entre em contato com seu professor ou administrador para mais informações.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Meus Cursos</h1>
        <TourButton steps={TOUR_STEPS} />
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Stats */}
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="space-y-4 md:space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-primary/10">
                    <BookOpen className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Plataforma de Cursos
                    </h2>
                    <p className="text-muted-foreground text-sm md:text-base lg:text-lg">
                      Aprenda com os melhores professores e domine qualquer assunto
                    </p>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-primary/5 border border-primary/20">
                  <Star className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                  <span className="text-xs md:text-sm font-medium">Ensino Inteligente</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="text-center p-3 md:p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-blue-500 mx-auto mb-2" />
                  <div className="text-xl md:text-2xl font-bold text-blue-600">{totalActiveCourses}</div>
                  <div className="text-xs md:text-sm text-muted-foreground">Cursos Ativos</div>
                </div>
                <div className="text-center p-3 md:p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <Play className="h-5 w-5 md:h-6 md:w-6 text-green-500 mx-auto mb-2" />
                  <div className="text-xl md:text-2xl font-bold text-green-600">{totalLessonsCompleted}</div>
                  <div className="text-xs md:text-sm text-muted-foreground">Aulas Concluidas</div>
                </div>
                <div className="text-center p-3 md:p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <Clock className="h-5 w-5 md:h-6 md:w-6 text-purple-500 mx-auto mb-2" />
                  <div className="text-xl md:text-2xl font-bold text-purple-600">{totalLessons}</div>
                  <div className="text-xs md:text-sm text-muted-foreground">Total Aulas</div>
                </div>
                <div className="text-center p-3 md:p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-orange-500 mx-auto mb-2" />
                  <div className="text-xl md:text-2xl font-bold text-orange-600">{Math.round(averageProgress)}%</div>
                  <div className="text-xs md:text-sm text-muted-foreground">Progresso Medio</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filter */}
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 md:gap-4">
              <div data-tour="courses-search" className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cursos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-border"
                />
              </div>
              <div data-tour="courses-filters" className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={filterCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterCategory(category)}
                    className={cn(
                      "transition-colors duration-300 whitespace-nowrap flex-shrink-0",
                      filterCategory !== category && "hover:bg-muted"
                    )}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Course Trails */}
        {filteredTrails.length === 0 ? (
          <Card className="border-border shadow-sm">
            <CardContent className="text-center py-16">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 mx-auto mb-8 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Nenhum curso encontrado
                </h3>
                <p className="text-muted-foreground mb-8">
                  {searchTerm || filterCategory !== 'Todos'
                    ? 'Tente ajustar seus filtros de busca'
                    : 'Voce ainda nao tem acesso a nenhum curso. Entre em contato com seu professor.'
                  }
                </p>
                {(searchTerm || filterCategory !== 'Todos') && (
                  <Button
                    onClick={() => {
                      setSearchTerm('')
                      setFilterCategory('Todos')
                    }}
                  >
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-12 pb-24">
            {filteredTrails.map((trail, index) => (
              <div key={index} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: `${index * 150}ms` }}>
                <div className="flex items-end justify-between border-b pb-4">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                      {trail.name}
                      <span className="text-muted-foreground font-normal text-sm ml-2 px-2 py-0.5 rounded-full bg-muted">
                        Trilha
                      </span>
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                      {trail.courses.length} curso{trail.courses.length !== 1 ? 's' : ''} • {Math.round(trail.averageProgress)}% concluido
                    </p>
                  </div>
                </div>

                <div data-tour="courses-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {trail.courses.map((course, courseIndex) => (
                    <Link key={course.id} to={`/meus-cursos/${course.id}`} className="group block h-full" {...(courseIndex === 0 ? { 'data-tour': 'courses-card-link' } : {})}>
                      <Card className="h-full flex flex-col overflow-hidden border-border hover:shadow-md transition-all duration-300 group-hover:border-primary/50 p-0">
                        {/* Course Thumbnail */}
                        <div className="relative aspect-video w-full overflow-hidden bg-muted">
                          <img
                            src={course.image_url || "/placeholder.svg"}
                            alt={course.title}
                            className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
                          />
                          {/* Overlay Play Button */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <div className="w-14 h-14 rounded-full bg-white/20 border border-white/40 flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-75 shadow-2xl">
                              <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
                            </div>
                          </div>
                          {/* Tags/Badges */}
                          <div className="absolute top-2 right-2 flex gap-1 z-10">
                            {course.progress === 100 && (
                              <div className="px-2 py-1 rounded-md bg-green-500/90 text-white text-xs font-bold shadow-sm flex items-center gap-1">
                                <Award className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 p-5 flex flex-col space-y-3">
                          <h3 className="font-bold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                            {course.title}
                          </h3>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto pt-2">
                            <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>{course.lessons_count || 0} aulas</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{course.total_hours || 0}h</span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-2 pt-3 border-t mt-4">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-muted-foreground">Progresso</span>
                              <span className={cn(course.progress === 100 ? "text-green-500" : "text-primary")}>
                                {course.progress === 100 ? "100%" : `${Math.round(course.progress)}%`}
                              </span>
                            </div>
                            <Progress value={course.progress} className={cn("h-1.5", course.progress === 100 ? "[&>div]:bg-green-500" : "")} />
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
