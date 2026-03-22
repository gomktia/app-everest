import { useParams, useNavigate } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { logger } from '@/lib/logger'
import { usePageTitle } from '@/hooks/usePageTitle'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Trash, Upload, Download, Loader2, BookOpen, Plus, Pencil, Search, ArrowRightLeft, AlertTriangle } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import { useToast } from '@/components/ui/use-toast'
import {
  formatQuizQuestionsForExport,
  parseQuizQuestionsFromFile,
  downloadTxtFile,
  type ImportError,
} from '@/lib/importExport'
import { ImportErrorsDialog } from '@/components/admin/ImportErrorsDialog'
import {
  getQuizQuestions,
  saveQuizQuestions,
  getReadingTexts,
  createReadingText,
  updateReadingText,
  deleteReadingText,
  getAllQuestions,
  moveQuestionToQuiz,
  getQuizzesForMove,
  type ReadingText
} from '@/services/adminQuizService'
import { supabase } from '@/lib/supabase/client'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { SectionLoader } from '@/components/SectionLoader'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'

const questionSchema = z.object({
  id: z.string().optional(),
  question_text: z.string().min(1, 'A pergunta é obrigatória.'),
  options: z.array(z.string().min(1)).length(4, 'Deve haver 4 opções.'),
  correct_answer: z.string().min(1, 'Selecione a resposta correta.'),
  explanation: z.string().optional(),
  points: z.coerce.number().default(1),
  reading_text_id: z.string().optional().nullable(),
  needs_review: z.boolean().optional(),
})

const quizQuestionsSchema = z.object({
  questions: z.array(questionSchema),
})

type QuizQuestionsFormValues = z.infer<typeof quizQuestionsSchema>

