import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SimulationsTutorial } from '@/components/simulations/SimulationsTutorial'
import { PageTabs } from '@/components/PageTabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Play,
  BarChart2,
  Calendar,
  Clock,
  Trophy,
  Target,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Send,
  Monitor,
  ClipboardList,
  Lock,
  HelpCircle,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '@/hooks/use-auth'
import { useContentAccess } from '@/hooks/useContentAccess'
import { useFeaturePermissions } from '@/hooks/use-feature-permissions'
import { FEATURE_KEYS } from '@/services/classPermissionsService'
import { logger } from '@/lib/logger'
import { SectionLoader } from '@/components/SectionLoader'

interface Quiz {
  id: string
  title: string
  description?: string
  type: string
  status: string
  scheduled_start?: string
  scheduled_end?: string
  duration_minutes?: number
  total_points?: number
  passing_score?: number
}

interface QuizWithAttempt extends Quiz {
  user_attempts?: Array<{
    id: string
    score?: number
    total_points?: number
    percentage?: number
    status: string
    submitted_at?: string
  }>
}

export default function SimulationsPage() {
  const { isStudent } = useAuth()
  const { hasFeature, loading: permissionsLoading } = useFeaturePermissions()
  const { isAllowed } = useContentAccess('simulation')
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('online')
  const [simulations, setSimulations] = useState<QuizWithAttempt[]>([])
  const [answerSheets, setAnswerSheets] = useState<QuizWithAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ available: 0, completed: 0, average: 0, best: 0 })
  const [sheetsStats, setSheetsStats] = useState({ available: 0, submitted: 0, average: 0, best: 0 })
  const [showTutorial, setShowTutorial] = useState(false)

  const handleCloseTutorial = () => {
    setShowTutorial(false)
  }

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const [{ data: simQuizzes, error: simError }, { data: sheetQuizzes, error: sheetError }] = await Promise.all([
        supabase.from('quizzes').select('*').eq('type', 'simulation').eq('status', 'published').order('created_at', { ascending: false }),
        supabase.from('quizzes').select('*').eq('type', 'answer_sheet').eq('status', 'published').order('created_at', { ascending: false }),
      ])

      if (simError) throw simError
      if (sheetError) throw sheetError

      const allQuizIds = [...(simQuizzes?.map(q => q.id) || []), ...(sheetQuizzes?.map(q => q.id) || [])]

      let attempts: any[] | null = null
      if (allQuizIds.length > 0) {
        const { data, error } = await supabase
          .from('quiz_attempts').select('*').eq('user_id', user.id).in('quiz_id', allQuizIds).order('created_at', { ascending: false })
        if (error) throw error
        attempts = data
      }

      const attemptsMap = new Map<string, any[]>()
      attempts?.forEach(a => {
        const existing = attemptsMap.get(a.quiz_id) || []
        attemptsMap.set(a.quiz_id, [...existing, a])
      })

      const combinedSims = simQuizzes?.map(q => ({ ...q, user_attempts: attemptsMap.get(q.id) || [] })) || []
      const combinedSheets = sheetQuizzes?.map(q => ({ ...q, user_attempts: attemptsMap.get(q.id) || [] })) || []
      setSimulations(combinedSims)
      setAnswerSheets(combinedSheets)

      // Stats - Simulados
      const simAttempts = attempts?.filter(a => simQuizzes?.some(q => q.id === a.quiz_id) && a.status === 'submitted') || []
      setStats({
        available: combinedSims.filter(q => getSimulationStatus(q) === 'available').length,
        completed: simAttempts.length,
        average: simAttempts.length > 0 ? Math.round(simAttempts.reduce((s, a) => s + (a.percentage || 0), 0) / simAttempts.length) : 0,
        best: Math.round(simAttempts.reduce((m, a) => Math.max(m, a.percentage || 0), 0)),
      })

      // Stats - Cartões
      const sheetAttempts = attempts?.filter(a => sheetQuizzes?.some(q => q.id === a.quiz_id) && a.status === 'submitted') || []
      setSheetsStats({
        available: combinedSheets.filter(q => getSimulationStatus(q) === 'available').length,
        submitted: sheetAttempts.length,
        average: sheetAttempts.length > 0 ? Math.round(sheetAttempts.reduce((s, a) => s + (a.percentage || 0), 0) / sheetAttempts.length) : 0,
        best: Math.round(sheetAttempts.reduce((m, a) => Math.max(m, a.percentage || 0), 0)),
      })
    } catch (error: any) {
      logger.error('Erro ao carregar simulados:', error)
      toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const getSimulationStatus = (quiz: QuizWithAttempt): 'available' | 'completed' | 'expired' | 'scheduled' => {
    const now = new Date()
    if (quiz.scheduled_end && new Date(quiz.scheduled_end) < now) return 'expired'
    if (quiz.scheduled_start && new Date(quiz.scheduled_start) > now) return 'scheduled'
    if (quiz.user_attempts?.some(a => a.status === 'submitted')) return 'completed'
    return 'available'
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'available': return { label: 'Disponível', color: 'border-green-300 text-green-600 bg-green-500/10', icon: <Play className="h-3 w-3" /> }
      case 'completed': return { label: 'Realizado', color: 'border-blue-300 text-blue-600 bg-blue-500/10', icon: <CheckCircle className="h-3 w-3" /> }
      case 'expired': return { label: 'Encerrado', color: 'border-border text-muted-foreground bg-muted/50', icon: <AlertCircle className="h-3 w-3" /> }
      case 'scheduled': return { label: 'Agendado', color: 'border-purple-300 text-purple-600 bg-purple-500/10', icon: <Clock className="h-3 w-3" /> }
      default: return { label: 'Desconhecido', color: 'border-border text-muted-foreground', icon: <AlertCircle className="h-3 w-3" /> }
    }
  }

  if (permissionsLoading || loading) return <SectionLoader />

  if (isStudent && !hasFeature(FEATURE_KEYS.QUIZ)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Simulados</h1>
          <p className="text-sm text-muted-foreground mt-1">Recurso bloqueado</p>
        </div>
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Recurso Bloqueado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Este recurso não está disponível para sua turma. Entre em contato com seu professor ou administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderTabContent = (
    tabStats: typeof stats | typeof sheetsStats,
    data: QuizWithAttempt[],
    tabType: 'online' | 'presencial'
  ) => (
    <div className="space-y-6 mt-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-green-500/30">
          <CardContent className="p-4 text-center">
            {tabType === 'online'
              ? <Play className="h-5 w-5 text-green-500 mx-auto mb-1.5" />
              : <Send className="h-5 w-5 text-green-500 mx-auto mb-1.5" />
            }
            <div className="text-xl font-bold text-foreground">{tabStats.available}</div>
            <div className="text-xs text-muted-foreground">Disponíveis</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-500/30">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 text-blue-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">
              {tabType === 'online' ? tabStats.completed : (tabStats as any).submitted}
            </div>
            <div className="text-xs text-muted-foreground">{tabType === 'online' ? 'Realizados' : 'Enviados'}</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-purple-500/30">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-purple-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{tabStats.average}%</div>
            <div className="text-xs text-muted-foreground">Média</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-orange-500/30">
          <CardContent className="p-4 text-center">
            <Trophy className="h-5 w-5 text-orange-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{tabStats.best}%</div>
            <div className="text-xs text-muted-foreground">Melhor</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-5 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            {tabType === 'online' ? 'Simulados Online' : 'Provas Presenciais'}
          </h2>

          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Nome</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold">Data</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">Nota</TableHead>
                  <TableHead className="text-right font-semibold">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {tabType === 'online' ? 'Nenhum simulado disponível' : 'Nenhum cartão resposta disponível'}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((sim, index) => {
                    const status = getSimulationStatus(sim)
                    const config = getStatusConfig(status)
                    const lastAttempt = sim.user_attempts?.[0]
                    const simLocked = isStudent && !isAllowed(sim.id)
                    const formattedDate = sim.scheduled_start
                      ? format(new Date(sim.scheduled_start), 'dd/MM/yyyy', { locale: ptBR })
                      : '—'

                    return (
                      <TableRow key={sim.id} className={cn("hover:bg-muted/50 transition-colors", index % 2 === 1 && "bg-muted/30", simLocked && "opacity-50")}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-primary">{String(index + 1).padStart(2, '0')}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground truncate">{sim.title}</div>
                              {sim.duration_minutes && (
                                <div className="text-xs text-muted-foreground">{sim.duration_minutes} min</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {formattedDate}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('gap-1.5 font-medium', config.color)}>
                            {config.icon}
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {lastAttempt && lastAttempt.status === 'submitted' ? (
                            <span className="font-semibold text-primary">{lastAttempt.percentage?.toFixed(0)}%</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {status === 'available' && simLocked && (
                            <Button size="sm" variant="outline" disabled className="opacity-50 gap-1.5">
                              <Lock className="h-3.5 w-3.5" />
                              Bloqueado
                            </Button>
                          )}
                          {status === 'available' && !simLocked && (
                            <Button size="sm" asChild className="transition-all duration-200 hover:shadow-md hover:bg-green-600">
                              {tabType === 'online' ? (
                                <Link to={`/simulados/${sim.id}`}>
                                  <Play className="mr-1.5 h-3.5 w-3.5" />
                                  Iniciar
                                </Link>
                              ) : (
                                <Link to={`/cartao-resposta/${sim.id}`}>
                                  <Send className="mr-1.5 h-3.5 w-3.5" />
                                  Preencher
                                </Link>
                              )}
                            </Button>
                          )}
                          {status === 'completed' && lastAttempt && (
                            <Button variant="outline" size="sm" asChild className="transition-all duration-200 hover:shadow-md hover:border-primary/30">
                              {tabType === 'online' ? (
                                <Link to={`/simulados/${sim.id}/resultado?attemptId=${lastAttempt.id}`}>
                                  <BarChart2 className="mr-1.5 h-3.5 w-3.5" />
                                  Relatório
                                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                </Link>
                              ) : (
                                <Link to={`/cartao-resposta/${sim.id}/resultado?attemptId=${lastAttempt.id}`}>
                                  <BarChart2 className="mr-1.5 h-3.5 w-3.5" />
                                  Ver Nota
                                </Link>
                              )}
                            </Button>
                          )}
                          {status === 'expired' && (
                            <Button variant="outline" size="sm" disabled className="opacity-50">
                              <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
                              Encerrado
                            </Button>
                          )}
                          {status === 'scheduled' && (
                            <Button variant="outline" size="sm" disabled className="opacity-50">
                              <Clock className="mr-1.5 h-3.5 w-3.5" />
                              Agendado
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sistema de Avaliações</h1>
          <p className="text-sm text-muted-foreground mt-1">Simulados online e cartões resposta de provas presenciais</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowTutorial(true)} className="gap-2 w-fit">
          <HelpCircle className="h-4 w-4" />
          Ajuda
        </Button>
      </div>

      {/* Tabs + Stats + Table */}
      <PageTabs
        value={activeTab}
        onChange={setActiveTab}
        layout="full"
        tabs={[
          {
            value: 'online',
            label: 'Simulados Online',
            icon: <Monitor className="h-4 w-4" />,
            content: renderTabContent(stats, simulations, 'online'),
          },
          {
            value: 'presencial',
            label: 'Cartões Resposta',
            icon: <ClipboardList className="h-4 w-4" />,
            content: renderTabContent(sheetsStats, answerSheets, 'presencial'),
          },
        ]}
      />

      {showTutorial && <SimulationsTutorial onClose={handleCloseTutorial} />}
    </div>
  )
}
