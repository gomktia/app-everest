import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SectionLoader } from '@/components/SectionLoader'
import {
  getSystemStats,
  getUserGrowthData,
  getWeeklyActivityData,
  getRecentActivities,
  getSystemAlerts,
  getKPIChanges,
  type SystemStats,
  type UserGrowthData,
  type ActivityDataPoint,
  type RecentActivity,
  type Alert,
} from '@/services/adminStatsService'
import {
  Shield,
  Users,
  GraduationCap,
  BookOpen,
  Brain,
  Target,
  FileText,
  Mic,
  TrendingUp,
  TrendingDown,
  Activity,
  Award,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function AdminDashboard() {
  usePageTitle('Dashboard Admin')
  const { profile } = useAuth()
  const { classIds, studentIds, isTeacher, loading: teacherLoading, error: teacherError } = useTeacherClasses()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalAdministrators: 0,
    totalClasses: 0,
    totalCourses: 0,
    totalFlashcards: 0,
    totalQuizzes: 0,
    totalEssays: 0,
    totalAudioCourses: 0,
    activeUsers: 0,
    completionRate: 0,
  })
  const [userGrowthData, setUserGrowthData] = useState<UserGrowthData[]>([])
  const [activityData, setActivityData] = useState<ActivityDataPoint[]>([])
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [kpiChanges, setKpiChanges] = useState({
    users: { current: 0, previous: 0, change: '+0%', trend: 'stable' as const },
    activeUsers: { current: 0, previous: 0, change: '+0%', trend: 'stable' as const },
    classes: { current: 0, previous: 0, change: '+0%', trend: 'stable' as const },
    completionRate: { current: 0, previous: 0, change: '+0%', trend: 'stable' as const },
  })

  useEffect(() => {
    // Wait for teacher context to finish loading before fetching data
    if (teacherLoading) return
    if (isTeacher) {
      loadTeacherData()
    } else {
      loadAllData()
    }
  }, [teacherLoading, isTeacher, classIds.length, studentIds.length])

  // ----- Teacher-specific data loading -----
  const loadTeacherData = async () => {
    try {
      let pendingEssaysCount = 0
      let totalEssaysCount = 0
      let completionRate = 0

      if (studentIds.length > 0) {
        const [pendingR, totalEssaysR, completedR, totalProgressR] = await Promise.all([
          supabase.from('essays').select('id', { count: 'exact', head: true }).in('student_id', studentIds).eq('status', 'submitted'),
          supabase.from('essays').select('id', { count: 'exact', head: true }).in('student_id', studentIds),
          supabase.from('video_progress').select('id', { count: 'exact', head: true }).in('user_id', studentIds).eq('is_completed', true),
          supabase.from('video_progress').select('id', { count: 'exact', head: true }).in('user_id', studentIds),
        ])
        pendingEssaysCount = pendingR.count || 0
        totalEssaysCount = totalEssaysR.count || 0
        const total = totalProgressR.count || 0
        const completed = completedR.count || 0
        completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
      }

      setStats({
        totalUsers: studentIds.length,
        totalStudents: studentIds.length,
        totalTeachers: 0,
        totalAdministrators: 0,
        totalClasses: classIds.length,
        totalCourses: 0,
        totalFlashcards: 0,
        totalQuizzes: 0,
        totalEssays: totalEssaysCount,
        totalAudioCourses: 0,
        activeUsers: studentIds.length,
        completionRate,
      })

      // Teacher KPI: students, pending essays, classes, completion rate
      setKpiChanges({
        users: { current: studentIds.length, previous: 0, change: '', trend: 'stable' },
        activeUsers: { current: pendingEssaysCount, previous: 0, change: pendingEssaysCount > 0 ? `${pendingEssaysCount}` : '0', trend: pendingEssaysCount > 0 ? 'up' : 'stable' },
        classes: { current: classIds.length, previous: 0, change: '', trend: 'stable' },
        completionRate: { current: completionRate, previous: 0, change: '', trend: 'stable' },
      })

      // Recent activities filtered to teacher's students
      const teacherActivities: RecentActivity[] = []

      if (studentIds.length > 0) {
        // Recent essays submitted by teacher's students
        const { data: recentEssays } = await supabase
          .from('essays')
          .select('created_at, status, student_id, users:student_id(first_name, last_name)')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false })
          .limit(3)

        if (recentEssays) {
          for (const essay of recentEssays) {
            const statusLabel = essay.status === 'submitted' ? 'enviada' : essay.status === 'corrected' ? 'corrigida' : essay.status
            const student = essay.users as any
            const studentName = student ? `${student.first_name} ${student.last_name}` : 'aluno'
            teacherActivities.push({
              type: 'essay',
              message: `Redação ${statusLabel} por ${studentName}`,
              time: getRelativeTime(new Date(essay.created_at)),
              icon: 'FileText',
              timestamp: new Date(essay.created_at),
            })
          }
        }

        // Recent achievements by teacher's students
        const { count: todayAchievements } = await supabase
          .from('user_achievements')
          .select('*', { count: 'exact', head: true })
          .in('user_id', studentIds)
          .gte('achieved_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())

        if (todayAchievements && todayAchievements > 0) {
          teacherActivities.push({
            type: 'achievement',
            message: `${todayAchievements} conquistas desbloqueadas hoje pelos seus alunos`,
            time: 'Hoje',
            icon: 'Award',
            timestamp: new Date(),
          })
        }
      }

      setRecentActivities(
        teacherActivities
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 5)
      )

      // Teacher alerts: pending essays older than 48h
      const teacherAlerts: Alert[] = []
      if (studentIds.length > 0) {
        const twoDaysAgo = new Date()
        twoDaysAgo.setHours(twoDaysAgo.getHours() - 48)
        const { count: oldPending } = await supabase
          .from('essays')
          .select('*', { count: 'exact', head: true })
          .in('student_id', studentIds)
          .eq('status', 'submitted')
          .lt('created_at', twoDaysAgo.toISOString())

        if (oldPending && oldPending > 0) {
          teacherAlerts.push({
            type: 'warning',
            message: `${oldPending} redacoes pendentes ha mais de 48h`,
            action: 'Ver redacoes',
            link: '/admin/essays',
          })
        }
      }
      setAlerts(teacherAlerts)

      // Skip charts that don't apply to teacher scope
      setUserGrowthData([])
      setActivityData([])
    } catch (error) {
      logger.error('Error loading teacher dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Helper to format relative time (used in teacher data loading)
  const getRelativeTime = (date: Date): string => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'Agora'
    if (diffMins < 60) return `${diffMins} min atras`
    if (diffHours < 24) return `${diffHours} hora${diffHours > 1 ? 's' : ''} atras`
    if (diffDays < 30) return `${diffDays} dia${diffDays > 1 ? 's' : ''} atras`
    return date.toLocaleDateString('pt-BR')
  }

  // ----- Admin data loading (unchanged) -----
  const loadAllData = async () => {
    try {
      const [
        statsData,
        growthData,
        weeklyData,
        activitiesData,
        alertsData,
        kpiData
      ] = await Promise.all([
        getSystemStats(),
        getUserGrowthData(),
        getWeeklyActivityData(),
        getRecentActivities(),
        getSystemAlerts(),
        getKPIChanges()
      ])

      setStats(statsData)
      setUserGrowthData(growthData)
      setActivityData(weeklyData)
      setRecentActivities(activitiesData)
      setAlerts(alertsData)
      setKpiChanges(kpiData)
    } catch (error) {
      logger.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const contentDistribution = [
    { name: 'Flashcards', value: stats.totalFlashcards },
    { name: 'Quizzes', value: stats.totalQuizzes },
    { name: 'Redacoes', value: stats.totalEssays },
    { name: 'Cursos', value: stats.totalCourses },
    { name: 'Audio', value: stats.totalAudioCourses },
  ]

  const mainKPIs = isTeacher
    ? [
        {
          label: 'Meus Alunos',
          value: stats.totalStudents,
          change: kpiChanges.users.change,
          trend: kpiChanges.users.trend,
          icon: Users,
          color: 'text-blue-600',
          bg: 'bg-blue-500/10',
        },
        {
          label: 'Redacoes Pendentes',
          value: kpiChanges.activeUsers.current,
          change: kpiChanges.activeUsers.change,
          trend: kpiChanges.activeUsers.trend,
          icon: FileText,
          color: 'text-emerald-600',
          bg: 'bg-emerald-500/10',
        },
        {
          label: 'Minhas Turmas',
          value: stats.totalClasses,
          change: kpiChanges.classes.change,
          trend: kpiChanges.classes.trend,
          icon: GraduationCap,
          color: 'text-violet-600',
          bg: 'bg-violet-500/10',
        },
        {
          label: 'Taxa de Conclusao',
          value: `${stats.completionRate}%`,
          change: kpiChanges.completionRate.change,
          trend: kpiChanges.completionRate.trend,
          icon: CheckCircle,
          color: 'text-amber-600',
          bg: 'bg-amber-500/10',
        },
      ]
    : [
        {
          label: 'Usuarios Totais',
          value: stats.totalUsers,
          change: kpiChanges.users.change,
          trend: kpiChanges.users.trend,
          icon: Users,
          color: 'text-blue-600',
          bg: 'bg-blue-500/10',
        },
        {
          label: 'Usuarios Ativos',
          value: stats.activeUsers,
          change: kpiChanges.activeUsers.change,
          trend: kpiChanges.activeUsers.trend,
          icon: Activity,
          color: 'text-emerald-600',
          bg: 'bg-emerald-500/10',
        },
        {
          label: 'Turmas Ativas',
          value: stats.totalClasses,
          change: kpiChanges.classes.change,
          trend: kpiChanges.classes.trend,
          icon: GraduationCap,
          color: 'text-violet-600',
          bg: 'bg-violet-500/10',
        },
        {
          label: 'Taxa de Conclusao',
          value: `${stats.completionRate}%`,
          change: kpiChanges.completionRate.change,
          trend: kpiChanges.completionRate.trend,
          icon: CheckCircle,
          color: 'text-amber-600',
          bg: 'bg-amber-500/10',
        },
      ]

  const contentStats = [
    { label: 'Cursos', value: stats.totalCourses, icon: BookOpen, color: 'text-blue-600' },
    { label: 'Flashcards', value: stats.totalFlashcards, icon: Brain, color: 'text-violet-600' },
    { label: 'Quizzes', value: stats.totalQuizzes, icon: Target, color: 'text-emerald-600' },
    { label: 'Redacoes', value: stats.totalEssays, icon: FileText, color: 'text-rose-600' },
    { label: 'Evercast', value: stats.totalAudioCourses, icon: Mic, color: 'text-amber-600' },
  ]

  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, any> = {
      Users,
      FileText,
      BookOpen,
      Award,
      GraduationCap,
    }
    return iconMap[iconName] || Activity
  }

  if (loading || teacherLoading) {
    return <SectionLoader />
  }

  if (teacherError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-amber-500" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Perfil de Professor Incompleto</h3>
        <p className="text-muted-foreground max-w-md">{teacherError}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Bem-vindo, {profile?.first_name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isTeacher ? 'Visao geral das suas turmas' : 'Visao geral da plataforma'}
          </p>
        </div>
        <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-700 w-fit">
          <Activity className="h-3 w-3 mr-1.5" />
          Sistema Online
        </Badge>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border text-sm",
                alert.type === 'warning'
                  ? "bg-amber-100 border-amber-400 text-amber-900"
                  : "bg-blue-100 border-blue-400 text-blue-900"
              )}
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{alert.message}</p>
                {alert.action && (
                  <Link to={alert.link || '#'} className="text-xs underline mt-1 inline-block opacity-80 hover:opacity-100">
                    {alert.action}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mainKPIs.map((kpi, index) => (
          <Card key={index} className="border-border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={cn('p-2 rounded-lg', kpi.bg)}>
                  <kpi.icon className={cn('h-4 w-4', kpi.color)} />
                </div>
                <span className={cn(
                  "text-xs font-medium flex items-center gap-1",
                  kpi.trend === 'up' ? 'text-emerald-600' : kpi.trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
                )}>
                  {kpi.trend === 'up' && <TrendingUp className="h-3 w-3" />}
                  {kpi.trend === 'down' && <TrendingDown className="h-3 w-3" />}
                  {kpi.change}
                </span>
              </div>
              <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{kpi.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Grid - Admin only */}
      {!isTeacher && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* User Growth */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-base font-semibold text-foreground">Crescimento de Usuarios</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">Ultimos 6 meses</p>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={userGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" fontSize={12} stroke="#9ca3af" />
                    <YAxis fontSize={12} stroke="#9ca3af" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="usuarios" stroke="#3b82f6" strokeWidth={2} name="Total" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="ativos" stroke="#10b981" strokeWidth={2} name="Ativos" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Content Distribution */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-violet-600" />
                <CardTitle className="text-base font-semibold text-foreground">Distribuicao de Conteudo</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">Por tipo de recurso</p>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={contentDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {contentDistribution.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Activity */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-base font-semibold text-foreground">Atividade Semanal</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">Interacoes dos usuarios</p>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" fontSize={12} stroke="#9ca3af" />
                    <YAxis fontSize={12} stroke="#9ca3af" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="atividades" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Content Stats */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-600" />
                <CardTitle className="text-base font-semibold text-foreground">Conteudo da Plataforma</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">Recursos disponiveis</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {contentStats.map((stat, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <stat.icon className={cn("h-4 w-4", stat.color)} />
                      <span className="text-sm font-medium text-foreground/80">{stat.label}</span>
                    </div>
                    <span className="text-lg font-bold text-foreground">{stat.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Teacher-specific: Essay summary card */}
      {isTeacher && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-rose-600" />
              <CardTitle className="text-base font-semibold text-foreground">Resumo de Redacoes</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Redacoes dos seus alunos</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium text-foreground/80">Total de Redacoes</span>
                <span className="text-lg font-bold text-foreground">{stats.totalEssays}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10">
                <span className="text-sm font-medium text-amber-800">Aguardando Correcao</span>
                <span className="text-lg font-bold text-amber-800">{kpiChanges.activeUsers.current}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activities */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-semibold text-foreground">Atividades Recentes</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">Ultimas acoes no sistema</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity, index) => {
                const IconComponent = getIconComponent(activity.icon)
                return (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <IconComponent className="h-4 w-4 text-muted-foreground/70 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground/80">{activity.message}</p>
                      <p className="text-xs text-muted-foreground/70">{activity.time}</p>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-muted-foreground/70 text-center py-8">
                Nenhuma atividade recente
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
