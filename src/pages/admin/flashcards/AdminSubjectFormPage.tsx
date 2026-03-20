import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { usePageTitle } from '@/hooks/usePageTitle'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { SectionLoader } from '@/components/SectionLoader'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, BookOpen, Save, Image as ImageIcon } from 'lucide-react'
import { logger } from '@/lib/logger'

const subjectSchema = z.object({
  name: z.string().min(1, 'O nome da matéria é obrigatório'),
  description: z.string().optional(),
  image_url: z.string().url('URL inválida').optional().or(z.literal('')),
  category: z.string().optional(),
})

type SubjectFormValues = z.infer<typeof subjectSchema>

export default function AdminSubjectFormPage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const navigate = useNavigate()
  usePageTitle('Matéria')
  const { toast } = useToast()
  const [loading, setLoading] = useState(!!subjectId)

  const isEditing = !!subjectId

  const form = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      name: '',
      description: '',
      image_url: '',
      category: '',
    },
  })

  useEffect(() => {
    if (isEditing) {
      loadSubject()
    }
  }, [subjectId])

  const loadSubject = async () => {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('id', subjectId)
        .single()

      if (error) throw error

      if (data) {
        form.reset({
          name: data.name,
          description: data.description || '',
          image_url: data.image_url || '',
          category: data.category || '',
        })
      }
    } catch (error) {
      logger.error('Erro ao carregar matéria:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados da matéria',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (values: SubjectFormValues) => {
    try {
      if (isEditing) {
        const { error } = await supabase
          .from('subjects')
          .update({
            name: values.name,
            description: values.description,
            image_url: values.image_url || null,
            category: values.category || null,
          })
          .eq('id', subjectId)

        if (error) throw error

        toast({
          title: 'Sucesso',
          description: 'Matéria atualizada com sucesso',
        })
      } else {
        const { error } = await supabase
          .from('subjects')
          .insert({
            name: values.name,
            description: values.description,
            image_url: values.image_url || null,
            category: values.category || null,
          })

        if (error) throw error

        toast({
          title: 'Sucesso',
          description: 'Matéria criada com sucesso',
        })
      }

      navigate('/admin/flashcards')
    } catch (error) {
      logger.error('Erro ao salvar matéria:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a matéria',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return <SectionLoader />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isEditing ? 'Editar Matéria' : 'Nova Matéria'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEditing ? 'Edite as informações da matéria' : 'Crie uma nova matéria de flashcards'}
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/admin/flashcards')}
                aria-label="Voltar"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-muted/50">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {isEditing ? 'Editar Matéria' : 'Nova Matéria'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Preencha as informações da matéria
                  </p>
                </div>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Matéria *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Matemática" {...field} />
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
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descrição da matéria (opcional)"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Breve descrição sobre o conteúdo da matéria
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Exatas, Humanas, etc." {...field} />
                        </FormControl>
                        <FormDescription>
                          Categoria ou área de conhecimento
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="image_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL da Imagem</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              placeholder="https://exemplo.com/imagem.jpg"
                              {...field}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                          >
                            <ImageIcon className="h-4 w-4" />
                          </Button>
                        </div>
                        <FormDescription>
                          URL de uma imagem representativa da matéria (opcional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/admin/flashcards')}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isEditing ? 'Salvar Alterações' : 'Criar Matéria'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
