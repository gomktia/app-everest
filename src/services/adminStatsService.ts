import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export interface SystemStats {
  totalUsers: number
  totalStudents: number
  totalTeachers: number
  totalAdministrators: number
  totalClasses: number
  totalCourses: number
  totalFlashcards: number
  totalQuizzes: number
  totalEssays: number
  totalAudioCourses: number
  activeUsers: number
  completionRate: number
}

export async function getSystemStats(): Promise<SystemStats> {
  try {
    // Try RPC first (1 query instead of 12)
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_system_stats')

    if (!rpcError && rpcData) {
      const d = rpcData as any
      return {
        totalUsers: d.total_users || 0,
        totalStudents: d.total_students || 0,
        totalTeachers: d.total_teachers || 0,
        totalAdministrators: d.total_administrators || 0,
        totalClasses: d.total_classes || 0,
        totalCourses: d.total_courses || 0,
        totalFlashcards: d.total_flashcards || 0,
        totalQuizzes: d.total_quizzes || 0,
        totalEssays: d.total_essays || 0,
        totalAudioCourses: d.total_audio_courses || 0,
        activeUsers: d.active_users || 0,
        completionRate: d.completion_rate || 0,
      }
    }

    // Fallback: consolidated parallel queries
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const [
      usersResult, classesResult, coursesResult,
      flashcardsResult, quizzesResult, essaysResult,
      audioCoursesResult,
      studentsResult, teachersResult, adminsResult,
      completedResult, totalProgressResult,
      activeUsersResult
    ] = await Promise.all([
      supabase.from('users').select('role', { count: 'exact', head: true }),
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      supabase.from('video_courses').select('id', { count: 'exact', head: true }),
      supabase.from('flashcards').select('id', { count: 'exact', head: true }),
      supabase.from('quizzes').select('id', { count: 'exact', head: true }),
      supabase.from('essays').select('id', { count: 'exact', head: true }),
      supabase.from('audio_courses').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'administrator'),
      supabase.from('video_progress').select('id', { count: 'exact', head: true }).eq('is_completed', true),
      supabase.from('video_progress').select('id', { count: 'exact', head: true }),
      supabase.from('user_sessions').select('user_id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo.toISOString()),
    ])

    const completionRate = (totalProgressResult.count || 0) > 0
      ? Math.round(((completedResult.count || 0) / (totalProgressResult.count || 1)) * 100)
      : 0

    return {
      totalUsers: usersResult.count || 0,
      totalStudents: studentsResult.count || 0,
      totalTeachers: teachersResult.count || 0,
      totalAdministrators: adminsResult.count || 0,
      totalClasses: classesResult.count || 0,
      totalCourses: coursesResult.count || 0,
      totalFlashcards: flashcardsResult.count || 0,
      totalQuizzes: quizzesResult.count || 0,
      totalEssays: essaysResult.count || 0,
      totalAudioCourses: audioCoursesResult.count || 0,
      activeUsers: activeUsersResult.count || 0,
      completionRate
    }
  } catch (error) {
    logger.error('Error fetching system stats:', error)
    throw error
  }
}


export interface UserGrowthData {
  month: string
  usuarios: number
  ativos: number
}

export async function getUserGrowthData(days: number = 180): Promise<UserGrowthData[]> {
  try {
    const monthCount = Math.max(1, Math.ceil(days / 30))
    const now = new Date()
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1), 1)

    // 2 queries total instead of 2×N per month
    const [usersResult, sessionsResult] = await Promise.all([
      supabase
        .from('users')
        .select('created_at')
        .order('created_at'),
      supabase
        .from('user_sessions')
        .select('created_at')
        .gte('created_at', rangeStart.toISOString())
        .limit(10000),
    ])

    const users = usersResult.data || []
    const sessions = sessionsResult.data || []

    const result: UserGrowthData[] = []

    for (let i = monthCount - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const nextDateISO = nextDate.toISOString()
      const dateISO = date.toISOString()

      // Count users created before end of this month
      const totalUsers = users.filter(u => u.created_at <= nextDateISO).length

      // Count sessions in this month
      const activeUsers = sessions.filter(s =>
        s.created_at >= dateISO && s.created_at < nextDateISO
      ).length

      result.push({
        month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        usuarios: totalUsers,
        ativos: activeUsers,
      })
    }

    return result
  } catch (error) {
    logger.error('Error fetching user growth data:', error)
    return [
      { month: 'Jan', usuarios: 0, ativos: 0 },
      { month: 'Fev', usuarios: 0, ativos: 0 },
      { month: 'Mar', usuarios: 0, ativos: 0 },
      { month: 'Abr', usuarios: 0, ativos: 0 },
      { month: 'Mai', usuarios: 0, ativos: 0 },
      { month: 'Jun', usuarios: 0, ativos: 0 },
    ]
  }
}

