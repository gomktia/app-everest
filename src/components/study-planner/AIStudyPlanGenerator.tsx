import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Sparkles,
  Loader2,
  Brain,
  Target,
  Calendar,
  Lightbulb,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { aiAssistantService } from '@/services/ai/aiAssistantService'
import { logger } from '@/lib/logger'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
}

type Phase = 'config' | 'loading' | 'results'

interface DiagnosisItem {
  subject: string
  accuracy: number
  level: 'weak' | 'medium' | 'strong'
  recommendation: string
}

interface StudyBlock {
  subject: string
  hours: number
  focus: string
}

interface DaySchedule {
  day: string
  blocks: StudyBlock[]
}

interface StudyPlanResult {
  diagnosis: DiagnosisItem[]
  weekly_schedule: DaySchedule[]
  tips: string[]
}

function levelBadge(level: 'weak' | 'medium' | 'strong') {
  if (level === 'weak') return <Badge variant="destructive">Fraco</Badge>
  if (level === 'medium') return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Médio</Badge>
  return <Badge className="bg-green-600 hover:bg-green-700 text-white">Forte</Badge>
}

export function AIStudyPlanGenerator({ open, onOpenChange, userId }: Props) {
  const [phase, setPhase] = useState<Phase>('config')
  const [hoursPerWeek, setHoursPerWeek] = useState(20)
  const [targetExam, setTargetExam] = useState('')
  const [result, setResult] = useState<StudyPlanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function gatherPerformance() {
    try {
      // Collect quiz attempts with percentage for the user
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('id, score, total_questions, quiz_id')
        .eq('user_id', userId)
        .limit(100)

      if (!attempts || attempts.length === 0) {
        return { quiz_attempts: [], flashcard_topics: [] }
      }

      const attemptIds = attempts.map((a) => a.id)

      // Get answers with question tags for subject grouping
      const { data: answers } = await supabase
        .from('quiz_answers')
        .select('is_correct, quiz_questions!inner(tags)')
        .in('attempt_id', attemptIds)
        .limit(500)

      // Aggregate by tag/subject
      const subjectMap: Record<string, { correct: number; total: number }> = {}

      if (answers) {
        for (const ans of answers as any[]) {
          const tags: string[] = ans.quiz_questions?.tags ?? []
          const subject = tags[0] ?? 'Outros'
          if (!subjectMap[subject]) subjectMap[subject] = { correct: 0, total: 0 }
          subjectMap[subject].total += 1
          if (ans.is_correct) subjectMap[subject].correct += 1
        }
      }

      const quiz_performance = Object.entries(subjectMap).map(([subject, v]) => ({
        subject,
        correct: v.correct,
        total: v.total,
        accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      }))

      // Flashcard performance by topic
      const { data: flashcardProgress } = await supabase
        .from('flashcard_progress')
        .select('rating, flashcards!inner(flashcard_topics!inner(name))')
        .eq('user_id', userId)
        .limit(300)

      const topicMap: Record<string, { good: number; total: number }> = {}

      if (flashcardProgress) {
        for (const fp of flashcardProgress as any[]) {
          const topicName = fp.flashcards?.flashcard_topics?.name ?? 'Outros'
          if (!topicMap[topicName]) topicMap[topicName] = { good: 0, total: 0 }
          topicMap[topicName].total += 1
          // rating: 1=hard, 2=medium, 3=easy
          if ((fp.rating ?? 1) >= 3) topicMap[topicName].good += 1
        }
      }

      const flashcard_topics = Object.entries(topicMap).map(([topic, v]) => ({
        topic,
        mastery: v.total > 0 ? Math.round((v.good / v.total) * 100) : 0,
        reviewed: v.total,
      }))

      return { quiz_performance, flashcard_topics }
    } catch (err) {
      logger.error('Erro ao coletar dados de desempenho:', err)
      return { quiz_performance: [], flashcard_topics: [] }
    }
  }

  async function handleGenerate() {
    setError(null)
    setPhase('loading')

    try {
      const performance = await gatherPerformance()
      const data = await aiAssistantService.generateStudyPlan({
        performance,
        available_hours_per_week: hoursPerWeek,
        target_exam: targetExam || 'Concurso Público',
      })

      setResult(data as StudyPlanResult)
      setPhase('results')
    } catch (err: any) {
      logger.error('Erro ao gerar plano de estudos com IA:', err)
      setError(err?.message ?? 'Erro ao gerar plano. Tente novamente.')
      setPhase('config')
    }
  }

  function handleClose() {
    onOpenChange(false)
    // Reset after animation
    setTimeout(() => {
      setPhase('config')
      setResult(null)
      setError(null)
    }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerador de Plano de Estudos com IA
          </DialogTitle>
        </DialogHeader>

        {/* Config phase */}
        {phase === 'config' && (
          <div className="space-y-5 py-2">
            <p className="text-sm text-muted-foreground">
              A IA vai analisar seu histórico de quiz e flashcards para criar um plano
              personalizado de acordo com suas fraquezas e disponibilidade.
            </p>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="hours">Horas disponíveis por semana</Label>
                <Input
                  id="hours"
                  type="number"
                  min={1}
                  max={80}
                  value={hoursPerWeek}
                  onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                  className="w-40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exam">Concurso alvo</Label>
                <Input
                  id="exam"
                  placeholder="Ex: CIAAR, ESFCEX, PC-SP..."
                  value={targetExam}
                  onChange={(e) => setTargetExam(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive border border-destructive/30 rounded-md px-3 py-2 bg-destructive/10">
                {error}
              </p>
            )}

            <Button
              onClick={handleGenerate}
              disabled={hoursPerWeek < 1}
              className="w-full"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Gerar Plano com IA
            </Button>
          </div>
        )}

        {/* Loading phase */}
        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Analisando seu desempenho...</p>
            <p className="text-xs">Isso pode levar alguns segundos</p>
          </div>
        )}

        {/* Results phase */}
        {phase === 'results' && result && (
          <div className="space-y-6 py-2">
            {/* Diagnostico */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-base">Diagnóstico</h3>
              </div>
              <div className="space-y-2">
                {result.diagnosis.map((item, i) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-medium text-sm truncate">{item.subject}</span>
                        {levelBadge(item.level)}
                        <span className="text-xs text-muted-foreground ml-auto sm:ml-0 shrink-0">
                          {item.accuracy}% acerto
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground sm:border-l sm:pl-3 sm:ml-3">
                        {item.recommendation}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Cronograma Semanal */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-base">Cronograma Semanal</h3>
              </div>
              <div className="space-y-3">
                {result.weekly_schedule.map((day, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Target className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">{day.day}</span>
                    </div>
                    <div className="space-y-1.5 pl-5">
                      {day.blocks.map((block, j) => (
                        <div
                          key={j}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <span className="shrink-0 font-medium text-foreground">
                            {block.hours}h
                          </span>
                          <span className="font-medium text-foreground">{block.subject}</span>
                          <span>—</span>
                          <span>{block.focus}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Dicas */}
            {result.tips && result.tips.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-base">Dicas</h3>
                </div>
                <ol className="space-y-1.5 list-none pl-0">
                  {result.tips.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="shrink-0 font-semibold text-primary">{i + 1}.</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}

        <DialogFooter>
          {phase === 'results' && (
            <Button variant="outline" onClick={() => setPhase('config')}>
              Gerar Novamente
            </Button>
          )}
          <Button onClick={handleClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
