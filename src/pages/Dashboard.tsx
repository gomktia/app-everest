import { useState, useEffect } from 'react'
import { LiveBanner } from '@/components/LiveBanner'
import { useAuth } from '@/hooks/use-auth'
import { cachedFetch } from '@/lib/offlineCache'
import { courseService } from '@/services/courseService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen,
  Clock,
  TrendingUp,
  CheckCircle,
  Zap,
  Calendar,
  ArrowRight,
  Trophy,
  ChevronRight,
} from 'lucide-react'
import { SectionLoader } from '@/components/SectionLoader'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { OfflineBanner } from '@/components/OfflineBanner'
import { dashboardService, type Course, type Event } from '@/services/dashboardService'
import {
  rankingService,
  type UserPosition,
  type UserRanking,
} from '@/services/rankingService'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { logger } from '@/lib/logger'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

const chartConfig = {
  progress: {
    label: 'Progresso',
    color: 'hsl(var(--primary))',
  },
}

const eventIcons = {
  exam: <BookOpen className="h-4 w-4" />,
  deadline: <Calendar className="h-4 w-4" />,
  live: <Calendar className="h-4 w-4" />,
}

const eventColors = {
  exam: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  deadline: 'bg-red-500/10 text-red-600 dark:text-red-400',
  live: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

export default function DashboardPage() {
  const { user, profile, effectiveUserId, impersonatedStudent } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    activeCourses: 0,
    averageProgress: 0,
    completedLessons: 0,
    studyTime: 0,
  })
  const [streak, setStreak] = useState(0)
  const [courses, setCourses] = useState<Course[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null)
  const [topRanking, setTopRanking] = useState<UserRanking[]>([])
  const [fromCache, setFromCache] = useState(false)

  // Streak
  useEffect(() => {
    const stored = localStorage.getItem('everest_streak')
    const today = new Date()
    const todayStr = today.toDateString()
    let currentStreak = 1
    let lastDateStr = ''

    if (stored) {
      try {
        const data = JSON.parse(stored)
        currentStreak = data.count || 0
        lastDateStr = data.lastDate || ''
      } catch { /* ignore */ }
    }

    if (lastDateStr === todayStr) {
      setStreak(currentStreak)
      return
    }

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (lastDateStr === yesterday.toDateString()) {
      currentStreak += 1
    } else {
      currentStreak = 1
    }

    setStreak(currentStreak)
    localStorage.setItem('everest_streak', JSON.stringify({ count: currentStreak, lastDate: todayStr }))
  }, [])

  // Load all data
  useEffect(() => {
    const loadDashboard = async () => {
      const userId = effectiveUserId
      if (!userId) {
        setIsLoading(false)
        return
      }

      try {
        const result = await cachedFetch(`dashboard-${userId}`, () =>
          Promise.all([
            courseService.getUserCoursesByTrail(userId),
            dashboardService.getUpcomingEvents(userId),
            rankingService.getUserPosition(userId).catch(() => null),
            rankingService.getUserRanking(5).catch(() => []),
          ])
        )
        setFromCache(result.fromCache)
        const [trailsData, upcomingEvents, positionData, rankingData] = result.data

        // Stats from trails
        const trails = Array.isArray(trailsData) ? trailsData : []
        const allCourses = trails.flatMap(t => Array.isArray(t.courses) ? t.courses : [])
        const activeCoursesCount = allCourses.length
        let totalProgressSum = 0
        let totalLessonsCompleted = 0
        let totalStudyHours = 0

        allCourses.forEach(course => {
          if (course) {
            totalProgressSum += (course.progress || 0)
            totalLessonsCompleted += Math.round(((course.lessons_count || 0) * (course.progress || 0)) / 100)
            totalStudyHours += ((course.total_hours || 0) * ((course.progress || 0) / 100))
          }
        })

        const averageProgress = activeCoursesCount > 0 ? Math.round(totalProgressSum / activeCoursesCount) : 0

        setStats({
          activeCourses: activeCoursesCount,
          averageProgress: isNaN(averageProgress) ? 0 : averageProgress,
          completedLessons: isNaN(totalLessonsCompleted) ? 0 : totalLessonsCompleted,
          studyTime: isNaN(totalStudyHours) ? 0 : Math.round(totalStudyHours),
        })

        setCourses(allCourses)
        setEvents(upcomingEvents)
        setUserPosition(positionData)
        setTopRanking(rankingData)
      } catch (error) {
        logger.error('Erro ao carregar dashboard:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboard()
  }, [effectiveUserId])

  if (isLoading) {
    return <SectionLoader />
  }

  const kpis = [
    {
      label: 'Cursos Ativos',
      value: stats.activeCourses,
      icon: BookOpen,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Progresso Médio',
      value: `${stats.averageProgress}%`,
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Aulas Concluídas',
      value: stats.completedLessons,
      icon: CheckCircle,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-500/10',
    },
    {
      label: 'Horas de Estudo',
      value: `${stats.studyTime}h`,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Dias em Sequência',
      value: streak,
      icon: Zap,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-500/10',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Olá, {profile?.first_name || 'Aluno'}!
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe seu progresso e continue aprendendo.
        </p>
      </div>

      <OfflineBanner fromCache={fromCache} />

      {/* Live Banner */}
      <LiveBanner />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-border shadow-sm">
            <CardContent className="p-4">
              <div className={cn('p-2 rounded-lg w-fit mb-3', kpi.bg)}>
                <kpi.icon className={cn('h-4 w-4', kpi.color)} />
              </div>
              <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{kpi.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Meus Cursos - spans 2 cols */}
        <div className="lg:col-span-2">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Meus Cursos</CardTitle>
                  <CardDescription>Continue de onde parou</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/courses">
                    Ver todos
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {courses.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {courses.slice(0, 4).map((course) => (
                    <Link
                      key={course.id}
                      to={`/courses/${course.id}`}
                      className="group flex gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <img
                        src={course.image}
                        alt={course.title}
                        className="w-16 h-16 rounded-lg object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {course.title}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {course.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Progress value={course.progress} className="h-1.5 flex-1" />
                          <span className="text-xs font-medium text-muted-foreground">{course.progress}%</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum curso encontrado.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ranking */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Ranking</CardTitle>
                <CardDescription>Sua posição atual</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/ranking">
                  Ver todos
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User Position */}
            {userPosition && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {userPosition.first_name?.[0]}{userPosition.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium text-foreground">Você</div>
                      <div className="text-xs text-muted-foreground">{userPosition.total_xp} XP</div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    #{userPosition.rank_position}
                  </Badge>
                </div>
                {(() => {
                  const progressInfo = rankingService.calculateProgressToNext(userPosition.total_xp)
                  const levelInfo = rankingService.calculateLevelInfo(userPosition.total_xp)
                  return (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Nível {levelInfo.level} - {levelInfo.title}</span>
                        <span>{progressInfo.xpToNext} XP p/ próximo</span>
                      </div>
                      <Progress value={progressInfo.progress} className="h-1.5" />
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Top 5 */}
            <div className="space-y-1">
              {topRanking.slice(0, 5).map((rankedUser, index) => (
                <div key={rankedUser.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className={cn(
                    "w-6 text-center text-xs font-bold",
                    index === 0 && "text-yellow-500",
                    index === 1 && "text-gray-400",
                    index === 2 && "text-amber-600",
                    index > 2 && "text-muted-foreground"
                  )}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </span>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {rankedUser.first_name?.[0]}{rankedUser.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {rankedUser.first_name} {rankedUser.last_name}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{rankedUser.total_xp} XP</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Progresso por Curso */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Progresso por Curso</CardTitle>
            <CardDescription>Seu avanço em cada curso</CardDescription>
          </CardHeader>
          <CardContent>
            {courses.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <BarChart accessibilityLayer data={courses.map(c => ({ name: c.title?.substring(0, 20) + (c.title?.length > 20 ? '...' : ''), progress: c.progress || 0 }))}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    fontSize={11}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Bar dataKey="progress" fill="var(--color-progress)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                Nenhum curso matriculado ainda.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximos Eventos */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Próximos Eventos</CardTitle>
                <CardDescription>Seus compromissos futuros</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/calendario">
                  Ver todos
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {events.length > 0 ? (
              <div className="space-y-3">
                {events.map((event, index) => (
                  <div key={`${event.title}-${index}`} className="flex items-center gap-3">
                    <div className={cn('rounded-lg p-2', eventColors[event.type])}>
                      {eventIcons[event.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum evento próximo.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
