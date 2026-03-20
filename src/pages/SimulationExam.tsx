import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { useActivityScoring } from '@/hooks/useAchievements'
import {
  Timer,
  ChevronLeft,
  ChevronRight,
  Target,
  Brain,
  AlertTriangle,
  Trophy,
  ClipboardList,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { QuestionRenderer } from '@/components/QuestionRenderer'
import {
  getSimulation,
  type Simulation,
  startSimulationAttempt,
  saveSimulationAnswer,
  submitSimulation,
} from '@/services/simulationService'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { SectionLoader } from '@/components/SectionLoader'

export default function SimulationExamPage() {
  usePageTitle('Simulado')
  const { simulationId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [simulation, setSimulation] = useState<Simulation | null>(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [timeLeft, setTimeLeft] = useState(-1)
  const [showAnswerSheet, setShowAnswerSheet] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { user } = useAuth()
  const { scoreSimulationActivity } = useActivityScoring()

  useEffect(() => {
    if (simulationId && user) loadSimulation()
  }, [simulationId, user])

  useEffect(() => {
    if (!simulation) return
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [simulation])

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeLeft === 0 && simulation && attemptId && !isSubmitting) {
      handleFinish()
    }
  }, [timeLeft])

  const loadSimulation = async () => {
    try {
      setLoading(true)
      const data = await getSimulation(simulationId!)
      if (!data) {
        toast({ title: 'Erro', description: 'Simulado não encontrado', variant: 'destructive' })
        navigate('/simulados')
        return
      }
      setSimulation(data)
      setTimeLeft((data.duration_minutes || 60) * 60)
      if (user) {
        const id = await startSimulationAttempt(simulationId!, user.id)
        setAttemptId(id)
      }
    } catch (error: any) {
      toast({ title: 'Erro ao carregar simulado', description: error.message, variant: 'destructive' })
      navigate('/simulados')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const handleAnswerChange = async (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
    if (attemptId) {
      try {
        await saveSimulationAnswer(attemptId, questionId, answer)
      } catch {
        toast({ title: 'Erro ao salvar resposta', description: 'Verifique sua conexão.', variant: 'destructive' })
      }
    }
  }

  const handleFinish = async () => {
    if (!attemptId || !simulation || isSubmitting) return
    try {
      setIsSubmitting(true)
      setLoading(true)
      await submitSimulation(attemptId)

      // Score the simulation activity
      const totalQuestions = simulation.questions.length
      // Real score is calculated server-side by submitSimulation RPC
      // Pass answered count as approximate for XP (backend corrects later)
      const answeredCount = Object.keys(answers).length
      await scoreSimulationActivity(answeredCount, totalQuestions, attemptId)

      toast({ title: 'Simulado enviado!', description: 'Suas respostas foram salvas com sucesso.' })
      navigate(`/simulados/${simulationId}/resultado?attemptId=${attemptId}`)
    } catch {
      toast({ title: 'Erro ao enviar', description: 'Tente novamente.', variant: 'destructive' })
      setIsSubmitting(false)
      setLoading(false)
    }
  }

  if (loading) return <SectionLoader />

  if (!simulation || !simulation.questions.length) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Erro</h1>
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma questão encontrada neste simulado.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const question = simulation.questions[currentQ]
  const progressPercent = ((currentQ + 1) / simulation.questions.length) * 100
  const answeredCount = Object.keys(answers).length

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header + Timer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{simulation.title}</h1>
            <p className="text-sm text-muted-foreground">
              Questão <span className="font-bold text-foreground">{currentQ + 1}</span> de {simulation.questions.length}
              <span className="mx-2">·</span>
              {answeredCount} respondida{answeredCount !== 1 ? 's' : ''}
            </p>
          </div>

          <div className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-mono text-lg font-bold transition-all duration-300',
            timeLeft < 300
              ? 'bg-red-100 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-600'
              : 'bg-muted/50 border-border text-foreground'
          )}>
            <Timer className="h-5 w-5" />
            {formatTime(timeLeft)}
          </div>
        </div>
        <Progress value={progressPercent} className="h-2 bg-muted [&>div]:bg-blue-500" />
      </div>

      {/* Cartão Resposta */}
      <Card className="border-border shadow-sm">
        <button
          onClick={() => setShowAnswerSheet(prev => !prev)}
          className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Cartão Resposta</span>
            <Badge variant="outline" className="text-xs ml-1">
              {answeredCount}/{simulation.questions.length}
            </Badge>
          </div>
          <ChevronDown className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            showAnswerSheet && 'rotate-180'
          )} />
        </button>
        {showAnswerSheet && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-10 gap-1.5">
              {simulation.questions.map((q, idx) => {
                const isAnswered = !!answers[q.id]
                const isCurrent = idx === currentQ
                const optIdx = isAnswered && Array.isArray(q.options)
                  ? q.options.indexOf(answers[q.id])
                  : -1
                const answerLetter = optIdx >= 0 ? String.fromCharCode(65 + optIdx) : null

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentQ(idx)}
                    className={cn(
                      'relative flex flex-col items-center justify-center rounded-lg py-1.5 text-xs font-medium transition-all duration-200',
                      isCurrent
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 shadow-sm'
                        : isAnswered
                          ? 'bg-green-100 dark:bg-green-950/50 border border-green-300 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-500/20'
                          : 'bg-muted/50 border border-border text-muted-foreground hover:bg-muted hover:border-primary/30'
                    )}
                  >
                    <span className="text-[10px] leading-none opacity-60">{idx + 1}</span>
                    <span className="text-sm font-bold leading-tight">
                      {answerLetter || '—'}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
                Atual
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-green-500/30 border border-green-500/50" />
                Respondida
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-muted border border-border" />
                Pendente
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Question Card */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-6 space-y-6">
          {/* Question header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Questão {currentQ + 1}</h2>
                <p className="text-xs text-muted-foreground">
                  {question.question_format === 'multiple_choice' && 'Múltipla Escolha'}
                  {question.question_format === 'true_false' && 'Verdadeiro/Falso'}
                  {question.question_format === 'essay' && 'Dissertativa'}
                  {question.question_format === 'fill_blank' && 'Preencher Lacuna'}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              <Brain className="h-3 w-3 mr-1" />
              {simulation.questions.length - currentQ - 1} restantes
            </Badge>
          </div>

          {/* Question Content */}
          <QuestionRenderer
            question={question}
            answer={answers[question.id]}
            onAnswerChange={(answer) => handleAnswerChange(question.id, answer)}
          />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentQ(p => Math.max(0, p - 1))}
          disabled={currentQ === 0}
          className="gap-2 transition-all duration-200 hover:shadow-md hover:border-primary/30"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>

        <span className="text-sm text-muted-foreground">
          {currentQ + 1} / {simulation.questions.length}
        </span>

        {currentQ < simulation.questions.length - 1 ? (
          <Button
            variant="outline"
            onClick={() => setCurrentQ(p => p + 1)}
            className="gap-2 transition-all duration-200 hover:shadow-md hover:border-primary/30"
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="gap-2 transition-all duration-200 hover:shadow-md hover:bg-green-600">
                <Trophy className="h-4 w-4" />
                Finalizar Simulado
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Confirmar Envio?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Você tem certeza que deseja finalizar e enviar suas respostas? Esta ação não pode ser desfeita.
                  <br />
                  <span className="font-medium mt-2 block">
                    {answeredCount} de {simulation.questions.length} questões respondidas.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleFinish} disabled={isSubmitting}>
                  {isSubmitting ? 'Enviando...' : 'Confirmar e Enviar'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  )
}
