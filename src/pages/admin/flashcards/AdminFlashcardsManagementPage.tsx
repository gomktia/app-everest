import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { usePageTitle } from '@/hooks/usePageTitle'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Trash,
  Upload,
  Download,
  Plus,
  FileText,
  Layers,
  BookOpen,
  Save
} from 'lucide-react'
import { useRef } from 'react'
import { useToast } from '@/components/ui/use-toast'
import {
  formatFlashcardsForExport,
  parseFlashcardsFromFile,
  downloadTxtFile,
  FLASHCARD_TEMPLATE,
  type ImportError,
} from '@/lib/importExport'
import { ImportErrorsDialog } from '@/components/admin/ImportErrorsDialog'
import { getSubjectById, getTopicWithCards, saveFlashcards } from '@/services/flashcardService'
import type { Subject, TopicWithSubjectAndCards } from '@/services/flashcardService'
import { supabase } from '@/lib/supabase/client'

const flashcardsSchema = z.object({
  flashcards: z.array(
    z.object({
      id: z.string().optional(),
      question: z.string().min(1, 'A pergunta é obrigatória.'),
      answer: z.string().min(1, 'A resposta é obrigatória.'),
      external_resource_url: z
        .string()
        .url('Por favor, insira uma URL válida.')
        .optional()
        .or(z.literal('')),
    }),
  ),
})

type FlashcardsFormValues = z.infer<typeof flashcardsSchema>

export default function AdminFlashcardsManagementPage() {
  const { subjectId, topicId } = useParams<{
    subjectId: string
    topicId: string
  }>()
  const navigate = useNavigate()
  usePageTitle('Gerenciar Flashcards')
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importErrors, setImportErrors] = useState<ImportError[]>([])
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false)
  const [subject, setSubject] = useState<Subject | null>(null)
  const [topic, setTopic] = useState<TopicWithSubjectAndCards | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!subjectId || !topicId) return

      try {
        const [subjectData, topicData] = await Promise.all([
          getSubjectById(subjectId),
          getTopicWithCards(topicId)
        ])

        setSubject(subjectData)
        setTopic(topicData)
      } catch (error) {
        logger.error('Erro ao carregar dados:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [subjectId, topicId])

  const form = useForm<FlashcardsFormValues>({
    resolver: zodResolver(flashcardsSchema),
    defaultValues: {
      flashcards: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'flashcards',
  })

  // Atualizar o form quando os dados do tópico forem carregados
  useEffect(() => {
    if (topic?.flashcards) {
      form.reset({
        flashcards: topic.flashcards.map((f) => ({
          id: f.id,
          question: f.question,
          answer: f.answer,
          external_resource_url: f.external_resource_url || '',
        }))
      })
    }
  }, [topic, form])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`/admin/flashcards/${subjectId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Carregando...</h1>
            <p className="text-muted-foreground">Buscando flashcards...</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (!topic) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`/admin/flashcards/${subjectId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Erro</h1>
            <p className="text-muted-foreground">Tópico não encontrado</p>
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Tópico não encontrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              O tópico que você está procurando não existe ou foi removido
            </p>
            <Button onClick={() => navigate(`/admin/flashcards/${subjectId}`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Tópicos
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const onSubmit = async (data: FlashcardsFormValues) => {
    try {
      if (!topicId) {
        throw new Error('Topic ID não encontrado')
      }

      logger.debug('💾 Salvando flashcards:', {
        topicId,
        count: data.flashcards.length
      })

      const flashcardsToSave = data.flashcards.map((fc, index) => ({
        id: fc.id,
        topic_id: topicId,
        question: fc.question,
        answer: fc.answer,
        external_resource_url: fc.external_resource_url || null,
        difficulty: 0,
        order_index: index
      }))

      await saveFlashcards(topicId, flashcardsToSave)

      logger.success('✅ Flashcards salvos com sucesso!')
      toast({
        title: 'Sucesso!',
        description: `${data.flashcards.length} flashcards salvos com sucesso.`
      })

      // Reload to ensure we get IDs for new cards
      const updatedTopic = await getTopicWithCards(topicId)
      if (updatedTopic) {
        setTopic(updatedTopic)
      }

    } catch (error) {
      logger.error('❌ Erro ao salvar flashcards:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar os flashcards.',
        variant: 'destructive'
      })
    }
  }

  const handleExport = () => {
    const flashcards = form.getValues('flashcards')
    if (flashcards.length === 0) {
      toast({
        title: 'Nenhum card para exportar',
        variant: 'destructive',
      })
      return
    }
    const content = formatFlashcardsForExport(flashcards)
    downloadTxtFile(content, `${topic?.id}-flashcards.txt`)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const result = parseFlashcardsFromFile(content)

      if (result.errors) {
        setImportErrors(result.errors)
        setIsErrorDialogOpen(true)
      } else if (result.data) {
        form.setValue(
          'flashcards',
          result.data.map((d) => ({ ...d, external_resource_url: '' })),
        )
        toast({
          title: 'Importação Concluída',
          description: `${result.data.length} cards carregados. Salve para confirmar.`,
        })
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      <ImportErrorsDialog
        isOpen={isErrorDialogOpen}
        onClose={() => setIsErrorDialogOpen(false)}
        errors={importErrors}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(`/admin/flashcards/${subjectId}`)}
              className="shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{topic.name}</h1>
              <p className="text-muted-foreground">
                Gerencie os flashcards deste tópico
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => downloadTxtFile(FLASHCARD_TEMPLATE, 'modelo-flashcards.txt')}
              className="shadow-sm"
            >
              <FileText className="mr-2 h-4 w-4" />
              Modelo
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="shadow-sm">
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Button>
            <Button variant="outline" onClick={handleExport} className="shadow-sm">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Cards</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fields.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Matéria</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{topic.subject.name}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <Badge variant="secondary" className="text-xs">Editando</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">Ativo</div>
            </CardContent>
          </Card>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id} className="bg-gradient-to-br from-card to-card/50 dark:from-card dark:to-muted/20 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-white text-sm font-semibold">
                          {index + 1}
                        </div>
                        <h3 className="font-semibold text-lg">Flashcard {index + 1}</h3>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name={`flashcards.${index}.question`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Pergunta</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Digite a pergunta do flashcard..."
                              className="min-h-[100px] resize-none"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`flashcards.${index}.answer`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Resposta</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Digite a resposta do flashcard..."
                              className="min-h-[100px] resize-none"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`flashcards.${index}.external_resource_url`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">URL de Recurso (Opcional)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="https://exemplo.com/recurso"
                              type="url"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>

            {fields.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum flashcard encontrado</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Comece criando seu primeiro flashcard para este tópico
                  </p>
                  <Button
                    type="button"
                    onClick={() =>
                      append({
                        question: '',
                        answer: '',
                        external_resource_url: '',
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Criar Primeiro Flashcard
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  append({
                    question: '',
                    answer: '',
                    external_resource_url: '',
                  })
                }
                className="shadow-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Flashcard
              </Button>
              <Button type="submit" size="lg" className="shadow-sm">
                <Save className="mr-2 h-4 w-4" />
                Salvar Flashcards
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </>
  )
}