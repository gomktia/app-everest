import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import {
  Trash,
  Plus,
  Save,
  ArrowLeft,
  GripVertical,
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  ImagePlus,
  Search,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { SectionLoader } from '@/components/SectionLoader'
import { supabase } from '@/lib/supabase/client'
import {
  getSimulationById,
  createSimulation,
  updateSimulation,
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getReadingTexts,
  createReadingText,
  updateReadingText,
  deleteReadingText,
  type QuizQuestion,
  type QuizQuestionInsert,
  type ReadingText,
  type ReadingTextInsert,
} from '@/services/adminSimulationService'
import { getAllQuestions } from '@/services/adminQuizService'

// ─── Types ──────────────────────────────────────────────────────────────

type QuestionFormat = 'multiple_choice' | 'true_false' | 'essay' | 'fill_blank'

interface QuestionFormData {
  id?: string
  question_text: string
  question_format: QuestionFormat
  options: string[]
  correct_answer: string
  explanation: string
  difficulty: string
  points: number
  question_image_url: string
  reading_text_id: string | null
  display_order: number
}

interface ReadingTextFormData {
  id?: string
  title: string
  content: string
  author: string
  source: string
}

interface SimulationFormData {
  title: string
  description: string
  instructions: string
  duration_minutes: number
  passing_score: number
  shuffle_questions: boolean
  shuffle_options: boolean
  show_results_immediately: boolean
  allow_review: boolean
}

const QUESTION_FORMAT_LABELS: Record<QuestionFormat, string> = {
  multiple_choice: 'Múltipla Escolha',
  true_false: 'Verdadeiro/Falso',
  essay: 'Dissertativa',
  fill_blank: 'Preencher Lacuna',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
}

const newQuestion = (order: number): QuestionFormData => ({
  question_text: '',
  question_format: 'multiple_choice',
  options: ['', '', '', ''],
  correct_answer: '',
  explanation: '',
  difficulty: 'medium',
  points: 1,
  question_image_url: '',
  reading_text_id: null,
  display_order: order,
})

const newReadingText = (): ReadingTextFormData => ({
  title: '',
  content: '',
  author: '',
  source: '',
})

// ─── Component ──────────────────────────────────────────────────────────

export default function AdminSimulationFormPage() {
  const { simulationId } = useParams()
  const navigate = useNavigate()
  usePageTitle('Editor de Simulado')
  const { toast } = useToast()
  const { user } = useAuth()
  const isEditing = !!simulationId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Simulation form
  const [form, setForm] = useState<SimulationFormData>({
    title: '',
    description: '',
    instructions: '',
    duration_minutes: 180,
    passing_score: 60,
    shuffle_questions: false,
    shuffle_options: false,
    show_results_immediately: true,
    allow_review: true,
  })

  // Questions
  const [questions, setQuestions] = useState<QuestionFormData[]>([])
  const [expandedQ, setExpandedQ] = useState<number | null>(null)

  // Import from bank
  const [bankDialogOpen, setBankDialogOpen] = useState(false)
  const [bankQuestions, setBankQuestions] = useState<any[]>([])
  const [bankSubjects, setBankSubjects] = useState<{ id: string; name: string }[]>([])
  const [bankTopics, setBankTopics] = useState<{ id: string; name: string; subject_id: string }[]>([])
  const [bankFilterSubject, setBankFilterSubject] = useState('all')
  const [bankFilterTopic, setBankFilterTopic] = useState('all')
  const [bankSelected, setBankSelected] = useState<Set<string>>(new Set())
  const [bankLoading, setBankLoading] = useState(false)

  // Reading texts
  const [readingTexts, setReadingTexts] = useState<ReadingTextFormData[]>([])
  const [expandedText, setExpandedText] = useState<number | null>(null)

  // ─── Load existing data ───────────────────────────────────────────────

  useEffect(() => {
    if (isEditing) {
      loadData()
    } else {
      setLoading(false)
    }
  }, [simulationId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [sim, existingQuestions, existingTexts] = await Promise.all([
        getSimulationById(simulationId!),
        getQuestions(simulationId!),
        getReadingTexts(simulationId!),
      ])

      if (!sim) {
        toast({ title: 'Simulado não encontrado', variant: 'destructive' })
        navigate('/admin/simulations')
        return
      }

      setForm({
        title: sim.title || '',
        description: sim.description || '',
        instructions: sim.instructions || '',
        duration_minutes: sim.duration_minutes || 180,
        passing_score: sim.passing_score || 60,
        shuffle_questions: sim.shuffle_questions || false,
        shuffle_options: sim.shuffle_options || false,
        show_results_immediately: sim.show_results_immediately ?? true,
        allow_review: sim.allow_review ?? true,
      })

      setQuestions(
        existingQuestions.map((q) => ({
          id: q.id,
          question_text: q.question_text || '',
          question_format: (q.question_format || 'multiple_choice') as QuestionFormat,
          options: Array.isArray(q.options) ? (q.options as string[]) : ['', '', '', ''],
          correct_answer: q.correct_answer || '',
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium',
          points: q.points || 1,
          question_image_url: q.question_image_url || '',
          reading_text_id: q.reading_text_id || null,
          display_order: q.display_order || 0,
        })),
      )

      setReadingTexts(
        existingTexts.map((t) => ({
          id: t.id,
          title: t.title || '',
          content: t.content || '',
          author: t.author || '',
          source: t.source || '',
        })),
      )
    } catch (error: any) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // ─── Handlers ─────────────────────────────────────────────────────────

  const updateForm = (field: keyof SimulationFormData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const updateQ = (idx: number, field: keyof QuestionFormData, value: any) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)))
  }

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q
        const options = [...q.options]
        options[optIdx] = value
        return { ...q, options }
      }),
    )
  }

  const addOption = (qIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, options: [...q.options, ''] } : q)),
    )
  }

  const removeOption = (qIdx: number, optIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q
        const options = q.options.filter((_, j) => j !== optIdx)
        const removedOpt = q.options[optIdx]
        return {
          ...q,
          options,
          correct_answer: q.correct_answer === removedOpt ? '' : q.correct_answer,
        }
      }),
    )
  }

  const addQuestion = () => {
    const q = newQuestion(questions.length + 1)
    setQuestions((prev) => [...prev, q])
    setExpandedQ(questions.length)
  }

  const openBankDialog = async () => {
    setBankDialogOpen(true)
    setBankSelected(new Set())
    setBankFilterSubject('all')
    setBankFilterTopic('all')
    if (bankQuestions.length > 0) return // already loaded
    try {
      setBankLoading(true)
      const [questionsData, { data: subjects }, { data: topics }] = await Promise.all([
        getAllQuestions(),
        supabase.from('subjects').select('id, name').order('name'),
        supabase.from('topics').select('id, name, subject_id').order('name'),
      ])
      setBankQuestions(questionsData || [])
      setBankSubjects(subjects || [])
      setBankTopics(topics || [])
    } catch {
      toast({ title: 'Erro ao carregar questões', variant: 'destructive' })
    } finally {
      setBankLoading(false)
    }
  }

  const importFromBank = () => {
    const existingIds = new Set(questions.filter(q => q.id).map(q => q.id))
    const toImport = bankQuestions
      .filter(q => bankSelected.has(q.id) && !existingIds.has(q.id))
      .map((q, i) => ({
        id: undefined, // new copy, not linked to original
        question_text: q.question_text,
        question_format: 'multiple_choice' as QuestionFormat,
        options: Array.isArray(q.options) ? q.options : [],
        correct_answer: q.correct_answer || '',
        explanation: q.explanation || '',
        difficulty: 'medium',
        points: q.points || 1,
        question_image_url: '',
        reading_text_id: null,
        display_order: questions.length + i + 1,
      }))
    if (toImport.length === 0) {
      toast({ title: 'Nenhuma questão nova para importar' })
      setBankDialogOpen(false)
      return
    }
    setQuestions(prev => [...prev, ...toImport])
    toast({ title: `${toImport.length} questões importadas do banco` })
    setBankDialogOpen(false)
  }

  const duplicateQuestion = (idx: number) => {
    const q = { ...questions[idx], id: undefined, display_order: questions.length + 1 }
    setQuestions((prev) => [...prev, q])
    setExpandedQ(questions.length)
  }

  const removeQuestion = async (idx: number) => {
    const q = questions[idx]
    if (q.id) {
      try {
        await deleteQuestion(q.id)
      } catch {
        toast({ title: 'Erro ao deletar questão', variant: 'destructive' })
        return
      }
    }
    setQuestions((prev) => prev.filter((_, i) => i !== idx))
    if (expandedQ === idx) setExpandedQ(null)
  }

  const moveQuestion = (idx: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= questions.length) return
    setQuestions((prev) => {
      const arr = [...prev]
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return arr
    })
    setExpandedQ(target)
  }

  const addReadingText = () => {
    setReadingTexts((prev) => [...prev, newReadingText()])
    setExpandedText(readingTexts.length)
  }

  const updateText = (idx: number, field: keyof ReadingTextFormData, value: string) => {
    setReadingTexts((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)))
  }

  const removeReadingText = async (idx: number) => {
    const t = readingTexts[idx]
    if (t.id) {
      try {
        await deleteReadingText(t.id)
      } catch {
        toast({ title: 'Erro ao deletar texto', variant: 'destructive' })
        return
      }
    }
    // Unlink questions referencing this text
    const removedId = t.id
    if (removedId) {
      setQuestions((prev) =>
        prev.map((q) => (q.reading_text_id === removedId ? { ...q, reading_text_id: null } : q)),
      )
    }
    setReadingTexts((prev) => prev.filter((_, i) => i !== idx))
    if (expandedText === idx) setExpandedText(null)
  }

  // ─── Save ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Preencha o título do simulado', variant: 'destructive' })
      return
    }

    try {
      setSaving(true)

      // 1. Save or create simulation
      let quizId = simulationId
      if (isEditing) {
        await updateSimulation(simulationId!, {
          title: form.title,
          description: form.description || null,
          instructions: form.instructions || null,
          duration_minutes: form.duration_minutes,
          passing_score: form.passing_score,
          shuffle_questions: form.shuffle_questions,
          shuffle_options: form.shuffle_options,
          show_results_immediately: form.show_results_immediately,
          allow_review: form.allow_review,
        })
      } else {
        const created = await createSimulation({
          title: form.title,
          description: form.description || null,
          instructions: form.instructions || null,
          duration_minutes: form.duration_minutes,
          passing_score: form.passing_score,
          shuffle_questions: form.shuffle_questions,
          shuffle_options: form.shuffle_options,
          show_results_immediately: form.show_results_immediately,
          allow_review: form.allow_review,
          status: 'draft',
        })
        quizId = created.id
      }

      // 2. Save reading texts (parallel)
      const savedTexts = await Promise.all(
        readingTexts.map(async (text) => {
          if (text.id) {
            await updateReadingText(text.id, {
              title: text.title || null, content: text.content,
              author: text.author || null, source: text.source || null,
            })
            return text
          } else {
            const created = await createReadingText({
              quiz_id: quizId!, title: text.title || null, content: text.content,
              author: text.author || null, source: text.source || null,
            })
            return { ...text, id: created.id }
          }
        })
      )

      // 3. Save questions — delete existing, then batch insert
      if (isEditing) {
        await supabase.from('quiz_questions').delete().eq('quiz_id', quizId!)
      }

      const questionsToInsert = questions.map((q, i) => ({
        quiz_id: quizId!,
        question_text: q.question_text,
        question_type: q.question_format === 'essay' ? 'open' : 'closed',
        question_format: q.question_format,
        options: q.question_format === 'multiple_choice' ? q.options : null,
        correct_answer: q.correct_answer,
        explanation: q.explanation || null,
        difficulty: q.difficulty || 'medium',
        points: q.points || 1,
        question_image_url: q.question_image_url || null,
        reading_text_id: q.reading_text_id || null,
        display_order: i + 1,
      }))

      // Batch insert in chunks of 50
      for (let i = 0; i < questionsToInsert.length; i += 50) {
        const batch = questionsToInsert.slice(i, i + 50)
        const { error } = await supabase.from('quiz_questions').insert(batch)
        if (error) throw error
      }

      toast({ title: `Simulado ${isEditing ? 'atualizado' : 'criado'} com sucesso!` })
      navigate('/admin/simulations')
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) return <SectionLoader />

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/admin/simulations')}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <h1 className="text-2xl font-bold text-foreground">
            {isEditing ? 'Editar Simulado' : 'Novo Simulado'}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      {/* ─── Dados do Simulado ─────────────────────────────────────── */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>Dados Gerais</CardTitle>
          <CardDescription>Informações básicas do simulado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input
              value={form.title}
              onChange={(e) => updateForm('title', e.target.value)}
              placeholder="Ex: Simulado ENEM 2026 - Ciências da Natureza"
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              placeholder="Breve descrição do simulado..."
              rows={3}
            />
          </div>
          <div>
            <Label>Instruções para o aluno</Label>
            <Textarea
              value={form.instructions}
              onChange={(e) => updateForm('instructions', e.target.value)}
              placeholder="Instruções que aparecerão antes de iniciar o simulado..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Duração (minutos)</Label>
              <Input
                type="number"
                value={form.duration_minutes}
                onChange={(e) => updateForm('duration_minutes', Number(e.target.value))}
                min={1}
              />
            </div>
            <div>
              <Label>Nota mínima (%)</Label>
              <Input
                type="number"
                value={form.passing_score}
                onChange={(e) => updateForm('passing_score', Number(e.target.value))}
                min={0}
                max={100}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label className="cursor-pointer">Embaralhar questões</Label>
              <Switch
                checked={form.shuffle_questions}
                onCheckedChange={(v) => updateForm('shuffle_questions', v)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label className="cursor-pointer">Embaralhar opções</Label>
              <Switch
                checked={form.shuffle_options}
                onCheckedChange={(v) => updateForm('shuffle_options', v)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label className="cursor-pointer">Mostrar resultado imediato</Label>
              <Switch
                checked={form.show_results_immediately}
                onCheckedChange={(v) => updateForm('show_results_immediately', v)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label className="cursor-pointer">Permitir revisão</Label>
              <Switch
                checked={form.allow_review}
                onCheckedChange={(v) => updateForm('allow_review', v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Textos de Leitura ─────────────────────────────────────── */}
      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Textos de Apoio
            </CardTitle>
            <CardDescription>
              Textos que podem ser vinculados às questões (interpretação de texto, artigos, etc.)
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addReadingText} className="gap-2">
            <Plus className="h-4 w-4" />
            Texto
          </Button>
        </CardHeader>
        {readingTexts.length > 0 && (
          <CardContent className="space-y-3">
            {readingTexts.map((text, idx) => {
              const isExpanded = expandedText === idx
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-border bg-muted/30 transition-all duration-200"
                >
                  {/* Header */}
                  <button
                    type="button"
                    onClick={() => setExpandedText(isExpanded ? null : idx)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">
                        Texto {idx + 1}
                      </Badge>
                      <span className="text-sm font-medium text-foreground truncate max-w-[300px]">
                        {text.title || 'Sem título'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Deletar texto?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Questões vinculadas a este texto serão desvinculadas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeReadingText(idx)}>
                              Deletar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Body */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      <div>
                        <Label>Título</Label>
                        <Input
                          value={text.title}
                          onChange={(e) => updateText(idx, 'title', e.target.value)}
                          placeholder="Título do texto"
                        />
                      </div>
                      <div>
                        <Label>Conteúdo *</Label>
                        <Textarea
                          value={text.content}
                          onChange={(e) => updateText(idx, 'content', e.target.value)}
                          placeholder="Cole o texto de leitura aqui..."
                          rows={8}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Autor</Label>
                          <Input
                            value={text.author}
                            onChange={(e) => updateText(idx, 'author', e.target.value)}
                            placeholder="Autor do texto"
                          />
                        </div>
                        <div>
                          <Label>Fonte</Label>
                          <Input
                            value={text.source}
                            onChange={(e) => updateText(idx, 'source', e.target.value)}
                            placeholder="Fonte/Referência"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        )}
      </Card>

      {/* ─── Questões ──────────────────────────────────────────────── */}
      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>
              Questões
              {questions.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {questions.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Adicione questões de múltipla escolha, verdadeiro/falso, dissertativa ou lacuna.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openBankDialog} className="gap-2">
              <Search className="h-4 w-4" />
              Banco de Questões
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addQuestion} className="gap-2">
              <Plus className="h-4 w-4" />
              Questão
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Nenhuma questão adicionada.</p>
              <Button
                type="button"
                variant="outline"
                onClick={addQuestion}
                className="mt-4 gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar Primeira Questão
              </Button>
            </div>
          )}

          {questions.map((q, idx) => {
            const isExpanded = expandedQ === idx
            return (
              <div
                key={idx}
                className={cn(
                  'rounded-xl border transition-all duration-200',
                  isExpanded ? 'border-primary/30 shadow-md' : 'border-border bg-muted/30',
                )}
              >
                {/* Question Header */}
                <button
                  type="button"
                  onClick={() => setExpandedQ(isExpanded ? null : idx)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          moveQuestion(idx, 'up')
                        }}
                        disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          moveQuestion(idx, 'down')
                        }}
                        disabled={idx === questions.length - 1}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    <Badge className="shrink-0">{idx + 1}</Badge>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {QUESTION_FORMAT_LABELS[q.question_format]}
                    </Badge>
                    <span className="text-sm text-foreground truncate max-w-[300px]">
                      {q.question_text || 'Sem enunciado'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {q.correct_answer ? (
                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                        Resp. definida
                      </Badge>
                    ) : q.question_format !== 'essay' ? (
                      <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                        Sem resposta
                      </Badge>
                    ) : null}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        duplicateQuestion(idx)
                      }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Deletar questão {idx + 1}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeQuestion(idx)}>
                            Deletar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Question Body */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* Row 1: Format + Difficulty + Points */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Tipo de Questão</Label>
                        <Select
                          value={q.question_format}
                          onValueChange={(v) => {
                            updateQ(idx, 'question_format', v as QuestionFormat)
                            if (v === 'true_false') {
                              updateQ(idx, 'options', ['Verdadeiro', 'Falso'])
                              updateQ(idx, 'correct_answer', '')
                            } else if (v === 'multiple_choice' && q.options.length < 2) {
                              updateQ(idx, 'options', ['', '', '', ''])
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(QUESTION_FORMAT_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Dificuldade</Label>
                        <Select
                          value={q.difficulty}
                          onValueChange={(v) => updateQ(idx, 'difficulty', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Pontos</Label>
                        <Input
                          type="number"
                          value={q.points}
                          onChange={(e) => updateQ(idx, 'points', Number(e.target.value))}
                          min={1}
                        />
                      </div>
                    </div>

                    {/* Reading text link */}
                    {readingTexts.length > 0 && (
                      <div>
                        <Label>Texto de Apoio (opcional)</Label>
                        <Select
                          value={q.reading_text_id || '_none'}
                          onValueChange={(v) =>
                            updateQ(idx, 'reading_text_id', v === '_none' ? null : v)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Nenhum" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Nenhum</SelectItem>
                            {readingTexts
                              .filter((t) => t.id)
                              .map((t, tIdx) => (
                                <SelectItem key={t.id} value={t.id!}>
                                  Texto {tIdx + 1}: {t.title || 'Sem título'}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {!readingTexts.some((t) => t.id) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Salve o simulado primeiro para vincular textos às questões.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Question text */}
                    <div>
                      <Label>Enunciado *</Label>
                      <Textarea
                        value={q.question_text}
                        onChange={(e) => updateQ(idx, 'question_text', e.target.value)}
                        placeholder="Digite o enunciado da questão..."
                        rows={4}
                      />
                    </div>

                    {/* Image URL */}
                    <div>
                      <Label>URL da Imagem (opcional)</Label>
                      <Input
                        value={q.question_image_url}
                        onChange={(e) => updateQ(idx, 'question_image_url', e.target.value)}
                        placeholder="https://..."
                      />
                      {q.question_image_url && (
                        <img
                          src={q.question_image_url}
                          alt="Preview"
                          className="mt-2 max-h-40 rounded-lg border border-border object-contain"
                        />
                      )}
                    </div>

                    {/* Options - Multiple Choice */}
                    {q.question_format === 'multiple_choice' && (
                      <div className="space-y-3">
                        <Label>Opções (marque a correta)</Label>
                        <RadioGroup
                          value={q.correct_answer}
                          onValueChange={(v) => updateQ(idx, 'correct_answer', v)}
                        >
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <RadioGroupItem value={opt || `__empty_${optIdx}`} id={`q${idx}-opt${optIdx}`} disabled={!opt} />
                              <span className="text-sm font-bold text-muted-foreground w-6">
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <Input
                                value={opt}
                                onChange={(e) => {
                                  const oldVal = opt
                                  updateOption(idx, optIdx, e.target.value)
                                  if (q.correct_answer === oldVal && e.target.value) {
                                    updateQ(idx, 'correct_answer', e.target.value)
                                  }
                                }}
                                placeholder={`Opção ${String.fromCharCode(65 + optIdx)}`}
                                className="flex-1"
                              />
                              {q.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => removeOption(idx, optIdx)}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <Trash className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </RadioGroup>
                        {q.options.length < 8 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addOption(idx)}
                            className="gap-1 text-xs"
                          >
                            <Plus className="h-3 w-3" />
                            Adicionar Opção
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Options - True/False */}
                    {q.question_format === 'true_false' && (
                      <div>
                        <Label>Resposta Correta</Label>
                        <RadioGroup
                          value={q.correct_answer}
                          onValueChange={(v) => updateQ(idx, 'correct_answer', v)}
                          className="flex gap-4 mt-2"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="Verdadeiro" id={`q${idx}-true`} />
                            <Label htmlFor={`q${idx}-true`}>Verdadeiro</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="Falso" id={`q${idx}-false`} />
                            <Label htmlFor={`q${idx}-false`}>Falso</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    )}

                    {/* Fill blank */}
                    {q.question_format === 'fill_blank' && (
                      <div>
                        <Label>Resposta Correta</Label>
                        <Input
                          value={q.correct_answer}
                          onChange={(e) => updateQ(idx, 'correct_answer', e.target.value)}
                          placeholder="Resposta esperada para a lacuna"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Use ___ (três underlines) no enunciado para marcar a lacuna.
                        </p>
                      </div>
                    )}

                    {/* Essay - no correct answer needed */}
                    {q.question_format === 'essay' && (
                      <div className="rounded-lg border border-border bg-muted/50 p-3">
                        <p className="text-sm text-muted-foreground">
                          Questões dissertativas são corrigidas manualmente. Não há resposta correta automática.
                        </p>
                      </div>
                    )}

                    {/* Explanation */}
                    <div>
                      <Label>Explicação / Gabarito Comentado (opcional)</Label>
                      <Textarea
                        value={q.explanation}
                        onChange={(e) => updateQ(idx, 'explanation', e.target.value)}
                        placeholder="Explicação que será mostrada após o aluno responder..."
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {questions.length > 0 && (
            <Button type="button" variant="outline" onClick={addQuestion} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Questão
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ─── Bottom Save ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate('/admin/simulations')}>
          Cancelar
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {questions.length} questão{questions.length !== 1 ? 'ões' : ''}
            {readingTexts.length > 0 && ` · ${readingTexts.length} texto${readingTexts.length !== 1 ? 's' : ''}`}
          </span>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar Simulado'}
          </Button>
        </div>
      </div>
      {/* ─── Bank Import Dialog ─────────────────────────────────────── */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar do Banco de Questões</DialogTitle>
          </DialogHeader>
          <div className="flex gap-3 mb-3">
            <Select value={bankFilterSubject} onValueChange={(v) => { setBankFilterSubject(v); setBankFilterTopic('all') }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Matéria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Matérias</SelectItem>
                {bankSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={bankFilterTopic} onValueChange={setBankFilterTopic}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tópico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tópicos</SelectItem>
                {bankTopics
                  .filter(t => bankFilterSubject === 'all' || t.subject_id === bankFilterSubject)
                  .map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                }
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              {bankSelected.size > 0 && <Badge>{bankSelected.size} selecionadas</Badge>}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {bankLoading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando questões...</div>
            ) : (
              (() => {
                const filtered = bankQuestions.filter(q => {
                  if (bankFilterSubject !== 'all' && q.topics?.subjects?.id !== bankFilterSubject) return false
                  if (bankFilterTopic !== 'all' && q.topics?.id !== bankFilterTopic) return false
                  return true
                })
                if (filtered.length === 0) return <div className="text-center py-12 text-muted-foreground">Nenhuma questão encontrada com esses filtros.</div>
                return filtered.map(q => (
                  <div
                    key={q.id}
                    onClick={() => setBankSelected(prev => {
                      const next = new Set(prev)
                      if (next.has(q.id)) next.delete(q.id); else next.add(q.id)
                      return next
                    })}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${bankSelected.has(q.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                  >
                    <Checkbox checked={bankSelected.has(q.id)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{q.question_text}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">{q.topics?.subjects?.name}</span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground">{q.topics?.name}</span>
                      </div>
                    </div>
                  </div>
                ))
              })()
            )}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setBankDialogOpen(false)}>Cancelar</Button>
            <Button onClick={importFromBank} disabled={bankSelected.size === 0} className="gap-2">
              <Plus className="h-4 w-4" />
              Importar {bankSelected.size > 0 ? `(${bankSelected.size})` : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
