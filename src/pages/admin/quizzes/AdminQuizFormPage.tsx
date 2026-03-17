import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { logger } from '@/lib/logger'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  getTopics,
  createQuiz,
  updateQuiz,
  getQuizById,
  type AdminTopic,
} from '@/services/adminQuizService'
import { SectionLoader } from '@/components/SectionLoader'
import { ArrowLeft } from 'lucide-react'

const quizSchema = z.object({
  title: z.string().min(3, 'O título é muito curto.'),
  description: z.string().optional(),
  duration_minutes: z.coerce.number().positive().optional(),
  topic_id: z.string().uuid('Selecione um tópico válido.'),
})

type QuizFormValues = z.infer<typeof quizSchema>

export default function AdminQuizFormPage() {
  const { quizId } = useParams()
  const navigate = useNavigate()
  usePageTitle('Editor de Quiz')
  const isEditing = !!quizId
  const { toast } = useToast()
  const [topics, setTopics] = useState<AdminTopic[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<QuizFormValues>({
    resolver: zodResolver(quizSchema),
    defaultValues: {
      title: '',
      description: '',
      topic_id: '',
    },
  })

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true)
        const topicsData = await getTopics()
        setTopics(topicsData)

        if (isEditing && quizId) {
          const quiz = await getQuizById(quizId)
          if (quiz) {
            form.reset({
              title: quiz.title,
              description: quiz.description || '',
              duration_minutes: quiz.duration_minutes || undefined,
              topic_id: quiz.topic_id,
            })
          }
        }
      } catch (error) {
        logger.error('Error loading data:', error)
        toast({
          title: 'Erro ao carregar dados',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialData()
  }, [quizId, isEditing, form, toast])

  const onSubmit = async (data: QuizFormValues) => {
    try {
      setIsLoading(true)
      if (isEditing && quizId) {
        await updateQuiz(quizId, {
          title: data.title,
          description: data.description,
          duration_minutes: data.duration_minutes,
          topic_id: data.topic_id,
        })
        toast({
          title: 'Quiz atualizado com sucesso!',
        })
      } else {
        await createQuiz({
          title: data.title,
          description: data.description,
          duration_minutes: data.duration_minutes,
          topic_id: data.topic_id,
        })
        toast({
          title: 'Quiz criado com sucesso!',
        })
      }
      navigate('/admin/quizzes')
    } catch (error) {
      logger.error('Error saving quiz:', error)
      toast({
        title: 'Erro ao salvar quiz',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <SectionLoader />
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/admin/quizzes')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{isEditing ? 'Editar Quiz' : 'Novo Quiz'}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? 'Editar Quiz' : 'Novo Quiz'}</CardTitle>
            <CardDescription>
              Preencha os detalhes do quiz. As questões são gerenciadas
              separadamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título do Quiz</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duração (minutos)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="topic_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tópico Associado</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um tópico" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {topics.map((topic) => (
                          <SelectItem key={topic.id} value={topic.id}>
                            {topic.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/quizzes')}
          >
            Cancelar
          </Button>
          <Button type="submit">Salvar Quiz</Button>
        </div>
      </form>
    </Form>
  )
}
