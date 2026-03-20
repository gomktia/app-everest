import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { SectionLoader } from '@/components/SectionLoader'
import { useAuth } from '@/hooks/use-auth'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import {
  getSystemStats,
  getUserGrowthData,
  getWeeklyActivityData,
  type SystemStats,
  type UserGrowthData,
  type ActivityDataPoint
} from '@/services/adminStatsService'
import {
  BarChart3,
  Users,
  BookOpen,
  FileText,
  TrendingUp,
  Download,
  Target,
  Award,
  Clock,
  TrendingDown
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageTabs } from '@/components/PageTabs'
import { logger } from '@/lib/logger'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export default function AdminReportsPage() {
  usePageTitle('Relatórios')
  const { isAdmin } = useAuth()
  const { isTeacher } = useTeacherClasses()
  const [dateRange, setDateRange] = useState('30d')
  const [reportTab, setReportTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [userGrowthData, setUserGrowthData] = useState<UserGrowthData[]>([])
  const [weeklyActivityData, setWeeklyActivityData] = useState<ActivityDataPoint[]>([])

  const rangeDays = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        if (isTeacher) {
          // Teachers should not see platform-wide stats
          setStats(null)
          setUserGrowthData([])
          setWeeklyActivityData([])
        } else {
          const [statsData, growthData, activityData] = await Promise.all([
            getSystemStats().catch(() => null),
            getUserGrowthData(rangeDays).catch(() => []),
            getWeeklyActivityData(rangeDays).catch(() => [])
          ])
          setStats(statsData)
          setUserGrowthData(growthData)
          setWeeklyActivityData(activityData)
        }
      } catch (error) {
        logger.error('Erro ao carregar dados dos relatorios:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [rangeDays, isTeacher])

  const handleExport = () => {
    const rows: string[][] = []

    // Stats summary
    if (stats) {
      rows.push(['Métrica', 'Valor'])
      rows.push(['Total de Usuários', String(stats.totalUsers)])
      rows.push(['Alunos', String(stats.totalStudents)])
      rows.push(['Professores', String(stats.totalTeachers)])
      rows.push(['Administradores', String(stats.totalAdministrators)])
      rows.push(['Cursos', String(stats.totalCourses)])
      rows.push(['Flashcards', String(stats.totalFlashcards)])
      rows.push(['Quizzes', String(stats.totalQuizzes)])
      rows.push(['Redações', String(stats.totalEssays)])
      rows.push(['Turmas', String(stats.totalClasses)])
      rows.push(['Taxa de Conclusão', `${stats.completionRate}%`])
      rows.push([])
    }

    // User growth
    if (userGrowthData.length > 0) {
      rows.push(['Mês', 'Total Usuários', 'Ativos'])
      for (const d of userGrowthData) {
        rows.push([d.month, String(d.usuarios), String(d.ativos)])
      }
      rows.push([])
    }

    // Weekly activity
    if (weeklyActivityData.length > 0) {
      rows.push(['Dia', 'Atividades'])
      for (const d of weeklyActivityData) {
        rows.push([d.day, String(d.atividades)])
      }
    }

    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-everest-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const statsCards = [
    {
      title: 'Total de Usuários',
      value: stats ? stats.totalUsers.toLocaleString('pt-BR') : '0',
      icon: Users,
      bgColor: 'bg-blue-100 dark:bg-blue-950/50',
      borderColor: 'border-blue-300 dark:border-blue-800',
      iconColor: 'text-blue-500'
    },
    {
      title: 'Cursos',
      value: stats ? stats.totalCourses.toLocaleString('pt-BR') : '0',
      icon: BookOpen,
      bgColor: 'bg-green-100 dark:bg-green-950/50',
      borderColor: 'border-green-300 dark:border-green-800',
      iconColor: 'text-green-500'
    },
    {
      title: 'Redações',
      value: stats ? stats.totalEssays.toLocaleString('pt-BR') : '0',
      icon: FileText,
      bgColor: 'bg-purple-100 dark:bg-purple-950/50',
      borderColor: 'border-purple-300 dark:border-purple-800',
      iconColor: 'text-purple-500'
    },
    {
      title: 'Taxa de Conclusão',
      value: stats ? `${stats.completionRate}%` : '0%',
      icon: Target,
      bgColor: 'bg-orange-100 dark:bg-orange-950/50',
      borderColor: 'border-orange-300 dark:border-orange-800',
      iconColor: 'text-orange-500'
    }
  ]

  if (loading) {
    return <SectionLoader />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios e Análises</h1>
        <p className="text-muted-foreground">Visualize métricas e estatísticas detalhadas da plataforma</p>
      </div>

      {isTeacher && (
        <Card className="border-border shadow-sm">
          <CardContent className="p-0">
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Relatórios globais disponíveis apenas para administradores</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Para ver dados específicos dos seus alunos, acesse a página de Redações ou Turmas.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isTeacher && <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        {/* Header Actions */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <Tabs value={dateRange} onValueChange={setDateRange} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="7d">7 dias</TabsTrigger>
              <TabsTrigger value="30d">30 dias</TabsTrigger>
              <TabsTrigger value="90d">90 dias</TabsTrigger>
              <TabsTrigger value="1y">1 ano</TabsTrigger>
            </TabsList>
          </Tabs>

          {isAdmin && (
            <Button onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {statsCards.map((stat, index) => (
            <Card key={index} className="border-border shadow-sm">
              <CardContent className="p-5">
                <div className="space-y-3 md:space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 md:p-3 rounded-xl md:rounded-2xl ${stat.bgColor} border ${stat.borderColor}`}>
                      <stat.icon className={`h-4 w-4 md:h-6 md:w-6 ${stat.iconColor}`} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">{stat.title}</p>
                    <h3 className="text-xl md:text-3xl font-bold text-foreground mt-1">{stat.value}</h3>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Reports */}
        <PageTabs
          value={reportTab}
          onChange={setReportTab}
          layout={3}
          tabs={[
            {
              value: 'overview',
              label: 'Visão Geral',
              content: (
                <div className="space-y-6">
                  <Card className="border-border shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg md:text-xl text-foreground">
                        <BarChart3 className="h-5 w-5" />
                        Resumo
                      </CardTitle>
                      <CardDescription className="text-xs md:text-sm">
                        Principais indicadores da plataforma
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            Alunos
                          </div>
                          <p className="text-xl md:text-2xl font-bold text-foreground">
                            {stats ? stats.totalStudents.toLocaleString('pt-BR') : '0'}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                            <Award className="h-4 w-4" />
                            Quizzes
                          </div>
                          <p className="text-xl md:text-2xl font-bold text-foreground">
                            {stats ? stats.totalQuizzes.toLocaleString('pt-BR') : '0'}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                            <TrendingUp className="h-4 w-4" />
                            Flashcards
                          </div>
                          <p className="text-xl md:text-2xl font-bold text-foreground">
                            {stats ? stats.totalFlashcards.toLocaleString('pt-BR') : '0'}
                          </p>
                        </div>
                      </div>

                      {userGrowthData.length > 0 && (
                        <div className="h-[250px] md:h-[350px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={userGrowthData}>
                              <defs>
                                <linearGradient id="colorUsuarios" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorAtivos" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                              <XAxis dataKey="month" fontSize={12} />
                              <YAxis fontSize={12} />
                              <Tooltip />
                              <Legend />
                              <Area
                                type="monotone"
                                dataKey="usuarios"
                                stroke="#3b82f6"
                                fillOpacity={1}
                                fill="url(#colorUsuarios)"
                                name="Total Usuarios"
                              />
                              <Area
                                type="monotone"
                                dataKey="ativos"
                                stroke="#10b981"
                                fillOpacity={1}
                                fill="url(#colorAtivos)"
                                name="Usuarios Ativos"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Atividade Semanal */}
                  {weeklyActivityData.length > 0 && (
                    <Card className="border-border shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base md:text-lg text-foreground">Atividade Semanal</CardTitle>
                        <CardDescription className="text-xs md:text-sm">Atividades por dia da semana</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[250px] md:h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyActivityData}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                              <XAxis dataKey="day" fontSize={12} />
                              <YAxis fontSize={12} />
                              <Tooltip />
                              <Bar dataKey="atividades" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Atividades" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ),
            },
            {
              value: 'users',
              label: 'Usuários',
              content: (
                <div className="space-y-6">
                  <Card className="border-border shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base md:text-lg text-foreground">
                        <Users className="h-5 w-5" />
                        Crescimento de Usuários
                      </CardTitle>
                      <CardDescription className="text-xs md:text-sm">
                        Total vs Ativos por mes
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {userGrowthData.length > 0 ? (
                        <div className="h-[300px] md:h-[400px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={userGrowthData}>
                              <defs>
                                <linearGradient id="colorUsuarios2" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                              <XAxis dataKey="month" fontSize={12} />
                              <YAxis fontSize={12} />
                              <Tooltip />
                              <Legend />
                              <Area type="monotone" dataKey="usuarios" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUsuarios2)" name="Total" />
                              <Area type="monotone" dataKey="ativos" stroke="#10b981" fill="transparent" name="Ativos" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          Sem dados de crescimento disponiveis.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Distribuicao por Papel */}
                  <Card className="border-border shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base md:text-lg text-foreground">Distribuição de Usuários</CardTitle>
                      <CardDescription className="text-xs md:text-sm">Por papel na plataforma</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 rounded-xl bg-blue-100 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-800">
                          <div className="text-2xl font-bold text-blue-600">
                            {stats ? stats.totalStudents : 0}
                          </div>
                          <div className="text-sm text-muted-foreground">Alunos</div>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-green-100 dark:bg-green-950/50 border border-green-300 dark:border-green-800">
                          <div className="text-2xl font-bold text-green-600">
                            {stats ? stats.totalTeachers : 0}
                          </div>
                          <div className="text-sm text-muted-foreground">Professores</div>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-purple-100 dark:bg-purple-950/50 border border-purple-300 dark:border-purple-800">
                          <div className="text-2xl font-bold text-purple-600">
                            {stats ? stats.totalAdministrators : 0}
                          </div>
                          <div className="text-sm text-muted-foreground">Administradores</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ),
            },
            {
              value: 'content',
              label: 'Conteúdo',
              content: (
                <Card className="border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg text-foreground">
                      <BookOpen className="h-5 w-5" />
                      Conteúdo da Plataforma
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                      Totais por tipo de recurso
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 rounded-xl bg-blue-100 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-800">
                        <div className="text-2xl font-bold text-blue-600">
                          {stats ? stats.totalCourses : 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Cursos</div>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-green-100 dark:bg-green-950/50 border border-green-300 dark:border-green-800">
                        <div className="text-2xl font-bold text-green-600">
                          {stats ? stats.totalFlashcards : 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Flashcards</div>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-purple-100 dark:bg-purple-950/50 border border-purple-300 dark:border-purple-800">
                        <div className="text-2xl font-bold text-purple-600">
                          {stats ? stats.totalQuizzes : 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Quizzes</div>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-orange-100 dark:bg-orange-950/50 border border-orange-300 dark:border-orange-800">
                        <div className="text-2xl font-bold text-orange-600">
                          {stats ? stats.totalEssays : 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Redações</div>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-pink-100 dark:bg-pink-950/50 border border-pink-200 dark:border-pink-800">
                        <div className="text-2xl font-bold text-pink-600">
                          {stats ? stats.totalAudioCourses : 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Audio Cursos</div>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-cyan-100 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800">
                        <div className="text-2xl font-bold text-cyan-600">
                          {stats ? stats.totalClasses : 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Turmas</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ),
            },
          ]}
        />
      </div>}
    </div>
  )
}
