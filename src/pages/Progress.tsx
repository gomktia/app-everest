import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { courseService } from '@/services/courseService'
import { getUserProgress, getUserAchievements } from '@/services/gamificationService'
import { rankingService } from '@/services/rankingService'
import { SectionLoader } from '@/components/SectionLoader'
import { logger } from '@/lib/logger'
import {
  TrendingUp,
  BookOpen,
  Clock,
  Award,
  CheckCircle,
  AlertCircle,
  Star
} from 'lucide-react'

interface ProgressData {
  overallProgress: number
  coursesCompleted: number
  totalCourses: number
  studyTime: number
  streak: number
  achievements: number
  recentActivity: {
    course: string
    progress: number
    completed: boolean
    date: string
  }[]
  userAchievements: {
    title: string
    description: string
    earned: boolean
  }[]
}

const emptyData: ProgressData = {
  overallProgress: 0,
  coursesCompleted: 0,
  totalCourses: 0,
  studyTime: 0,
  streak: 0,
  achievements: 0,
  recentActivity: [],
  userAchievements: []
}

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData>(emptyData)
  const [loading, setLoading] = useState(true)
  const { getUserId } = useAuth()

  useEffect(() => {
    async function loadProgress() {
      const userId = getUserId()
      if (!userId) {
        setLoading(false)
        return
      }

      try {
        // Check and grant achievements first
        await rankingService.checkAndGrantAchievements(userId).catch(() => {})

        const [courses, userProgress, achievements] = await Promise.all([
          courseService.getUserCoursesWithDetails(userId),
          getUserProgress(userId).catch(() => null),
          getUserAchievements(userId).catch(() => [])
        ])

        const totalCourses = courses.length
        const coursesCompleted = courses.filter(c => c.progress >= 100).length
        const overallProgress = totalCourses > 0
          ? Math.round(courses.reduce((sum, c) => sum + c.progress, 0) / totalCourses)
          : 0

        // Total study hours from course durations (approximate)
        const totalHours = Math.round(courses.reduce((sum, c) => sum + (c.total_hours || 0), 0))

        // Build activity from courses with most progress
        const recentActivity = courses
          .filter(c => c.progress > 0)
          .sort((a, b) => b.progress - a.progress)
          .slice(0, 5)
          .map(c => ({
            course: c.title,
            progress: c.progress,
            completed: c.progress >= 100,
            date: (c as any).updated_at || (c as any).created_at || new Date().toISOString(),
          }))

        // Build achievements list from real data
        const userAchievementsList = achievements.map(a => ({
          title: a.achievement?.name || 'Conquista',
          description: a.achievement?.description || '',
          earned: true
        }))

        setData({
          overallProgress,
          coursesCompleted,
          totalCourses,
          studyTime: totalHours,
          streak: userProgress?.current_streak_days || 0,
          achievements: achievements.length,
          recentActivity,
          userAchievements: userAchievementsList.length > 0
            ? userAchievementsList.slice(0, 6)
            : []
        })
      } catch (error) {
        logger.error('Erro ao carregar progresso:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProgress()
  }, [getUserId])

  if (loading) {
    return <SectionLoader />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Progresso</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe sua evolução</p>
      </div>

      {/* Overall Progress */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary-500/30">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{data.overallProgress}%</div>
            <div className="text-xs text-muted-foreground">Progresso Geral</div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-green-500/30">
          <CardContent className="p-4 text-center">
            <BookOpen className="h-5 w-5 text-green-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">
              {data.totalCourses > 0 ? `${data.coursesCompleted}/${data.totalCourses}` : '0'}
            </div>
            <div className="text-xs text-muted-foreground">Cursos</div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-500/30">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 text-blue-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{data.studyTime}h</div>
            <div className="text-xs text-muted-foreground">Tempo de Estudo</div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-yellow-500/30">
          <CardContent className="p-4 text-center">
            <Award className="h-5 w-5 text-yellow-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{data.achievements}</div>
            <div className="text-xs text-muted-foreground">Conquistas</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
        <CardHeader>
          <CardTitle>Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma atividade recente. Comece a estudar para ver seu progresso aqui.
            </div>
          ) : (
            <div className="space-y-3">
              {data.recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/20 transition-all duration-200",
                    index % 2 === 1 && "bg-muted/30"
                  )}
                >
                  {activity.completed ? (
                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-primary shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-foreground truncate">
                      {activity.course}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-20">
                      <Progress
                        value={activity.progress}
                        className="h-1.5"
                        indicatorClassName={cn(
                          activity.completed ? "bg-green-500" : "bg-primary"
                        )}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{activity.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Conquistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.userAchievements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma conquista desbloqueada ainda. Continue estudando para desbloquear conquistas.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.userAchievements.map((achievement, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-3 rounded-lg border transition-all duration-200",
                    achievement.earned
                      ? "border-green-300 dark:border-green-800 bg-green-500/5 hover:bg-green-500/10"
                      : "border-border/50 bg-muted/20 hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Star className={cn(
                      "h-4 w-4 shrink-0",
                      achievement.earned ? "text-green-500" : "text-muted-foreground"
                    )} />
                    <div className="flex-1 min-w-0">
                      <h4 className={cn(
                        "font-medium text-sm",
                        achievement.earned ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {achievement.title}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {achievement.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
