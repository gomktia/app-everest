import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle,
  Clock,
  Trophy,
  Target,
  TrendingUp,
  Star,
  Brain,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  BarChart3,
} from 'lucide-react'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { getSimulationResult, getLastAttempt } from '@/services/simulationService'
import { SectionLoader } from '@/components/SectionLoader'
import { logger } from '@/lib/logger'

export default function SimulationResultsPage() {
  const { simulationId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [performanceByArea, setPerformanceByArea] = useState<any[]>([])

  useEffect(() => {
    if (simulationId && user) {
      loadResults()
    }
  }, [simulationId, user])

  const loadResults = async () => {
    try {
      setLoading(true)
      const lastAttempt = await getLastAttempt(simulationId!, user!.id)

      if (!lastAttempt || lastAttempt.status !== 'submitted') {
        navigate(`/simulados/${simulationId}`)
        return
      }

      const fullResult = await getSimulationResult(lastAttempt.id)
      setResult(fullResult)

      if (fullResult.answers) {
        const areaStats: Record<string, { total: number; correct: number }> = {}

        fullResult.answers.forEach((ans: any) => {
          const subject = ans.question?.subject || 'Geral'
          if (!areaStats[subject]) {
            areaStats[subject] = { total: 0, correct: 0 }
          }
          areaStats[subject].total++
          if (ans.is_correct) {
            areaStats[subject].correct++
          }
        })

        const chartData = Object.entries(areaStats).map(([name, stats]) => ({
          name,
          acertos: stats.correct,
          total: stats.total,
          percentage: Math.round((stats.correct / stats.total) * 100),
        }))

        setPerformanceByArea(chartData)
      }
    } catch (error) {
      logger.error('Error loading results:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <SectionLoader />

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/simulados')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Resultado não encontrado</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Não foi possível carregar o resultado deste simulado.
            </p>
          </div>
        </div>
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-16 space-y-4">
            <Target className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Resultado não encontrado</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              O resultado deste simulado não está disponível. Pode ser que você ainda não tenha finalizado o simulado ou ocorreu um erro ao carregar.
            </p>
            <Button onClick={() => navigate('/simulados')} className="gap-2 mt-4">
              <ArrowLeft className="h-4 w-4" />
              Voltar para Simulados
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const percentage = Math.round(result.percentage || 0)
  const totalQuestions = result.answers?.length || 0
  const correctAnswers = result.answers?.filter((a: any) => a.is_correct).length || 0

  const getPerformanceLevel = (pct: number) => {
    if (pct >= 90) return { level: 'Excelente', color: 'green', icon: Trophy }
    if (pct >= 80) return { level: 'Muito Bom', color: 'blue', icon: Star }
    if (pct >= 70) return { level: 'Bom', color: 'yellow', icon: Target }
    if (pct >= 60) return { level: 'Regular', color: 'orange', icon: TrendingUp }
    return { level: 'Precisa melhorar', color: 'red', icon: Brain }
  }

  const performance = getPerformanceLevel(percentage)
  const PerformanceIcon = performance.icon

  const formatTime = (seconds?: number) => {
    if (!seconds) return '--:--'
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/simulados')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatório de Desempenho</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {result.quiz?.title || 'Simulado'} · {percentage}% de aproveitamento
          </p>
        </div>
      </div>

      {/* Score Card */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-8 text-center space-y-6">
          <div className="flex items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <PerformanceIcon className="h-8 w-8 text-primary" />
            </div>
            <div className="text-left">
              <h2 className="text-2xl font-bold text-foreground">Simulado Concluído!</h2>
              <p className="text-sm text-muted-foreground">{result.quiz?.title}</p>
            </div>
          </div>

          {/* Score */}
          <div className="space-y-2">
            <div className="text-7xl font-bold text-primary">{percentage}%</div>
            <div className="text-lg font-medium text-muted-foreground">
              {correctAnswers} de {totalQuestions} questões corretas
            </div>
          </div>

          {/* Performance Badge */}
          <div className="flex justify-center">
            <div
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 font-semibold text-sm',
                performance.color === 'green' && 'bg-green-500/10 border-green-500/30 text-green-600',
                performance.color === 'blue' && 'bg-blue-500/10 border-blue-500/30 text-blue-600',
                performance.color === 'yellow' && 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600',
                performance.color === 'orange' && 'bg-orange-500/10 border-orange-500/30 text-orange-600',
                performance.color === 'red' && 'bg-red-500/10 border-red-500/30 text-red-600',
              )}
            >
              <PerformanceIcon className="h-4 w-4" />
              {performance.level}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-green-500/30">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{correctAnswers}</div>
            <div className="text-xs text-muted-foreground">Acertos</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-red-500/30">
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 text-red-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{totalQuestions - correctAnswers}</div>
            <div className="text-xs text-muted-foreground">Erros</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-500/30">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 text-blue-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{formatTime(result.time_spent_seconds)}</div>
            <div className="text-xs text-muted-foreground">Tempo</div>
          </CardContent>
        </Card>
      </div>

      {/* Performance by Area */}
      {performanceByArea.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Desempenho por Área</h2>
            </div>

            <div className="space-y-3">
              {performanceByArea.map((area) => (
                <div
                  key={area.name}
                  className="p-4 rounded-xl border border-border bg-muted/30 transition-all duration-200 hover:shadow-md hover:border-primary/30"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm">{area.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {area.acertos} de {area.total} questões
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-primary">{area.percentage}%</div>
                    </div>
                  </div>
                  <Progress
                    value={area.percentage}
                    className="h-1.5 bg-muted [&>div]:bg-blue-500"
                  />
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="p-4 rounded-xl border border-border bg-muted/20">
              <ChartContainer config={{}} className="h-64 w-full">
                <BarChart data={performanceByArea} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="acertos" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          asChild
          className="gap-2 transition-all duration-200 hover:shadow-md hover:bg-green-600"
        >
          <Link to="/simulados">
            <ArrowRight className="h-4 w-4" />
            Ver Outros Simulados
          </Link>
        </Button>
      </div>
    </div>
  )
}
