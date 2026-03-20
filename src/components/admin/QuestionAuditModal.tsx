import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sparkles, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { aiAssistantService } from '@/services/ai/aiAssistantService'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

type Scope = 'all' | 'no_explanation' | 'recent'
type Phase = 'config' | 'running' | 'results'

interface AuditStats {
  total: number
  spellingFixed: number
  explanationsGenerated: number
  suspectAnswers: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const BATCH_SIZE = 10

export function QuestionAuditModal({ open, onOpenChange }: Props) {
  const [phase, setPhase] = useState<Phase>('config')
  const [scope, setScope] = useState<Scope>('no_explanation')
  const [fixSpelling, setFixSpelling] = useState(true)
  const [generateExplanations, setGenerateExplanations] = useState(true)
  const [checkAnswers, setCheckAnswers] = useState(true)

  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [stats, setStats] = useState<AuditStats>({
    total: 0,
    spellingFixed: 0,
    explanationsGenerated: 0,
    suspectAnswers: 0,
  })

  const handleClose = () => {
    if (phase === 'running') return
    setPhase('config')
    setProgress(0)
    setProgressText('')
    setStats({ total: 0, spellingFixed: 0, explanationsGenerated: 0, suspectAnswers: 0 })
    onOpenChange(false)
  }

  const fetchQuestions = async () => {
    let query = supabase
      .from('quiz_questions')
      .select('id, question_text, options, correct_answer, question_type, explanation')
      .limit(5000)

    if (scope === 'no_explanation') {
      query = query.or('explanation.is.null,explanation.eq.')
    } else if (scope === 'recent') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('created_at', sevenDaysAgo)
    }

    const { data, error } = await query
    if (error) throw new Error(`Erro ao buscar questoes: ${error.message}`)
    return data ?? []
  }

  const handleStart = async () => {
    setPhase('running')
    setProgress(0)

    const accumulated: AuditStats = {
      total: 0,
      spellingFixed: 0,
      explanationsGenerated: 0,
      suspectAnswers: 0,
    }

    try {
      const questions = await fetchQuestions()
      const total = questions.length

      if (total === 0) {
        setStats(accumulated)
        setPhase('results')
        return
      }

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = questions.slice(i, i + BATCH_SIZE)
        const end = Math.min(i + BATCH_SIZE, total)
        setProgressText(`Auditando questoes ${i + 1}-${end} de ${total}...`)
        setProgress(Math.round((i / total) * 100))

        try {
          const { results } = await aiAssistantService.auditQuestions(
            batch.map((q) => ({
              id: q.id,
              question_text: q.question_text,
              options: q.options,
              correct_answer: q.correct_answer,
              question_type: q.question_type,
            }))
          )

          for (const result of results) {
            const updates: Record<string, unknown> = {
              ai_audited_at: new Date().toISOString(),
            }

            let spellingChanged = false

            if (fixSpelling) {
              if (result.question_text_fixed) {
                updates.question_text = result.question_text_fixed
                spellingChanged = true
              }
              if (result.options_fixed) {
                updates.options = result.options_fixed
                spellingChanged = true
              }
            }

            if (generateExplanations && result.explanation) {
              updates.explanation = result.explanation
              accumulated.explanationsGenerated++
            }

            if (checkAnswers && result.correct_answer_suspect) {
              updates.needs_review = true
              accumulated.suspectAnswers++
            }

            if (spellingChanged) {
              accumulated.spellingFixed++
            }

            const { error: updateError } = await supabase
              .from('quiz_questions')
              .update(updates)
              .eq('id', result.id)

            if (updateError) {
              logger.error('Erro ao atualizar questao', { id: result.id, error: updateError })
            }
          }

          accumulated.total += batch.length
        } catch (batchErr) {
          logger.error('Erro no lote de auditoria, continuando...', batchErr)
          accumulated.total += batch.length
        }
      }

      setProgress(100)
      setStats(accumulated)
      setPhase('results')
    } catch (err) {
      logger.error('Erro fatal na auditoria:', err)
      setStats(accumulated)
      setPhase('results')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Auditar Questoes com IA
          </DialogTitle>
        </DialogHeader>

        {phase === 'config' && (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="scope-select">Escopo</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                <SelectTrigger id="scope-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as questoes</SelectItem>
                  <SelectItem value="no_explanation">Apenas sem explicacao</SelectItem>
                  <SelectItem value="recent">Apenas da ultima semana</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Opcoes</Label>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="fix-spelling"
                  checked={fixSpelling}
                  onCheckedChange={(v) => setFixSpelling(!!v)}
                />
                <Label htmlFor="fix-spelling" className="font-normal cursor-pointer">
                  Corrigir ortografia automaticamente
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="gen-explanations"
                  checked={generateExplanations}
                  onCheckedChange={(v) => setGenerateExplanations(!!v)}
                />
                <Label htmlFor="gen-explanations" className="font-normal cursor-pointer">
                  Gerar explicacoes
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="check-answers"
                  checked={checkAnswers}
                  onCheckedChange={(v) => setCheckAnswers(!!v)}
                />
                <Label htmlFor="check-answers" className="font-normal cursor-pointer">
                  Verificar gabaritos
                </Label>
              </div>
            </div>
          </div>
        )}

        {phase === 'running' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin shrink-0" />
              <span className="text-sm">{progressText}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {phase === 'results' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Auditoria concluida!</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Total auditadas</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 p-3 space-y-1">
                <p className="text-xs text-blue-600">Ortografia corrigida</p>
                <p className="text-2xl font-bold text-blue-700">{stats.spellingFixed}</p>
              </div>
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 p-3 space-y-1">
                <p className="text-xs text-green-600">Explicacoes geradas</p>
                <p className="text-2xl font-bold text-green-700">{stats.explanationsGenerated}</p>
              </div>
              <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 p-3 space-y-1">
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-orange-500" />
                  <p className="text-xs text-orange-600">Gabaritos suspeitos</p>
                </div>
                <p className="text-2xl font-bold text-orange-700">{stats.suspectAnswers}</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {phase === 'config' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleStart}>
                <Sparkles className="mr-2 h-4 w-4" />
                Iniciar Auditoria
              </Button>
            </>
          )}
          {phase === 'results' && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
