import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { logger } from '@/lib/logger'
import { usePageTitle } from '@/hooks/usePageTitle'
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
import { useToast } from '@/components/ui/use-toast'
import { useEffect, useState } from 'react'
import { audioLessonService, AudioLesson, AudioModule } from '@/services/audioLessonService'
import { Loader2, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

const evercastSchema = z.object({
  title: z.string().min(3, 'O título é muito curto.'),
  moduleId: z.string().min(1, 'Selecione uma série (módulo).'),
  duration: z.string().min(1, 'A duração é obrigatória. (ex: 45)'),
  audio_source_url: z
    .string()
    .url('Por favor, insira uma URL válida.')
})

type EvercastFormValues = z.infer<typeof evercastSchema>

export default function AdminEvercastFormPage() {
  const { evercastId } = useParams()
  const navigate = useNavigate()
  usePageTitle('Editor de Evercast')
  const { toast } = useToast()
  const { profile } = useAuth()
  const isTeacher = profile?.role === 'teacher'
  const isEditing = !!evercastId

  // Teacher cannot create/edit Evercast
  useEffect(() => {
    if (isTeacher) {
      toast({ title: 'Acesso negado', description: 'Apenas administradores podem gerenciar Evercast.', variant: 'destructive' })
      navigate('/admin/evercast')
    }
  }, [isTeacher, navigate, toast])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(isEditing)
  const [modules, setModules] = useState<AudioModule[]>([])

  const form = useForm<EvercastFormValues>({
    resolver: zodResolver(evercastSchema),
    defaultValues: {
      title: '',
      moduleId: '',
      duration: '',
      audio_source_url: '',
    },
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        const mods = await audioLessonService.getAudioModules()
        setModules(mods)

        if (isEditing && evercastId) {
          const lesson = await audioLessonService.getAudioLessonById(evercastId)
          if (lesson) {
            form.reset({
              title: lesson.title,
              moduleId: lesson.module_id,
              duration: lesson.duration_minutes?.toString() || '',
              audio_source_url: lesson.audio_url || ''
            })
          } else {
            toast({ title: 'Áudio-aula não encontrada', description: 'O registro solicitado não existe.', variant: 'destructive' })
            navigate('/admin/evercast')
            return
          }
        }
      } catch (error) {
        logger.error(error)
        toast({ title: 'Erro ao carregar dados', variant: 'destructive' })
      } finally {
        setInitialLoading(false)
      }
    }
    loadData()
  }, [isEditing, evercastId, form])

  const onSubmit = async (data: EvercastFormValues) => {
    setLoading(true)
    try {
      const durationSeconds = parseInt(data.duration) * 60

      if (isEditing && evercastId) {
        await audioLessonService.updateAudioLesson(evercastId, {
          title: data.title,
          module_id: data.moduleId,
          duration_minutes: parseInt(data.duration),
          audio_url: data.audio_source_url,
          audio_source_type: 'panda_video_hls'
        })
      } else {
        await audioLessonService.createAudioLesson({
          title: data.title,
          module_id: data.moduleId,
          duration_seconds: durationSeconds,
          audio_source_url: data.audio_source_url,
          audio_source_type: 'panda_video_hls'
        })
      }

      toast({
        title: `Áudio-aula ${isEditing ? 'atualizada' : 'criada'} com sucesso!`,
      })
      navigate('/admin/evercast')
    } catch (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) return <div className="p-8">Carregando...</div>

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/admin/evercast')} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{isEditing ? 'Editar Áudio-aula' : 'Nova Áudio-aula'}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {isEditing ? 'Editar Áudio-aula' : 'Nova Áudio-aula'}
            </CardTitle>
            <CardDescription>
              Preencha os detalhes do Evercast usando uma URL HLS do Panda Video.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="moduleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Série (Módulo)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a série" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {modules.map(mod => (
                          <SelectItem key={mod.id} value={mod.id}>
                            {mod.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duração (minutos)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: 45" type="number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="audio_source_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL do Áudio (HLS/MP3)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://.../playlist.m3u8" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/evercast')}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </form>
    </Form>
  )
}