export interface ActivityDataPoint {
  day: string
  atividades: number
}

export async function getWeeklyActivityData(rangeDays: number = 7): Promise<ActivityDataPoint[]> {
  try {
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

    const now = new Date()
    const rangeStart = new Date(now)
    rangeStart.setDate(now.getDate() - rangeDays)
    rangeStart.setHours(0, 0, 0, 0)

    const rangeStartISO = rangeStart.toISOString()

    // 3 queries total for entire range instead of 3×N per day
    const [sessions, quizAttempts, flashcardSessions] = await Promise.all([
      supabase
        .from('user_sessions')
        .select('created_at')
        .gte('created_at', rangeStartISO)
        .limit(5000),
      supabase
        .from('quiz_attempts')
        .select('created_at')
        .gte('created_at', rangeStartISO)
        .limit(5000),
      supabase
        .from('flashcard_session_history')
        .select('started_at')
        .gte('started_at', rangeStartISO)
        .limit(5000),
    ])

    // Aggregate by day-of-week in memory
    const dayTotals = [0, 0, 0, 0, 0, 0, 0]

    for (const s of sessions.data || []) {
      dayTotals[new Date(s.created_at).getDay()]++
    }
    for (const q of quizAttempts.data || []) {
      dayTotals[new Date(q.created_at).getDay()]++
    }
    for (const f of flashcardSessions.data || []) {
      dayTotals[new Date(f.started_at).getDay()]++
    }

    return dayNames.map((day, i) => ({ day, atividades: dayTotals[i] }))
  } catch (error) {
    logger.error('Error fetching weekly activity data:', error)
    return [
      { day: 'Dom', atividades: 0 },
      { day: 'Seg', atividades: 0 },
      { day: 'Ter', atividades: 0 },
      { day: 'Qua', atividades: 0 },
      { day: 'Qui', atividades: 0 },
      { day: 'Sex', atividades: 0 },
      { day: 'Sab', atividades: 0 },
    ]
  }
}

export interface RecentActivity {
  type: string
  message: string
  time: string
  icon: string
  timestamp: Date
}

export async function getRecentActivities(limit: number = 5): Promise<RecentActivity[]> {
  try {
    const activities: RecentActivity[] = []

    // Get recent user signups
    const { data: recentUsers } = await supabase
      .from('users')
      .select('created_at, role')
      .order('created_at', { ascending: false })
      .limit(2)

    if (recentUsers) {
      recentUsers.forEach(user => {
        activities.push({
          type: 'user',
          message: user.role === 'student' ? 'Novo aluno cadastrado' : 'Novo usuário cadastrado',
          time: getRelativeTime(new Date(user.created_at)),
          icon: 'Users',
          timestamp: new Date(user.created_at)
        })
      })
    }

    // Get pending essays
    const { count: pendingEssays } = await supabase
      .from('essays')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'submitted')

    if (pendingEssays && pendingEssays > 0) {
      activities.push({
        type: 'essay',
        message: `${pendingEssays} redações aguardando correção`,
        time: 'Agora',
        icon: 'FileText',
        timestamp: new Date()
      })
    }

    // Get recent courses
    const { data: recentCourses } = await supabase
      .from('video_courses')
      .select('name, created_at')
      .order('created_at', { ascending: false })
      .limit(1)

    if (recentCourses && recentCourses.length > 0) {
      activities.push({
        type: 'course',
        message: `Curso "${(recentCourses[0] as any).name}" publicado`,
        time: getRelativeTime(new Date(recentCourses[0].created_at)),
        icon: 'BookOpen',
        timestamp: new Date(recentCourses[0].created_at)
      })
    }

    // Get recent achievements
    const { count: todayAchievements } = await supabase
      .from('user_achievements')
      .select('*', { count: 'exact', head: true })
      .gte('achieved_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())

    if (todayAchievements && todayAchievements > 0) {
      activities.push({
        type: 'achievement',
        message: `${todayAchievements} conquistas desbloqueadas hoje`,
        time: 'Hoje',
        icon: 'Award',
        timestamp: new Date()
      })
    }

    // Get recent classes
    const { data: recentClasses } = await supabase
      .from('classes')
      .select('name, created_at')
      .order('created_at', { ascending: false })
      .limit(1)

    if (recentClasses && recentClasses.length > 0) {
      activities.push({
        type: 'class',
        message: `Nova turma "${recentClasses[0].name}" criada`,
        time: getRelativeTime(new Date(recentClasses[0].created_at)),
        icon: 'GraduationCap',
        timestamp: new Date(recentClasses[0].created_at)
      })
    }

    // Sort by timestamp and return top N
    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  } catch (error) {
    logger.error('Error fetching recent activities:', error)
    return []
  }
}

