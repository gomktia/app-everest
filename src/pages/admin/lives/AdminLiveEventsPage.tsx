import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Plus,
  MoreHorizontal,
  Radio,
  Video,
  Youtube,
  ExternalLink,
  Play,
  Square,
  Upload,
  Trash2,
  Pencil,
  XCircle,
  Copy,
  CheckCircle,
  Settings2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  getLiveEvents,
  createLiveEvent,
  updateLiveEvent,
  deleteLiveEvent,
  startLive,
  endLive,
  cancelLive,
  publishRecording,
  type LiveEvent,
  type LiveEventProvider,
  type LiveEventStatus,
  type PandaLiveCredentials,
} from '@/services/liveEventService'
import { SectionLoader } from '@/components/SectionLoader'
import { PageTabs } from '@/components/PageTabs'
import { List, BarChart3 } from 'lucide-react'

const providerConfig: Record<LiveEventProvider, { label: string; icon: typeof Radio; color: string }> = {
  panda: { label: 'Panda Video', icon: Video, color: 'text-blue-500' },
  youtube: { label: 'YouTube', icon: Youtube, color: 'text-red-500' },
  meet: { label: 'Google Meet', icon: ExternalLink, color: 'text-green-500' },
}

const statusConfig: Record<LiveEventStatus, { label: string; className: string }> = {
  scheduled: { label: 'Agendada', className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  live: { label: 'Ao Vivo', className: 'bg-red-500 text-white' },
  ended: { label: 'Encerrada', className: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelada', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
}

interface FormData {
  title: string
  description: string
  provider: LiveEventProvider
  stream_url: string
  class_id: string
  course_id: string
  scheduled_start: string
  scheduled_end: string
}

const emptyForm: FormData = {
  title: '',
  description: '',
  provider: 'panda',
  stream_url: '',
  class_id: 'global',
  course_id: 'none',
  scheduled_start: '',
  scheduled_end: '',
}

export default function AdminLiveEventsPage() {
  usePageTitle('Eventos ao Vivo')
  const [activeTab, setActiveTab] = useState('events')
  const { user } = useAuth()
  const { toast } = useToast()

  const [lives, setLives] = useState<LiveEvent[]>([])
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)

  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [recordingUrl, setRecordingUrl] = useState('')
  const [recordingProvider, setRecordingProvider] = useState<'panda' | 'youtube'>('panda')

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // OBS credentials dialog (shown after Panda live creation or from table)
  const [obsDialogOpen, setObsDialogOpen] = useState(false)
  const [obsCredentials, setObsCredentials] = useState<{ rtmp: string; key: string; title: string } | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterClass, setFilterClass] = useState<string>('all')
  const [filterProvider, setFilterProvider] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [livesData, classesData, coursesData] = await Promise.all([
      getLiveEvents(),
      supabase.from('classes').select('id, name').order('name'),
      supabase.from('video_courses').select('id, name').order('name'),
    ])
    setLives(livesData)
    setClasses(classesData.data || [])
    setCourses(coursesData.data || [])
    setLoading(false)
  }

  const filteredLives = lives.filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false
    if (filterClass !== 'all' && l.class_id !== filterClass) return false
    if (filterProvider !== 'all' && l.provider !== filterProvider) return false
    return true
  })

  const openCreateDialog = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEditDialog = (live: LiveEvent) => {
    setEditingId(live.id)
    setForm({
      title: live.title,
      description: live.description || '',
      provider: live.provider,
      stream_url: live.stream_url,
      class_id: live.class_id || 'global',
      course_id: live.course_id || 'none',
      scheduled_start: new Date(live.scheduled_start).toISOString().slice(0, 16),
      scheduled_end: new Date(live.scheduled_end).toISOString().slice(0, 16),
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.title || !form.scheduled_start || !form.scheduled_end) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' })
      return
    }
    if (form.provider !== 'panda' && !form.stream_url) {
      toast({ title: 'Informe a URL da stream', variant: 'destructive' })
      return
    }
    if (new Date(form.scheduled_end) <= new Date(form.scheduled_start)) {
      toast({ title: 'O horário de término deve ser após o início', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const classId = form.class_id !== 'global' ? form.class_id : null
      const courseId = form.course_id !== 'none' ? form.course_id : null

      if (editingId) {
        await updateLiveEvent(editingId, {
          title: form.title,
          description: form.description || null,
          provider: form.provider,
          stream_url: form.stream_url || undefined,
          class_id: classId,
          course_id: courseId,
          scheduled_start: new Date(form.scheduled_start).toISOString(),
          scheduled_end: new Date(form.scheduled_end).toISOString(),
        } as Partial<LiveEvent>)
        toast({ title: 'Live atualizada!' })
      } else {
        const result = await createLiveEvent({
          title: form.title,
          description: form.description || undefined,
          provider: form.provider,
          stream_url: form.stream_url || undefined,
          class_id: classId,
          course_id: courseId,
          teacher_id: user!.id,
          scheduled_start: new Date(form.scheduled_start).toISOString(),
          scheduled_end: new Date(form.scheduled_end).toISOString(),
        })

        // Show OBS credentials if Panda live was created
        if (result.pandaCredentials) {
          setObsCredentials({
            rtmp: result.pandaCredentials.rtmp,
            key: result.pandaCredentials.stream_key,
            title: form.title,
          })
          setObsDialogOpen(true)
        }

        toast({ title: 'Live criada!' })
      }
      setDialogOpen(false)
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleStartLive = async (id: string) => {
    try {
      await startLive(id)
      toast({ title: 'Live iniciada!', description: 'Os alunos foram notificados.' })
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao iniciar live', description: err?.message, variant: 'destructive' })
    }
  }

  const handleEndLive = async (id: string) => {
    try {
      await endLive(id)
      toast({ title: 'Live encerrada!', description: 'Gravação em processamento no Panda.' })
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao encerrar live', description: err?.message, variant: 'destructive' })
    }
  }

  const handleCancelLive = async (id: string) => {
    try {
      await cancelLive(id)
      toast({ title: 'Live cancelada!' })
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao cancelar live', description: err?.message, variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteLiveEvent(deletingId)
      toast({ title: 'Live excluída!' })
      setDeleteDialogOpen(false)
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir live', description: err?.message, variant: 'destructive' })
    }
  }

  const handlePublish = async () => {
    if (!publishingId || !recordingUrl) return
    setSaving(true)
    try {
      await publishRecording(publishingId, recordingUrl, recordingProvider)
      toast({ title: 'Gravação publicada!', description: 'A aula foi adicionada ao módulo Lives do curso.' })
      setPublishDialogOpen(false)
      setRecordingUrl('')
      await loadData()
    } catch (e: any) {
      toast({ title: 'Erro ao publicar', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SectionLoader />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Aulas ao Vivo</h1>
          <p className="text-sm text-muted-foreground">Gerencie as transmissões ao vivo</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Live
        </Button>
      </div>

      <PageTabs
        value={activeTab}
        onChange={setActiveTab}
        layout="full"
        tabs={[
          {
            value: 'events',
            label: 'Eventos',
            icon: <List className="h-4 w-4" />,
            count: filteredLives.length,
            content: (
              <div className="space-y-6 mt-4">
                {/* Filters */}
                <div className="flex gap-3">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="scheduled">Agendada</SelectItem>
                      <SelectItem value="live">Ao Vivo</SelectItem>
                      <SelectItem value="ended">Encerrada</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterClass} onValueChange={setFilterClass}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Turma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as turmas</SelectItem>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterProvider} onValueChange={setFilterProvider}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Provedor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="panda">Panda Video</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="meet">Google Meet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Table */}
                <Card className="border-border shadow-sm overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Provedor</TableHead>
                        <TableHead>Turma</TableHead>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLives.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Nenhuma live encontrada.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLives.map(live => {
                          const provider = providerConfig[live.provider]
                          const status = statusConfig[live.status]
                          const ProviderIcon = provider.icon

                          return (
                            <TableRow key={live.id}>
                              <TableCell className="font-medium">{live.title}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <ProviderIcon className={cn('h-4 w-4', provider.color)} />
                                  <span className="text-sm">{provider.label}</span>
                                </div>
                              </TableCell>
                              <TableCell>{live.classes?.name || 'Global'}</TableCell>
                              <TableCell className="text-sm">
                                {format(new Date(live.scheduled_start), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={status.className}>{status.label}</Badge>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {live.status === 'scheduled' && (
                                      <>
                                        <DropdownMenuItem onClick={() => openEditDialog(live)}>
                                          <Pencil className="h-4 w-4 mr-2" /> Editar
                                        </DropdownMenuItem>
                                        {live.panda_rtmp && live.panda_stream_key && (
                                          <DropdownMenuItem onClick={() => {
                                            setObsCredentials({ rtmp: live.panda_rtmp!, key: live.panda_stream_key!, title: live.title })
                                            setObsDialogOpen(true)
                                          }}>
                                            <Settings2 className="h-4 w-4 mr-2" /> Config OBS
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem onClick={() => handleStartLive(live.id)}>
                                          <Play className="h-4 w-4 mr-2" /> Iniciar Live
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleCancelLive(live.id)}>
                                          <XCircle className="h-4 w-4 mr-2" /> Cancelar
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    {live.status === 'live' && (
                                      <DropdownMenuItem onClick={() => handleEndLive(live.id)}>
                                        <Square className="h-4 w-4 mr-2" /> Encerrar Live
                                      </DropdownMenuItem>
                                    )}
                                    {live.status === 'ended' && !live.recording_published && live.course_id && (
                                      <DropdownMenuItem onClick={() => {
                                        setPublishingId(live.id)
                                        setPublishDialogOpen(true)
                                      }}>
                                        <Upload className="h-4 w-4 mr-2" /> Publicar Gravação
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => {
                                        setDeletingId(live.id)
                                        setDeleteDialogOpen(true)
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            ),
          },
          {
            value: 'stats',
            label: 'Estatísticas',
            icon: <BarChart3 className="h-4 w-4" />,
            content: (
              <div className="mt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {(['scheduled', 'live', 'ended', 'cancelled'] as LiveEventStatus[]).map(status => {
                    const config = statusConfig[status]
                    const count = lives.filter(l => l.status === status).length
                    return (
                      <Card key={status} className="border-border shadow-sm">
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-foreground">{count}</div>
                          <Badge variant="outline" className={cn('mt-1', config.className)}>{config.label}</Badge>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Live' : 'Nova Live'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Provedor *</Label>
                <Select value={form.provider} onValueChange={(v: LiveEventProvider) => setForm(f => ({ ...f, provider: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="panda">Panda Video</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="meet">Google Meet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Turma</Label>
                <Select value={form.class_id} onValueChange={v => setForm(f => ({ ...f, class_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Global" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (todos)</SelectItem>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.provider === 'panda' && !editingId ? (
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <Settings2 className="h-4 w-4 shrink-0" />
                  A URL do player e credenciais OBS serão geradas automaticamente pelo Panda Video.
                </p>
              </div>
            ) : form.provider !== 'panda' ? (
              <div>
                <Label>URL da Stream *</Label>
                <Input
                  value={form.stream_url}
                  onChange={e => setForm(f => ({ ...f, stream_url: e.target.value }))}
                  placeholder={form.provider === 'meet' ? 'https://meet.google.com/...' : 'https://...'}
                />
              </div>
            ) : null}
            <div>
              <Label>Curso (para gravação)</Label>
              <Select value={form.course_id} onValueChange={v => setForm(f => ({ ...f, course_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{(c as any).name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Início *</Label>
                <Input type="datetime-local" value={form.scheduled_start} onChange={e => setForm(f => ({ ...f, scheduled_start: e.target.value }))} />
              </div>
              <div>
                <Label>Término *</Label>
                <Input type="datetime-local" value={form.scheduled_end} onChange={e => setForm(f => ({ ...f, scheduled_end: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Recording Dialog */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar Gravação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cole a URL da gravação. Ela será adicionada como aula no módulo "Lives" do curso vinculado.
            </p>
            <div>
              <Label>Provedor da Gravação</Label>
              <Select value={recordingProvider} onValueChange={(v: 'panda' | 'youtube') => setRecordingProvider(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="panda">Panda Video</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>URL da Gravação *</Label>
              <Input value={recordingUrl} onChange={e => setRecordingUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handlePublish} disabled={saving || !recordingUrl}>
              {saving ? 'Publicando...' : 'Publicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OBS Credentials Dialog */}
      <Dialog open={obsDialogOpen} onOpenChange={setObsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Configuração OBS / Streaming
            </DialogTitle>
          </DialogHeader>
          {obsCredentials && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure seu software de streaming (OBS, StreamYard, etc.) com os dados abaixo para a live <strong>"{obsCredentials.title}"</strong>.
              </p>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Servidor RTMP</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={obsCredentials.rtmp} readOnly className="font-mono text-xs bg-muted/30" />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(obsCredentials.rtmp)
                        setCopiedField('rtmp')
                        setTimeout(() => setCopiedField(null), 2000)
                      }}
                    >
                      {copiedField === 'rtmp' ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Chave da Stream</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={obsCredentials.key} readOnly className="font-mono text-xs bg-muted/30" />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(obsCredentials.key)
                        setCopiedField('key')
                        setTimeout(() => setCopiedField(null), 2000)
                      }}
                    >
                      {copiedField === 'key' ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400 space-y-1">
                <p className="font-semibold">Como configurar no OBS Studio:</p>
                <ol className="list-decimal ml-4 space-y-0.5">
                  <li>Abra Configurações → Transmissão</li>
                  <li>Serviço: <strong>Personalizado</strong></li>
                  <li>Cole o <strong>Servidor RTMP</strong> acima</li>
                  <li>Cole a <strong>Chave da Stream</strong> acima</li>
                  <li>Clique "Iniciar Transmissão" quando estiver pronto</li>
                </ol>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setObsDialogOpen(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Live?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O evento do calendário vinculado também será excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
