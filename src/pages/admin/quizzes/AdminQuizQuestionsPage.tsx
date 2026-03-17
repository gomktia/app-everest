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
import { ArrowLeft, Trash, Upload, Download, Loader2, BookOpen, Plus, Pencil } from 'lucide-react'
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
  type ReadingText
} from '@/services/adminQuizService'
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
  const [readingTexts, setReadingTexts] = useState<ReadingText[]>([])

  // State for Reading Text Dialog
  const [isTextDialogOpen, setIsTextDialogOpen] = useState(false)
  const [editingText, setEditingText] = useState<ReadingText | null>(null)
  const [textFormTitle, setTextFormTitle] = useState('')
  const [textFormContent, setTextFormContent] = useState('')

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
        reading_text_id: q.reading_text_id
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
      setIsLoading(true)
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
      setIsLoading(false)
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
                <FormLabel>Título do Texto</FormLabel>
                <Input
                  placeholder="Ex: Texto I - A Importância da Leitura"
                  value={textFormTitle}
                  onChange={e => setTextFormTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <FormLabel>Conteúdo do Texto</FormLabel>
                <Textarea
                  className="min-h-[300px]"
                  placeholder="Cole o texto aqui..."
                  value={textFormContent}
                  onChange={e => setTextFormContent(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveText} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
          {fields.map((field, index) => (
            <Card key={field.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Questão {index + 1}</CardTitle>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => remove(index)}
                >
                  <Trash className="h-4 w-4" />
                </Button>
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
                        defaultValue={radioField.value}
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
          ))}
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
    </>
  )
}
