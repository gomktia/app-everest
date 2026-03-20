import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useState, useEffect, useRef } from 'react'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
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
  FormDescription,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
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
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabase/client'
import { ChevronLeft, Upload, List, LayoutGrid, Image as ImageIcon, Trash2, Copy } from 'lucide-react'

const courseSchema = z.object({
  name: z.string().min(3, 'O titulo deve ter pelo menos 3 caracteres.'),
  description: z.string().min(10, 'A descricao deve ter pelo menos 10 caracteres.'),
  thumbnail_url: z.string().optional().or(z.literal('')),
  acronym: z.string().max(10).optional().or(z.literal('')),
  sales_url: z.string().url('URL invalida').optional().or(z.literal('')),
  category: z.string().default('Meus Cursos'),
  layout_preference: z.enum(['simple_list', 'module_covers']).default('simple_list'),
  show_in_storefront: z.boolean().default(false),
  moderate_comments: z.boolean().default(false),
  onboarding_text: z.string().optional().or(z.literal('')),
  status: z.enum(['published', 'draft', 'coming_soon']).default('draft'),
})

type CourseFormValues = z.infer<typeof courseSchema>

export default function AdminCourseFormPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const isEditing = !!courseId
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      name: '',
      description: '',
      thumbnail_url: '',
      acronym: '',
      sales_url: '',
      category: 'Meus Cursos',
      layout_preference: 'simple_list',
      show_in_storefront: false,
      moderate_comments: false,
      onboarding_text: '',
      status: 'draft',
    },
  })

  useEffect(() => {
    const fetchCourseData = async () => {
      if (isEditing && courseId) {
        try {
          const { data: course, error } = await supabase
            .from('video_courses')
            .select('*')
            .eq('id', courseId)
            .single()

          if (error) {
            logger.error('Error fetching course:', error)
            toast({
              title: 'Erro ao carregar curso',
              description: 'Nao foi possivel carregar os dados do curso.',
              variant: 'destructive',
            })
            return
          }

          if (course) {
            form.reset({
              name: course.name || '',
              description: course.description || '',
              thumbnail_url: course.thumbnail_url || '',
              acronym: course.acronym || '',
              sales_url: course.sales_url || '',
              category: course.category || 'Meus Cursos',
              layout_preference: course.layout_preference || 'simple_list',
              show_in_storefront: course.show_in_storefront || false,
              moderate_comments: course.moderate_comments || false,
              onboarding_text: course.onboarding_text || '',
              status: course.status || 'draft',
            })
            if (course.thumbnail_url) {
              setCoverPreview(course.thumbnail_url)
            }
          }
        } catch (error) {
          logger.error('Unexpected error fetching course:', error)
          toast({
            title: 'Erro inesperado',
            description: 'Ocorreu um erro ao carregar o curso.',
            variant: 'destructive',
          })
        }
      }
    }

    fetchCourseData()
  }, [isEditing, courseId, form, toast])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCoverFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setCoverPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const onSubmit = async (data: CourseFormValues) => {
    try {
      setIsSaving(true)

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        toast({
          title: 'Erro de autenticacao',
          description: 'Voce precisa estar logado para salvar um curso.',
          variant: 'destructive',
        })
        return
      }

      let thumbnailUrl = data.thumbnail_url
      if (coverFile) {
        const { uploadCoverImage } = await import('@/services/adminCourseService')
        thumbnailUrl = await uploadCoverImage(coverFile, courseId || 'new-' + Date.now())
      }

      const courseData = {
        name: data.name,
        description: data.description,
        thumbnail_url: thumbnailUrl || null,
        acronym: data.acronym || null,
        sales_url: data.sales_url || null,
        category: data.category,
        layout_preference: data.layout_preference,
        show_in_storefront: data.show_in_storefront,
        moderate_comments: data.moderate_comments,
        onboarding_text: data.onboarding_text || null,
        status: data.status,
        is_active: data.status === 'published',
        updated_at: new Date().toISOString(),
      }

      if (isEditing && courseId) {
        const { error } = await supabase
          .from('video_courses')
          .update(courseData)
          .eq('id', courseId)

        if (error) throw error

        toast({
          title: 'Curso atualizado!',
          description: 'O curso foi atualizado com sucesso.',
        })
      } else {
        const { error } = await supabase
          .from('video_courses')
          .insert({
            ...courseData,
            created_by_user_id: user.id,
          })

        if (error) throw error

        toast({
          title: 'Curso criado!',
          description: 'O curso foi criado com sucesso.',
        })
      }

      navigate('/admin/courses')
    } catch (error) {
      logger.error('Error saving course:', error)
      toast({
        title: 'Erro ao salvar',
        description: 'Nao foi possivel salvar o curso. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!courseId) return
    try {
      const { deleteCourse } = await import('@/services/adminCourseService')
      await deleteCourse(courseId)
      toast({
        title: 'Curso excluido!',
        description: 'O curso foi removido permanentemente.',
      })
      navigate('/admin/courses')
    } catch (error) {
      logger.error('Error deleting course:', error)
      toast({
        title: 'Erro ao excluir',
        description: 'Nao foi possivel excluir o curso.',
        variant: 'destructive',
      })
    }
  }

  const handleDuplicate = async () => {
    if (!courseId) return
    try {
      const { duplicateCourse } = await import('@/services/adminCourseService')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')
      const newCourse = await duplicateCourse(courseId, user.id)
      toast({
        title: 'Curso duplicado!',
        description: 'Uma copia do curso foi criada.',
      })
      navigate(`/admin/courses/${newCourse.id}/edit`)
    } catch (error) {
      logger.error('Error duplicating course:', error)
      toast({
        title: 'Erro ao duplicar',
        description: 'Nao foi possivel duplicar o curso.',
        variant: 'destructive',
      })
    }
  }

  const statusLabel: Record<string, string> = {
    published: 'Publicado',
    draft: 'Rascunho',
    coming_soon: 'Em Breve',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/admin/courses')}
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isEditing ? 'Editar Curso' : 'Novo Curso'}
            </h1>
            <p className="text-muted-foreground mt-1">
              Preencha os detalhes principais do curso
            </p>
          </div>
        </div>
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="published">Publicado</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="coming_soon">Em Breve</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="max-w-4xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Card 1 - Detalhes do Curso */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhes do Curso</CardTitle>
                <CardDescription>
                  Informacoes basicas sobre o curso
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-[1fr_120px] gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Curso</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Preparatorio EAOF 2026" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="acronym"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sigla</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="EAOF" maxLength={10} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="sales_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL de Vendas</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://everestpreparatorios.com.br/curso/..." />
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
                      <FormLabel>Descricao</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={6} placeholder="Descreva o conteudo e objetivos do curso..." />
                      </FormControl>
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
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Meus Cursos">Meus Cursos</SelectItem>
                          <SelectItem value="Preparatorios">Preparatorios</SelectItem>
                          <SelectItem value="Bonus">Bonus</SelectItem>
                          <SelectItem value="Extras">Extras</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Card 2 - Preferencia de Layout */}
            <Card>
              <CardHeader>
                <CardTitle>Preferencia de Layout</CardTitle>
                <CardDescription>
                  Como os modulos do curso serao exibidos para os alunos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="layout_preference"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="grid grid-cols-2 gap-4"
                        >
                          <Label
                            htmlFor="layout-simple"
                            className={cn(
                              'flex flex-col items-center gap-3 rounded-lg border-2 p-6 cursor-pointer transition-colors hover:bg-accent',
                              field.value === 'simple_list'
                                ? 'border-primary bg-primary/5'
                                : 'border-muted'
                            )}
                          >
                            <RadioGroupItem value="simple_list" id="layout-simple" className="sr-only" />
                            <List className="h-8 w-8 text-muted-foreground" />
                            <div className="text-center">
                              <p className="font-medium">Listas simples</p>
                              <p className="text-sm text-muted-foreground">
                                Modulos em lista com aulas expandiveis
                              </p>
                            </div>
                          </Label>
                          <Label
                            htmlFor="layout-covers"
                            className={cn(
                              'flex flex-col items-center gap-3 rounded-lg border-2 p-6 cursor-pointer transition-colors hover:bg-accent',
                              field.value === 'module_covers'
                                ? 'border-primary bg-primary/5'
                                : 'border-muted'
                            )}
                          >
                            <RadioGroupItem value="module_covers" id="layout-covers" className="sr-only" />
                            <LayoutGrid className="h-8 w-8 text-muted-foreground" />
                            <div className="text-center">
                              <p className="font-medium">Capas em modulos</p>
                              <p className="text-sm text-muted-foreground">
                                Grid visual com imagem de capa por modulo
                              </p>
                            </div>
                          </Label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Card 3 - Imagem de Capa */}
            <Card>
              <CardHeader>
                <CardTitle>Imagem de Capa</CardTitle>
                <CardDescription>
                  Imagem exibida na listagem de cursos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {coverPreview && (
                  <div className="relative">
                    <img
                      src={coverPreview}
                      alt="Capa do curso"
                      className="max-h-48 rounded-lg object-cover"
                    />
                  </div>
                )}
                <div
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors hover:border-primary hover:bg-accent/50',
                    'text-muted-foreground'
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8" />
                  <p className="text-sm font-medium">
                    Clique para enviar uma imagem
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Recomendado: 430x215px
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Card 4 - Configuracoes */}
            <Card>
              <CardHeader>
                <CardTitle>Configuracoes</CardTitle>
                <CardDescription>
                  Opcoes de visibilidade e moderacao
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="show_in_storefront"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Mostrar curso na vitrine de todos os alunos
                        </FormLabel>
                        <FormDescription>
                          Incentive a compra para alunos ainda nao matriculados
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="moderate_comments"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Ativar moderacao de comentarios
                        </FormLabel>
                        <FormDescription>
                          Revise manualmente todos os comentarios antes da publicacao
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Card 5 - Onboarding */}
            <Card>
              <CardHeader>
                <CardTitle>Onboarding</CardTitle>
                <CardDescription>
                  Texto de agradecimento pos-matricula ou termos de uso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="onboarding_text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Texto de Onboarding</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={8}
                          placeholder="Seja bem-vindo ao curso! Aqui voce encontrara..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {isEditing && (
                  <>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" className="gap-2">
                          <Trash2 className="h-4 w-4" />
                          Excluir curso
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir curso?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acao e irreversivel. Todos os modulos e aulas associados
                            tambem serao removidos permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Sim, excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={handleDuplicate}
                    >
                      <Copy className="h-4 w-4" />
                      Duplicar curso
                    </Button>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/admin/courses')}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
