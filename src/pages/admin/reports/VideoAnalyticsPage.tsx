import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SectionLoader } from '@/components/SectionLoader'
import { PageTabs } from '@/components/PageTabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getVideoAnalyticsOverview,
  getLessonAnalytics,
  getCourseAnalytics,
  getStudentProgressList,
  getWatchTrends,
  type VideoAnalyticsOverview,
  type LessonAnalytics,
  type CourseAnalytics,
  type StudentProgressEntry,
  type WatchTrendPoint,
} from '@/services/videoAnalyticsService'
import {
  Play,
  Users,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Search,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Eye,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useNavigate } from 'react-router-dom'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

function formatDuration(seconds: number): string {
  if (!seconds) return '0min'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

function VideoAnalyticsTabs({ courses, filteredLessons, students, searchTerm, setSearchTerm, showStudentTab = true }: {
  courses: CourseAnalytics[]
  filteredLessons: LessonAnalytics[]
  students: StudentProgressEntry[]
  searchTerm: string
  setSearchTerm: (v: string) => void
  showStudentTab?: boolean
}) {
  const [tab, setTab] = useState('courses')

  return (
    <PageTabs
      value={tab}
      onChange={setTab}
      tabs={[
        {
          value: 'courses',
          label: 'Por Curso',
          content: (
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-base font-semibold">Desempenho por Curso</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum curso encontrado</p>
                ) : (
                  <>
                    <div className="h-[250px] mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={courses.slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis type="number" fontSize={12} stroke="#9ca3af" />
                          <YAxis
                            dataKey="courseName"
                            type="category"
                            fontSize={11}
                            stroke="#9ca3af"
                            width={150}
                            tickFormatter={(v: string) => v.length > 20 ? v.substring(0, 20) + '...' : v}
                          />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                          <Legend />
                          <Bar dataKey="totalStudents" fill="#3b82f6" name="Alunos" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="completedLessons" fill="#10b981" name="Concluidas" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Curso</TableHead>
                          <TableHead className="text-center">Aulas</TableHead>
                          <TableHead className="text-center">Alunos</TableHead>
                          <TableHead className="text-center">Conclusao</TableHead>
                          <TableHead className="text-center">Horas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {courses.map(course => (
                          <TableRow key={course.courseId}>
                            <TableCell className="font-medium max-w-[200px] truncate">{course.courseName}</TableCell>
                            <TableCell className="text-center">{course.totalLessons}</TableCell>
                            <TableCell className="text-center">{course.totalStudents}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={cn(
                                'text-xs',
                                course.avgCompletionRate >= 70 ? 'bg-emerald-100 text-emerald-700' :
                                course.avgCompletionRate >= 40 ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              )}>
                                {course.avgCompletionRate}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">{course.totalWatchTimeHours}h</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          ),
        },
        {
          value: 'lessons',
          label: 'Por Aula',
          content: (
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4 text-violet-600" />
                    <CardTitle className="text-base font-semibold">Desempenho por Aula</CardTitle>
                  </div>
                  <div className="relative w-[250px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar aula..."
                      className="pl-8 h-9"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredLessons.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma aula encontrada</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">{filteredLessons.length} aulas</p>
                    <div className="max-h-[500px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Aula</TableHead>
                            <TableHead>Curso</TableHead>
                            <TableHead className="text-center">Views</TableHead>
                            <TableHead className="text-center">Conclusao</TableHead>
                            <TableHead className="text-center">Progresso Medio</TableHead>
                            <TableHead className="text-center">Tempo Medio</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredLessons.map(lesson => (
                            <TableRow key={lesson.lessonId}>
                              <TableCell className="font-medium max-w-[200px]">
                                <p className="truncate">{lesson.lessonTitle}</p>
                                <p className="text-xs text-muted-foreground truncate">{lesson.moduleName}</p>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                                {lesson.courseName}
                              </TableCell>
                              <TableCell className="text-center">{lesson.totalViews}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={cn(
                                  'text-xs',
                                  lesson.completionRate >= 70 ? 'bg-emerald-100 text-emerald-700' :
                                  lesson.completionRate >= 40 ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                )}>
                                  {lesson.completionRate}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">{lesson.avgProgressPercent}%</TableCell>
                              <TableCell className="text-center text-xs">
                                {formatDuration(lesson.avgWatchTimeSeconds)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ),
        },
        ...(showStudentTab ? [{
          value: 'students',
          label: 'Por Aluno',
          content: (
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-base font-semibold">Progresso dos Alunos</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">Top 20 alunos por aulas concluidas</p>
              </CardHeader>
              <CardContent>
                {students.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado de progresso</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Aluno</TableHead>
                        <TableHead className="text-center">Iniciadas</TableHead>
                        <TableHead className="text-center">Concluidas</TableHead>
                        <TableHead className="text-center">Conclusao</TableHead>
                        <TableHead className="text-center">Horas</TableHead>
                        <TableHead className="text-center">Ultima Atividade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student, i) => (
                        <TableRow key={student.userId}>
                          <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{student.firstName} {student.lastName}</p>
                            <p className="text-xs text-muted-foreground">{student.email}</p>
                          </TableCell>
                          <TableCell className="text-center">{student.lessonsStarted}</TableCell>
                          <TableCell className="text-center font-bold">{student.lessonsCompleted}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn(
                              'text-xs',
                              student.completionRate >= 70 ? 'bg-emerald-100 text-emerald-700' :
                              student.completionRate >= 40 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            )}>
                              {student.completionRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{student.totalWatchTimeHours}h</TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {student.lastActivity ? new Date(student.lastActivity).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ),
        }] : []),
      ]}
    />
  )
}

export default function VideoAnalyticsPage() {
  usePageTitle('Análise de Vídeos')
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<VideoAnalyticsOverview | null>(null)
  const [lessons, setLessons] = useState<LessonAnalytics[]>([])
  const [courses, setCourses] = useState<CourseAnalytics[]>([])
  const [students, setStudents] = useState<StudentProgressEntry[]>([])
  const [trends, setTrends] = useState<WatchTrendPoint[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [trendDays, setTrendDays] = useState(30)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    getWatchTrends(trendDays).then(setTrends).catch(() => setTrends([]))
  }, [trendDays])

  const loadData = async () => {
    try {
      const [overviewData, lessonsData, coursesData, studentsData, trendsData] = await Promise.all([
        getVideoAnalyticsOverview(),
        getLessonAnalytics(),
        getCourseAnalytics(),
        getStudentProgressList(),
        getWatchTrends(trendDays),
      ])
      setOverview(overviewData)
      setLessons(lessonsData)
      setCourses(coursesData)
      setStudents(studentsData)
      setTrends(trendsData)
    } catch (error) {
      logger.error('Error loading video analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <SectionLoader />

  const filteredLessons = lessons.filter(l =>
    l.lessonTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.moduleName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Top 5 most watched and bottom 5 least completed
  const topWatched = [...lessons].sort((a, b) => b.totalViews - a.totalViews).slice(0, 5)
  const lowCompletion = [...lessons]
    .filter(l => l.totalViews >= 3)
    .sort((a, b) => a.completionRate - b.completionRate)
    .slice(0, 5)

  const kpis = [
    {
      label: 'Total de Aulas',
      value: overview?.totalLessons || 0,
      icon: Play,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      label: 'Alunos Assistindo',
      value: overview?.totalStudentsWatching || 0,
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
    },
    {
      label: 'Taxa de Conclusao',
      value: `${overview?.avgCompletionRate || 0}%`,
      icon: CheckCircle,
      color: 'text-violet-600',
      bg: 'bg-violet-100',
    },
    {
      label: 'Horas Assistidas',
      value: `${overview?.totalWatchTimeHours || 0}h`,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/reports')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics de Videos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Metricas de engajamento e progresso dos alunos
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-blue-100 border-blue-300 text-blue-700 w-fit">
          <BarChart3 className="h-3 w-3 mr-1.5" />
          Dados internos (video_progress)
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={cn('p-2 rounded-lg', kpi.bg)}>
                  <kpi.icon className={cn('h-4 w-4', kpi.color)} />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{kpi.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Watch Trends Chart */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-base font-semibold">Tendencia de Visualizacoes</CardTitle>
            </div>
            <div className="flex gap-1">
              {[7, 14, 30].map(d => (
                <Button
                  key={d}
                  variant={trendDays === d ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setTrendDays(d)}
                >
                  {d}d
                </Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Views e conclusoes por dia</p>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" fontSize={11} stroke="#9ca3af" interval="preserveStartEnd" />
                <YAxis fontSize={12} stroke="#9ca3af" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
                <Legend />
                <Line type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} name="Views" dot={false} />
                <Line type="monotone" dataKey="completions" stroke="#10b981" strokeWidth={2} name="Conclusoes" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Two columns: Top Watched + Low Completion */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Watched */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-600" />
              <CardTitle className="text-base font-semibold">Mais Assistidas</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Top 5 aulas com mais visualizacoes</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topWatched.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
              ) : topWatched.map((lesson, i) => (
                <div key={lesson.lessonId} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <span className="text-lg font-bold text-muted-foreground/50 w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lesson.lessonTitle}</p>
                    <p className="text-xs text-muted-foreground truncate">{lesson.courseName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{lesson.totalViews}</p>
                    <p className="text-xs text-muted-foreground">views</p>
                  </div>
                  <Badge variant="outline" className={cn(
                    'text-xs shrink-0',
                    lesson.completionRate >= 70 ? 'bg-emerald-100 text-emerald-700' :
                    lesson.completionRate >= 40 ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  )}>
                    {lesson.completionRate}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Low Completion (needs attention) */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-base font-semibold">Precisam de Atencao</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Aulas com menor taxa de conclusao (min. 3 views)</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowCompletion.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados suficientes</p>
              ) : lowCompletion.map((lesson) => (
                <div key={lesson.lessonId} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lesson.lessonTitle}</p>
                    <p className="text-xs text-muted-foreground truncate">{lesson.courseName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-amber-600">{lesson.completionRate}%</p>
                    <p className="text-xs text-muted-foreground">{lesson.totalViews} views</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Courses / Lessons / Students */}
      <VideoAnalyticsTabs
        courses={courses}
        filteredLessons={filteredLessons}
        students={students}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        showStudentTab={isAdmin}
      />
    </div>
  )
}
