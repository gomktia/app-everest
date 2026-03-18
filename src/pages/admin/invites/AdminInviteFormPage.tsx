import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { logger } from '@/lib/logger'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { SectionLoader } from '@/components/SectionLoader'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-provider'
import {
  generateSlug,
  createInvite,
  updateInvite,
  type Invite,
} from '@/services/inviteService'

interface CourseOption {
  id: string
  name: string
}

interface ClassOption {
  id: string
  name: string
}

export default function AdminInviteFormPage() {
  const { inviteId } = useParams()
  const isEditing = !!inviteId
  usePageTitle('Editor de Convite')
  const navigate = useNavigate()
  const { toast } = useToast()
  const { profile } = useAuth()

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [courseId, setCourseId] = useState<string>('')
  const [classId, setClassId] = useState<string>('')
  const [accessDurationDays, setAccessDurationDays] = useState<string>('')
  const [maxSlots, setMaxSlots] = useState<string>('')
  const [motivationalMessage, setMotivationalMessage] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [status, setStatus] = useState<'active' | 'archived'>('active')

  const [courses, setCourses] = useState<CourseOption[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])

  // Load courses
  useEffect(() => {
    const loadCourses = async () => {
      const { data } = await supabase
        .from('video_courses')
        .select('id, name')
        .order('name')
      setCourses(data || [])
    }
    loadCourses()
  }, [])

  // Load classes filtered by selected course
  useEffect(() => {
    const loadClasses = async () => {
      if (!courseId) {
        setClasses([])
        return
      }
      const { data: classCourses } = await supabase
        .from('class_courses')
        .select('class_id')
        .eq('course_id', courseId)

      if (!classCourses || classCourses.length === 0) {
        setClasses([])
        return
      }

      const classIds = classCourses.map((cc) => cc.class_id)
      const { data } = await supabase
        .from('classes')
        .select('id, name')
        .in('id', classIds)
        .order('name')
      setClasses(data || [])
    }
    loadClasses()
  }, [courseId])

  // Load existing invite for editing
  useEffect(() => {
    if (!isEditing || !inviteId) return

    const loadInvite = async () => {
      try {
        const { data, error } = await supabase
          .from('invites')
          .select('*')
          .eq('id', inviteId)
          .single()

        if (error) throw error

        setTitle(data.title || '')
        setSlug(data.slug || '')
        setDescription(data.description || '')
        setCourseId(data.course_id || '')
        setClassId(data.class_id || '')
        setAccessDurationDays(data.access_duration_days?.toString() || '')
        setMaxSlots(data.max_slots?.toString() || '')
        setCoverImageUrl(data.cover_image_url || '')
        setMotivationalMessage(data.motivational_message || '')
        setStatus(data.status || 'active')
        setSlugManuallyEdited(true) // Don't auto-update slug when editing
      } catch (error) {
        logger.error('Erro ao carregar convite:', error)
        toast({
          title: 'Erro',
          description: 'Nao foi possivel carregar o convite.',
          variant: 'destructive',
        })
        navigate('/admin/invites')
      } finally {
        setLoading(false)
      }
    }
    loadInvite()
  }, [inviteId, isEditing])

  const handleTitleChange = (value: string) => {
    setTitle(value)
    if (!slugManuallyEdited) {
      setSlug(generateSlug(value))
    }
  }

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true)
    setSlug(value)
  }

  const handleCoverImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `invite-covers/${Date.now()}.${ext}`

      const { error } = await supabase.storage
        .from('uploads')
        .upload(path, file, { upsert: true })

      if (error) {
        toast({
          title: 'Erro no upload',
          description: 'Nao foi possivel enviar a imagem.',
          variant: 'destructive',
        })
        return
      }

      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path)
      setCoverImageUrl(urlData.publicUrl)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim() || !slug.trim()) {
      toast({
        title: 'Campos obrigatorios',
        description: 'Titulo e slug sao obrigatorios.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const inviteData: Omit<Invite, 'id'> = {
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        course_id: courseId || null,
        class_id: classId || null,
        access_duration_days: accessDurationDays ? parseInt(accessDurationDays, 10) : null,
        max_slots: maxSlots ? parseInt(maxSlots, 10) : null,
        cover_image_url: coverImageUrl || null,
        motivational_message: motivationalMessage.trim() || null,
        status,
        created_by_user_id: profile?.id,
      }

      if (isEditing && inviteId) {
        await updateInvite(inviteId, inviteData)
        toast({ title: 'Convite atualizado', description: 'As alteracoes foram salvas.' })
      } else {
        await createInvite(inviteData)
        toast({ title: 'Convite criado', description: 'O convite foi criado com sucesso.' })
      }
      navigate('/admin/invites')
    } catch (error) {
      logger.error('Erro ao salvar convite:', error)
      toast({
        title: 'Erro ao salvar',
        description: 'Nao foi possivel salvar o convite. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <SectionLoader />
  }

  const previewUrl = `${window.location.origin}/invite/${slug || '...'}`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/invites')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isEditing ? 'Editar Convite' : 'Novo Convite'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditing ? 'Atualize as informacoes do convite' : 'Configure um novo link de convite'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informacoes Basicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titulo *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Ex: Turma EAOF 2026"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="turma-eaof-2026"
              />
              <p className="text-xs text-muted-foreground">{previewUrl}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Texto de chamada</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição do convite que aparece na página de inscrição..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivational">Mensagem motivacional</Label>
              <Textarea
                id="motivational"
                value={motivationalMessage}
                onChange={(e) => setMotivationalMessage(e.target.value)}
                placeholder="Ex: Sua família torce por você! Cada hora de estudo é um passo mais perto da aprovação."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Aparece em destaque na página do convite. Se vazio, usa uma mensagem padrão.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Course & Class */}
        <Card>
          <CardHeader>
            <CardTitle>Vinculacao</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Curso vinculado</Label>
              <Select value={courseId} onValueChange={(v) => { setCourseId(v); setClassId('') }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um curso" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Turma vinculada</Label>
              <Select value={classId} onValueChange={setClassId} disabled={!courseId}>
                <SelectTrigger>
                  <SelectValue placeholder={courseId ? 'Selecione uma turma' : 'Selecione um curso primeiro'} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Limits */}
        <Card>
          <CardHeader>
            <CardTitle>Limites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accessDays">Prazo de acesso</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="accessDays"
                  type="number"
                  min={1}
                  value={accessDurationDays}
                  onChange={(e) => setAccessDurationDays(e.target.value)}
                  placeholder="Ilimitado"
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">dias</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxSlots">Limite de vagas</Label>
              <Input
                id="maxSlots"
                type="number"
                min={1}
                value={maxSlots}
                onChange={(e) => setMaxSlots(e.target.value)}
                placeholder="Ilimitado"
                className="w-32"
              />
            </div>
          </CardContent>
        </Card>

        {/* Cover Image & Status */}
        <Card>
          <CardHeader>
            <CardTitle>Aparencia e Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coverImage">Imagem de capa</Label>
              <Input
                id="coverImage"
                type="file"
                accept="image/*"
                onChange={handleCoverImageChange}
                disabled={isUploading}
              />
              {isUploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando imagem...
                </div>
              )}
              {coverImageUrl && (
                <img
                  src={coverImageUrl}
                  alt="Capa do convite"
                  className="mt-2 w-full max-w-sm rounded-lg border object-cover"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'archived')}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Button onClick={handleSave} disabled={saving || isUploading} className="px-8">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Salvar Alteracoes' : 'Criar Convite'}
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/invites')}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