export default function AdminQuizQuestionsPage() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  usePageTitle('Questões do Quiz')
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importErrors, setImportErrors] = useState<ImportError[]>([])
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingText, setIsSavingText] = useState(false)
  const [readingTexts, setReadingTexts] = useState<ReadingText[]>([])

  // State for Reading Text Dialog
  const [isTextDialogOpen, setIsTextDialogOpen] = useState(false)

  // Bank import state
  const [bankOpen, setBankOpen] = useState(false)
  const [bankQuestions, setBankQuestions] = useState<any[]>([])
  const [bankSubjects, setBankSubjects] = useState<{ id: string; name: string }[]>([])
  const [bankTopics, setBankTopics] = useState<{ id: string; name: string; subject_id: string }[]>([])
  const [bankFilterSubject, setBankFilterSubject] = useState('all')
  const [bankFilterTopic, setBankFilterTopic] = useState('all')
  const [bankSelected, setBankSelected] = useState<Set<string>>(new Set())
  const [bankLoading, setBankLoading] = useState(false)
  const [editingText, setEditingText] = useState<ReadingText | null>(null)
  const [textFormTitle, setTextFormTitle] = useState('')
  const [textFormContent, setTextFormContent] = useState('')

  // Move question state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [moveQuestionIndex, setMoveQuestionIndex] = useState<number | null>(null)
  const [moveQuizzes, setMoveQuizzes] = useState<Array<{ id: string; title: string; topic_id: string; topics: { name: string; subject_id: string; subjects: { name: string } } | null }>>([])
  const [moveFilterSubject, setMoveFilterSubject] = useState('all')
  const [moveLoading, setMoveLoading] = useState(false)
  const [moveTargetQuizId, setMoveTargetQuizId] = useState('')
  const [showOnlyReview, setShowOnlyReview] = useState(false)

  const form = useForm<QuizQuestionsFormValues>({
    resolver: zodResolver(quizQuestionsSchema),
    defaultValues: {
      questions: [],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'questions',
  })

  useEffect(() => {
    if (quizId) {
      loadData()
    }
  }, [quizId])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [questionsData, textsData] = await Promise.all([
        getQuizQuestions(quizId!),
        getReadingTexts(quizId!)
      ])

      setReadingTexts(textsData || [])

      const formatted = questionsData.map((q) => ({
        id: q.id,
        question_text: q.question_text,
        options: (Array.isArray(q.options) ? q.options : []) as string[],
        correct_answer: q.correct_answer,
        explanation: q.explanation || '',
        points: q.points,
        reading_text_id: q.reading_text_id,
        needs_review: q.needs_review || false,
      }))
      form.reset({ questions: formatted })
    } catch (error) {
      logger.error('Error loading data:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados do quiz.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveText = async () => {
    if (!textFormTitle || !textFormContent) {
      toast({ title: "Preencha todos os campos", variant: "destructive" })
      return
    }

    try {
      setIsSavingText(true)
      if (editingText) {
        await updateReadingText(editingText.id, { title: textFormTitle, content: textFormContent })
        toast({ title: "Texto atualizado com sucesso" })
      } else {
        await createReadingText({
          quiz_id: quizId!,
          title: textFormTitle,
          content: textFormContent
        })
        toast({ title: "Texto criado com sucesso" })
      }
      setIsTextDialogOpen(false)
      loadData() // Reload everything to refresh list
    } catch (error) {
      logger.error(error)
      toast({ title: "Erro ao salvar texto", variant: "destructive" })
    } finally {
      setIsSavingText(false)
    }
  }

  const handleDeleteText = async (id: string) => {
    if (!confirm("Tem certeza? Isso pode afetar questões vinculadas.")) return
    try {
      await deleteReadingText(id)
      toast({ title: "Texto removido" })
      loadData()
    } catch (error) {
      toast({ title: "Erro ao remover", variant: "destructive" })
    }
  }

  const openTextDialog = (text?: ReadingText) => {
    if (text) {
      setEditingText(text)
      setTextFormTitle(text.title || '')
      setTextFormContent(text.content)
    } else {
      setEditingText(null)
      setTextFormTitle('')
      setTextFormContent('')
    }
    setIsTextDialogOpen(true)
  }

  const openBank = async () => {
    setBankOpen(true)
    setBankSelected(new Set())
    setBankFilterSubject('all')
    setBankFilterTopic('all')
    if (bankQuestions.length > 0) return
    try {
      setBankLoading(true)
      const [questions, { data: subjects }, { data: topics }] = await Promise.all([
        getAllQuestions(),
        supabase.from('subjects').select('id, name').order('name'),
        supabase.from('topics').select('id, name, subject_id').order('name'),
      ])
      setBankQuestions(questions || [])
      setBankSubjects(subjects || [])
      setBankTopics(topics || [])
    } catch { toast({ title: 'Erro ao carregar questões', variant: 'destructive' }) }
    finally { setBankLoading(false) }
  }

  const importFromBank = () => {
    const selected = bankQuestions.filter(q => bankSelected.has(q.id))
    // Only import multiple_choice with 4+ options; skip true_false (incompatible with 4-option form)
    const compatible = selected.filter(q => {
      const opts = Array.isArray(q.options) ? q.options : []
      return opts.length >= 4
    })
    const skipped = selected.length - compatible.length
    const toImport = compatible.map(q => ({
      question_text: q.question_text,
      options: (Array.isArray(q.options) ? q.options : []).slice(0, 4) as [string, string, string, string],
      correct_answer: q.correct_answer || '',
      explanation: q.explanation || '',
      points: q.points || 1,
      reading_text_id: null,
    }))
    if (toImport.length === 0) {
      toast({ title: skipped > 0 ? `${skipped} questões ignoradas (tipo Certo/Errado não compatível)` : 'Nenhuma questão selecionada', variant: 'destructive' })
      setBankOpen(false)
      return
    }
    for (const q of toImport) { append(q) }
    const msg = skipped > 0 ? `${toImport.length} importadas, ${skipped} ignoradas (Certo/Errado)` : `${toImport.length} questões importadas do banco`
    toast({ title: msg })
    setBankOpen(false)
  }

  const openMoveDialog = async (index: number) => {
    setMoveQuestionIndex(index)
    setMoveTargetQuizId('')
    setMoveFilterSubject('all')
    setMoveDialogOpen(true)
    if (moveQuizzes.length > 0) return
    try {
      setMoveLoading(true)
      const quizzes = await getQuizzesForMove()
      setMoveQuizzes(quizzes.filter(q => q.id !== quizId))
    } catch {
      toast({ title: 'Erro ao carregar quizzes', variant: 'destructive' })
    } finally {
      setMoveLoading(false)
    }
  }

  const handleMoveQuestion = async () => {
    if (moveQuestionIndex === null || !moveTargetQuizId) return
    const question = form.getValues(`questions.${moveQuestionIndex}`)
    if (!question.id) {
      toast({ title: 'Salve a questão antes de mover', variant: 'destructive' })
      return
    }
    try {
      await moveQuestionToQuiz(question.id, moveTargetQuizId)
      remove(moveQuestionIndex)
      const targetQuiz = moveQuizzes.find(q => q.id === moveTargetQuizId)
      toast({ title: `Questão movida para "${targetQuiz?.title || 'outro quiz'}"` })
      setMoveDialogOpen(false)
    } catch {
      toast({ title: 'Erro ao mover questão', variant: 'destructive' })
    }
  }

  const moveSubjects = [...new Map(
    moveQuizzes
      .filter(q => q.topics?.subjects)
      .map(q => [q.topics!.subjects.name, q.topics!.subjects.name])
  ).values()].sort()

  const filteredMoveQuizzes = moveQuizzes.filter(q => {
    if (moveFilterSubject === 'all') return true
    return q.topics?.subjects?.name === moveFilterSubject
  })

  const onSubmit = async (data: QuizQuestionsFormValues) => {
    if (!quizId) return

    try {
      setIsSaving(true)
      const questionsToSave = data.questions.map((q) => ({
        ...q,
        quiz_id: quizId,
        question_type: 'multiple_choice',
        reading_text_id: (!q.reading_text_id || q.reading_text_id === 'none') ? null : q.reading_text_id,
      }))

      await saveQuizQuestions(quizId, questionsToSave)

      toast({ title: 'Sucesso!', description: 'Questões salvas com sucesso.' })
      // Reload to ensure IDs are synced/updated
      loadData()
    } catch (error) {
      logger.error('Error saving questions:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao salvar questões.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = () => {
    const questions = form.getValues('questions').map((q) => ({
      question: q.question_text,
      options: q.options,
      correctAnswer: q.correct_answer,
    }))
    if (questions.length === 0) {
      toast({ title: 'Nenhuma questão para exportar', variant: 'destructive' })
      return
    }
    const content = formatQuizQuestionsForExport(questions)
    downloadTxtFile(content, `quiz-${quizId}-questoes.txt`)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const result = parseQuizQuestionsFromFile(content)

      if (result.errors) {
        setImportErrors(result.errors)
        setIsErrorDialogOpen(true)
      } else if (result.data) {
        const formatted = result.data.map((q) => ({
          question_text: q.question,
          options: q.options,
          correct_answer: q.correctAnswer,
          explanation: '',
          points: 1,
        }))
        replace(formatted)
        toast({
          title: 'Importação Concluída',
          description: `${result.data.length} questões carregadas.`,
        })
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (isLoading) {
    return <SectionLoader />
  }

  return (
    <>
      <Dialog open={isTextDialogOpen} onOpenChange={setIsTextDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Textos de Apoio</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-4 border-r pr-4">
              <Button onClick={() => openTextDialog()} className="w-full" variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Novo Texto
              </Button>
              <div className="space-y-2">
                {readingTexts.map(text => (
                  <div key={text.id} className="flex justify-between items-center p-2 border rounded hover:bg-accent group">
                    <span className="truncate text-sm font-medium">{text.title}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openTextDialog(text)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDeleteText(text.id)}>
                        <Trash className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {readingTexts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum texto cadastrado.</p>}
              </div>
            </div>
            <div className="md:col-span-2 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Título do Texto</label>
                <Input
                  placeholder="Ex: Texto I - A Importância da Leitura"
                  value={textFormTitle}
                  onChange={e => setTextFormTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Conteúdo do Texto</label>
                <Textarea
                  className="min-h-[300px]"
                  placeholder="Cole o texto aqui..."
                  value={textFormContent}
                  onChange={e => setTextFormContent(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveText} disabled={isSavingText}>
                  {isSavingText && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Texto
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ImportErrorsDialog
        errors={importErrors}
        isOpen={isErrorDialogOpen}
        onClose={() => setIsErrorDialogOpen(false)}
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => navigate(`/admin/quizzes`)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold">Gerenciar Questões do Quiz</h1>
            </div>
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".txt"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={openBank}
              >
                <Search className="mr-2 h-4 w-4" /> Banco de Questões
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTextDialogOpen(true)}
              >
                <BookOpen className="mr-2 h-4 w-4" /> Textos de Apoio
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" /> Importar
              </Button>
              <Button type="button" variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" /> Exportar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Questões
              </Button>
            </div>
          </div>
          {(() => {
            const reviewCount = fields.filter((_, i) => form.getValues(`questions.${i}.needs_review`)).length
            if (reviewCount === 0) return null
            return (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>{reviewCount}</strong> questões precisam de verificação de tópico
                </span>
                <Button
                  type="button"
                  variant={showOnlyReview ? 'default' : 'outline'}
                  size="sm"
                  className="ml-auto"
                  onClick={() => setShowOnlyReview(!showOnlyReview)}
                >
                  {showOnlyReview ? 'Mostrar Todas' : 'Filtrar: Verificar Tópico'}
                </Button>
              </div>
            )
          })()}
          {fields.map((field, index) => {
            const needsReview = form.getValues(`questions.${index}.needs_review`)
            if (showOnlyReview && !needsReview) return null
            return (
            <Card key={field.id} className={needsReview ? 'border-amber-300 dark:border-amber-800' : ''}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle>Questão {index + 1}</CardTitle>
                  {needsReview && (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 text-[10px]">
                      Verificar Tópico
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Mover para outro quiz"
                    onClick={() => openMoveDialog(index)}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => remove(index)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name={`questions.${index}.question_text`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Enunciado</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`questions.${index}.reading_text_id`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Texto de Apoio (Opcional)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value || undefined}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um texto base..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {readingTexts.map((text) => (
                            <SelectItem key={text.id} value={text.id}>
                              {text.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Selecione o texto ao qual esta pergunta se refere.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`questions.${index}.correct_answer`}
                  render={({ field: radioField }) => (
                    <FormItem>
                      <FormLabel>Opções (marque a correta)</FormLabel>
                      <RadioGroup
                        onValueChange={radioField.onChange}
                        value={radioField.value}
                        className="space-y-2"
                      >
                        {[0, 1, 2, 3].map((optIndex) => (
                          <FormField
                            key={optIndex}
                            control={form.control}
                            name={`questions.${index}.options.${optIndex}`}
                            render={({ field: optionField }) => (
                              <FormItem className="flex items-center gap-2">
                                <FormControl>
                                  <RadioGroupItem value={optionField.value} />
                                </FormControl>
                                <Input
                                  {...optionField}
                                  placeholder={`Opção ${optIndex + 1}`}
                                />
                              </FormItem>
                            )}
                          />
                        ))}
                      </RadioGroup>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`questions.${index}.explanation`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Explicação (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            )
          })}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              append({
                question_text: '',
                options: ['', '', '', ''],
                correct_answer: '',
                explanation: '',
                points: 1,
              })
            }
          >
            Adicionar Nova Questão
          </Button>
        </form>
      </Form>

      {/* Move Question Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Mover Questão para Outro Quiz</DialogTitle>
          </DialogHeader>
          {moveQuestionIndex !== null && (
            <div className="bg-muted/50 p-3 rounded-lg mb-3">
              <p className="text-sm text-muted-foreground mb-1">Questão {moveQuestionIndex + 1}:</p>
              <p className="text-sm line-clamp-2">{form.getValues(`questions.${moveQuestionIndex}.question_text`)}</p>
            </div>
          )}
          <div className="flex gap-3 mb-3">
            <Select value={moveFilterSubject} onValueChange={setMoveFilterSubject}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filtrar por matéria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Matérias</SelectItem>
                {moveSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {moveLoading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : filteredMoveQuizzes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum quiz encontrado.</div>
            ) : (
              filteredMoveQuizzes.map(q => (
                <div
                  key={q.id}
                  onClick={() => setMoveTargetQuizId(q.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    moveTargetQuizId === q.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <input type="radio" checked={moveTargetQuizId === q.id} readOnly className="accent-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{q.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {q.topics?.subjects?.name} &middot; {q.topics?.name}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleMoveQuestion} disabled={!moveTargetQuizId}>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Mover Questão
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bank Import Dialog */}
      <Dialog open={bankOpen} onOpenChange={setBankOpen}>
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
            {bankSelected.size > 0 && <Badge className="ml-auto self-center">{bankSelected.size} selecionadas</Badge>}
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {bankLoading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : (() => {
              const filtered = bankQuestions.filter(q => {
                if (bankFilterSubject !== 'all' && q.topics?.subjects?.id !== bankFilterSubject) return false
                if (bankFilterTopic !== 'all' && q.topics?.id !== bankFilterTopic) return false
                return true
              })
              if (filtered.length === 0) return <div className="text-center py-12 text-muted-foreground">Nenhuma questão encontrada.</div>
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
            })()}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setBankOpen(false)}>Cancelar</Button>
            <Button onClick={importFromBank} disabled={bankSelected.size === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Importar {bankSelected.size > 0 ? `(${bankSelected.size})` : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
