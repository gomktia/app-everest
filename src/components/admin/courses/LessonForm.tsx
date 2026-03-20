import { useFormContext } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { PandaVideoPickerModal } from './PandaVideoPickerModal'
import { useState } from 'react'
import { type PandaVideo } from '@/services/pandaVideo'
import { Video, Upload, Trash2, Star, ListChecks, X, Sparkles, Loader2, CheckCircle, Edit } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { QuizPickerModal } from './QuizPickerModal'
import { type Quiz } from '@/services/quizService'
import { logger } from '@/lib/logger'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { aiAssistantService } from '@/services/ai/aiAssistantService'
import { extractTextFromPDFWithLimit } from '@/lib/pdfTextExtractor'

interface Attachment {
  id: string
  name: string
  url?: string
  type: 'pdf' | 'doc' | 'image' | string
}

interface GeneratedQuestion {
  question_text: string
  question_type: string
  options: string[]
  correct_answer: string
  explanation: string
  difficulty: number
  tags: string[]
  edited?: boolean
}

interface LessonFormProps {
  moduleIndex: number
  lessonIndex: number
}

export const LessonForm = ({ moduleIndex, lessonIndex }: LessonFormProps) => {
  const { control, setValue, watch } = useFormContext()
  const [isVideoPickerOpen, setIsVideoPickerOpen] = useState(false)
  const [isQuizPickerOpen, setIsQuizPickerOpen] = useState(false)
  const [isQuizGenOpen, setIsQuizGenOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [numQuestions, setNumQuestions] = useState('10')
  const [difficulty, setDifficulty] = useState('mixed')
  const [questionType, setQuestionType] = useState('mixed')
  const { toast } = useToast()

  const videoSourceId = watch(
    `modules.${moduleIndex}.lessons.${lessonIndex}.video_source_id`,
  )
  const attachments =
    watch(`modules.${moduleIndex}.lessons.${lessonIndex}.attachments`) || [] as Attachment[]
  const accompanyingPdfId = watch(
    `modules.${moduleIndex}.lessons.${lessonIndex}.accompanyingPdfId`,
  )
  const associatedQuiz = watch(
    `modules.${moduleIndex}.lessons.${lessonIndex}.quiz`,
  )
  const lessonTitle = watch(
    `modules.${moduleIndex}.lessons.${lessonIndex}.title`,
  ) as string | undefined

  const pdfAttachments = (attachments as Attachment[]).filter((a) => a.type === 'pdf')

  const handleVideoSelect = (video: PandaVideo) => {
    setValue(
      `modules.${moduleIndex}.lessons.${lessonIndex}.video_source_id`,
      video.id,
    )
    setValue(`modules.${moduleIndex}.lessons.${lessonIndex}.title`, video.title)
    setValue(
      `modules.${moduleIndex}.lessons.${lessonIndex}.duration_seconds`,
      video.duration,
    )
    setValue(
      `modules.${moduleIndex}.lessons.${lessonIndex}.video_source_type`,
      'panda_video',
    )
  }

  const handleQuizSelect = (quiz: Quiz) => {
    setValue(`modules.${moduleIndex}.lessons.${lessonIndex}.quiz`, {
      id: quiz.id,
      title: quiz.title,
    })
  }

  const removeQuiz = () => {
    setValue(`modules.${moduleIndex}.lessons.${lessonIndex}.quiz`, undefined)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo permitido é 50MB.',
        variant: 'destructive',
      })
      return
    }

    try {
      toast({
        title: 'Upload iniciado',
        description: `${file.name} está sendo enviado.`,
      })

      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`
      const filePath = `attachments/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('course_materials')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('course_materials')
        .getPublicUrl(filePath)

      const newAttachment = {
        id: `att_${Date.now()}`,
        name: file.name,
        url: publicUrl,
        type: file.type.includes('pdf') ? 'pdf' : 'docx',
        file_path: filePath
      }

      setValue(`modules.${moduleIndex}.lessons.${lessonIndex}.attachments`, [
        ...attachments,
        newAttachment,
      ])

      toast({
        title: 'Upload concluído',
        description: 'Arquivo enviado com sucesso.',
      })
    } catch (error) {
      logger.error('Error uploading file:', error)
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível enviar o arquivo.',
        variant: 'destructive',
      })
    }
  }

  const setAccompanyingPdf = (attachmentId: string) => {
    setValue(
      `modules.${moduleIndex}.lessons.${lessonIndex}.accompanyingPdfId`,
      attachmentId,
    )
  }

  const handleGenerate = async () => {
    const firstPdf = pdfAttachments[0]
    if (!firstPdf?.url) {
      toast({
        title: 'PDF sem URL',
        description: 'O arquivo PDF não possui uma URL pública disponível.',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    setGeneratedQuestions([])

    try {
      const text = await extractTextFromPDFWithLimit(firstPdf.url)

      if (!text.trim()) {
        toast({
          title: 'PDF sem texto',
          description: 'Não foi possível extrair texto do PDF. Verifique se o arquivo não é uma imagem escaneada.',
          variant: 'destructive',
        })
        return
      }

      const difficultyMap: Record<string, 'easy' | 'medium' | 'hard' | 'mixed'> = {
        easy: 'easy',
        medium: 'medium',
        hard: 'hard',
        mixed: 'mixed',
      }
      const typeMap: Record<string, 'multiple_choice' | 'true_false' | 'mixed'> = {
        multiple_choice: 'multiple_choice',
        true_false: 'true_false',
        mixed: 'mixed',
      }

      const result = await aiAssistantService.generateQuiz({
        content_text: text,
        num_questions: parseInt(numQuestions),
        difficulty: difficultyMap[difficulty] ?? 'mixed',
        gen_question_type: typeMap[questionType] ?? 'mixed',
      })

      setGeneratedQuestions(result.questions)
    } catch (err) {
      logger.error('Erro ao gerar quiz:', err)
      toast({
        title: 'Erro ao gerar quiz',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveQuestions = async () => {
    if (generatedQuestions.length === 0) return

    setIsSaving(true)
    try {
      const sourceExam = `IA - ${lessonTitle || 'Aula'}`
      const quizId = associatedQuiz?.id ?? null

      const rows = generatedQuestions.map((q) => ({
        quiz_id: quizId,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        points: 1,
        difficulty: q.difficulty,
        tags: q.tags,
        source_type: 'ai_generated',
        source_exam: sourceExam,
        source_banca: null,
      }))

      const { error } = await supabase.from('quiz_questions').insert(rows)
      if (error) throw error

      toast({
        title: 'Questões salvas',
        description: `${rows.length} questão(ões) adicionadas ao Banco de Questões.`,
      })

      setIsQuizGenOpen(false)
      setGeneratedQuestions([])
    } catch (err) {
      logger.error('Erro ao salvar questões:', err)
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const updateQuestion = (index: number, field: keyof GeneratedQuestion, value: string | string[]) => {
    setGeneratedQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value, edited: true } : q))
    )
  }

  const difficultyLabel: Record<number, string> = { 1: 'Fácil', 2: 'Médio', 3: 'Difícil' }

  return (
    <>
      <PandaVideoPickerModal
        isOpen={isVideoPickerOpen}
        onOpenChange={setIsVideoPickerOpen}
        onVideoSelect={handleVideoSelect}
      />
      <QuizPickerModal
        isOpen={isQuizPickerOpen}
        onOpenChange={setIsQuizPickerOpen}
        onQuizSelect={handleQuizSelect}
      />

      {/* AI Quiz Generation Dialog */}
      <Dialog open={isQuizGenOpen} onOpenChange={setIsQuizGenOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Gerar Quiz com IA
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* PDF info */}
            {pdfAttachments[0] && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
                <span className="font-medium text-muted-foreground">PDF:</span>
                <span className="truncate">{pdfAttachments[0].name}</span>
              </div>
            )}

            {/* Options */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Número de questões</Label>
                <Select value={numQuestions} onValueChange={setNumQuestions}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Dificuldade</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Fácil</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="hard">Difícil</SelectItem>
                    <SelectItem value="mixed">Misto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Tipo de questão</Label>
                <Select value={questionType} onValueChange={setQuestionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Múltipla escolha</SelectItem>
                    <SelectItem value="true_false">Certo-Errado</SelectItem>
                    <SelectItem value="mixed">Misto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando questões...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar
                </>
              )}
            </Button>

            {/* Generated questions preview */}
            {generatedQuestions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">
                    {generatedQuestions.length} questão(ões) gerada(s)
                  </span>
                </div>

                {generatedQuestions.map((q, idx) => (
                  <Card key={idx} className={q.edited ? 'border-blue-400' : ''}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="secondary">
                            {q.question_type === 'multiple_choice' ? 'Múltipla escolha' : 'Certo-Errado'}
                          </Badge>
                          <Badge variant="outline">
                            {difficultyLabel[q.difficulty] ?? 'Médio'}
                          </Badge>
                          {q.edited && <Badge variant="outline" className="text-blue-500 border-blue-400">Editada</Badge>}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingIndex(editingIndex === idx ? null : idx)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>

                      {editingIndex === idx ? (
                        <div className="space-y-2">
                          <Textarea
                            value={q.question_text}
                            onChange={(e) => updateQuestion(idx, 'question_text', e.target.value)}
                            rows={3}
                            className="text-sm"
                          />
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground w-5">
                                {String.fromCharCode(65 + optIdx)})
                              </span>
                              <Input
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...q.options]
                                  newOpts[optIdx] = e.target.value
                                  updateQuestion(idx, 'options', newOpts)
                                }}
                                className="text-sm h-8"
                              />
                            </div>
                          ))}
                          <div className="space-y-1">
                            <Label className="text-xs">Gabarito</Label>
                            <Input
                              value={q.correct_answer}
                              onChange={(e) => updateQuestion(idx, 'correct_answer', e.target.value)}
                              className="text-sm h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Explicação</Label>
                            <Textarea
                              value={q.explanation}
                              onChange={(e) => updateQuestion(idx, 'explanation', e.target.value)}
                              rows={2}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm">{q.question_text}</p>
                          {q.options.length > 0 && (
                            <ul className="space-y-1">
                              {q.options.map((opt, optIdx) => (
                                <li
                                  key={optIdx}
                                  className={`text-xs flex gap-1 ${opt === q.correct_answer ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}
                                >
                                  <span className="font-mono">{String.fromCharCode(65 + optIdx)})</span>
                                  <span>{opt}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {q.explanation && (
                            <p className="text-xs text-muted-foreground italic border-t pt-1">
                              {q.explanation}
                            </p>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setIsQuizGenOpen(false)}>
              Cancelar
            </Button>
            {generatedQuestions.length > 0 && (
              <Button
                type="button"
                onClick={handleSaveQuestions}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Salvar no Banco de Questões
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <FormField
          control={control}
          name={`modules.${moduleIndex}.lessons.${lessonIndex}.title`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título da Aula</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`modules.${moduleIndex}.lessons.${lessonIndex}.description`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FormLabel>Vídeo</FormLabel>
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsVideoPickerOpen(true)}
              >
                <Video className="mr-2 h-4 w-4" />
                {videoSourceId ? 'Alterar Vídeo' : 'Selecionar Vídeo'}
              </Button>
              {videoSourceId && (
                <p className="text-sm text-muted-foreground mt-2">
                  ID: {videoSourceId}
                </p>
              )}
            </div>
          </div>
          <div>
            <FormLabel>Quiz Pós-Aula</FormLabel>
            <div className="mt-2 space-y-2">
              {associatedQuiz ? (
                <div className="flex items-center justify-between p-2 border rounded-md text-sm">
                  <p className="truncate">{associatedQuiz.title}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={removeQuiz}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsQuizPickerOpen(true)}
                >
                  <ListChecks className="mr-2 h-4 w-4" />
                  Associar Quiz
                </Button>
              )}
              {pdfAttachments.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-purple-600 border-purple-300 hover:bg-purple-50 hover:text-purple-700"
                  onClick={() => {
                    setGeneratedQuestions([])
                    setIsQuizGenOpen(true)
                  }}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar Quiz com IA
                </Button>
              )}
            </div>
          </div>
        </div>
        <div>
          <FormLabel>Materiais de Apoio</FormLabel>
          <div className="mt-2 space-y-2">
            {attachments.map((att: Attachment) => (
              <div
                key={att.id}
                className="flex items-center justify-between p-2 border rounded-md"
              >
                <p className="text-sm">{att.name}</p>
                <div className="flex items-center gap-1">
                  {att.type === 'pdf' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setAccompanyingPdf(att.id)}
                    >
                      <Star
                        className={`h-4 w-4 ${accompanyingPdfId === att.id
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-muted-foreground'
                          }`}
                      />
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" asChild>
              <label>
                <Upload className="mr-2 h-4 w-4" />
                Adicionar Arquivo
                <Input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </Button>
            {attachments.some((a: Attachment) => a.type === 'pdf') && (
              <p className="text-xs text-muted-foreground">
                Clique na estrela <Star className="inline h-3 w-3" /> para
                definir o PDF de acompanhamento.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-8">
          <FormField
            control={control}
            name={`modules.${moduleIndex}.lessons.${lessonIndex}.is_active`}
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel>Ativa</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`modules.${moduleIndex}.lessons.${lessonIndex}.is_preview`}
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel>Prévia Gratuita</FormLabel>
              </FormItem>
            )}
          />
        </div>
      </div>
    </>
  )
}