export interface Alert {
  type: 'warning' | 'info' | 'error'
  message: string
  action?: string | null
  link?: string | null
}

export async function getSystemAlerts(): Promise<Alert[]> {
  try {
    const alerts: Alert[] = []

    // Check for pending essays over 48h
    const twoDaysAgo = new Date()
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48)

    const { count: oldPendingEssays } = await supabase
      .from('essays')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'submitted')
      .lt('created_at', twoDaysAgo.toISOString())

    if (oldPendingEssays && oldPendingEssays > 0) {
      alerts.push({
        type: 'warning',
        message: `${oldPendingEssays} redações pendentes há mais de 48h`,
        action: 'Ver redações',
        link: '/admin/essays'
      })
    }

    // Check for inactive users
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { count: inactiveUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .lt('last_seen_at', thirtyDaysAgo.toISOString())
      .eq('role', 'student')

    if (inactiveUsers && inactiveUsers > 10) {
      alerts.push({
        type: 'info',
        message: `${inactiveUsers} alunos inativos há mais de 30 dias`,
        action: 'Ver usuários',
        link: '/admin/users'
      })
    }

    // Only show success message if there are no warnings
    if (alerts.length === 0) {
      alerts.push({
        type: 'info',
        message: 'Sistema funcionando normalmente',
        action: null,
        link: null
      })
    }

    return alerts
  } catch (error) {
    logger.error('Error fetching system alerts:', error)
    return [{
      type: 'info',
      message: 'Sistema funcionando normalmente',
      action: null,
      link: null
    }]
  }
}

export interface KPIChange {
  current: number
  previous: number
  change: string
  trend: 'up' | 'down' | 'stable'
}

export async function getKPIChanges(): Promise<{
  users: KPIChange
  activeUsers: KPIChange
  classes: KPIChange
  completionRate: KPIChange
}> {
  try {
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthISO = thisMonth.toISOString()
    const lastMonthISO = lastMonth.toISOString()

    // All 6 queries in parallel instead of sequential
    const [
      currentUsersR, lastMonthUsersR,
      currentActiveR, lastMonthActiveR,
      currentClassesR, lastMonthClassesR,
    ] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).lt('created_at', thisMonthISO),
      supabase.from('user_sessions').select('user_id', { count: 'exact', head: true }).gte('created_at', thisMonthISO),
      supabase.from('user_sessions').select('user_id', { count: 'exact', head: true }).gte('created_at', lastMonthISO).lt('created_at', thisMonthISO),
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      supabase.from('classes').select('id', { count: 'exact', head: true }).lt('created_at', thisMonthISO),
    ])

    const usersChange = calculateChange(currentUsersR.count || 0, lastMonthUsersR.count || 0)
    const activeChange = calculateChange(currentActiveR.count || 0, lastMonthActiveR.count || 0)
    const classesChange = calculateChange(currentClassesR.count || 0, lastMonthClassesR.count || 0)

    // Completion rate - simplified
    const completionChange = {
      current: 0,
      previous: 0,
      change: '+0%',
      trend: 'stable' as const
    }

    return {
      users: usersChange,
      activeUsers: activeChange,
      classes: classesChange,
      completionRate: completionChange
    }
  } catch (error) {
    logger.error('Error calculating KPI changes:', error)
    return {
      users: { current: 0, previous: 0, change: '+0%', trend: 'stable' },
      activeUsers: { current: 0, previous: 0, change: '+0%', trend: 'stable' },
      classes: { current: 0, previous: 0, change: '+0%', trend: 'stable' },
      completionRate: { current: 0, previous: 0, change: '+0%', trend: 'stable' }
    }
  }
}

// Helper functions
function calculateChange(current: number, previous: number): KPIChange {
  if (previous === 0) {
    return {
      current,
      previous,
      change: current > 0 ? '+100%' : '0%',
      trend: current > 0 ? 'up' : 'stable'
    }
  }

  const percentChange = ((current - previous) / previous) * 100
  const roundedChange = Math.round(percentChange)

  return {
    current,
    previous,
    change: `${roundedChange > 0 ? '+' : ''}${roundedChange}%`,
    trend: roundedChange > 0 ? 'up' : roundedChange < 0 ? 'down' : 'stable'
  }
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Agora'
  if (diffMins < 60) return `${diffMins} min atrás`
  if (diffHours < 24) return `${diffHours} hora${diffHours > 1 ? 's' : ''} atrás`
  if (diffDays < 30) return `${diffDays} dia${diffDays > 1 ? 's' : ''} atrás`

  return date.toLocaleDateString('pt-BR')
}

