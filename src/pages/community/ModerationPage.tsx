import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Trash2,
  Plus,
  Pencil,
  Archive,
  X,
  Loader2,
  ShieldAlert,
  Hash,
  AlertTriangle,
  VolumeX,
  ArrowLeft,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageTabs } from '@/components/PageTabs'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog'
import { MuteUserDialog } from '@/components/community/MuteUserDialog'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { communityService, type CommunitySpace, type CommunityReport } from '@/services/communityService'
import DOMPurify from 'dompurify'
import { logger } from '@/lib/logger'

// ── Constants ──────────────────────────────────────────────────────────────

const ICON_OPTIONS = [
  { value: 'MessageSquare', label: 'Mensagem' },
  { value: 'HelpCircle', label: 'Ajuda' },
  { value: 'BookOpen', label: 'Livro' },
  { value: 'Coffee', label: 'Cafe' },
]

const COLOR_OPTIONS = [
  { value: '#3b82f6', label: 'Azul' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#f59e0b', label: 'Amarelo' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#06b6d4', label: 'Ciano' },
  { value: '#f97316', label: 'Laranja' },
]

const TYPE_OPTIONS = [
  { value: 'general', label: 'Geral' },
  { value: 'questions', label: 'Perguntas' },
  { value: 'resources', label: 'Recursos' },
  { value: 'off-topic', label: 'Off-topic' },
]

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Assedio',
  inappropriate: 'Inapropriado',
  misinformation: 'Desinformacao',
  other: 'Outro',
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// ── Reports Tab ────────────────────────────────────────────────────────────

function ReportsTab() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [reports, setReports] = useState<CommunityReport[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [muteDialog, setMuteDialog] = useState<{ open: boolean; userId: string; userName: string }>({
    open: false,
    userId: '',
    userName: '',
  })

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const status = statusFilter === 'all' ? undefined : statusFilter
      const data = await communityService.getReports(status)
      setReports(data)
    } catch (error) {
      logger.error('Failed to load reports', error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const pendingCount = reports.filter((r) => r.status === 'pending').length

  const handleDismiss = async (report: CommunityReport) => {
    if (!user?.id) return
    setActionLoading(report.id)
    try {
      await communityService.updateReport(report.id, 'dismissed', user.id)
      toast({ title: 'Denuncia dispensada' })
      fetchReports()
    } catch (error) {
      logger.error('Failed to dismiss report', error)
      toast({ title: 'Erro ao dispensar denuncia', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemoveContent = async (report: CommunityReport) => {
    if (!user?.id) return
    setActionLoading(report.id)
    try {
      if (report.target_type === 'post') {
        await communityService.deletePost(report.target_id)
      } else if (report.target_type === 'comment') {
        await communityService.deleteComment(report.target_id)
      }
      await communityService.updateReport(report.id, 'resolved', user.id)
      toast({ title: 'Conteudo removido e denuncia resolvida' })
      fetchReports()
    } catch (error) {
      logger.error('Failed to remove content', error)
      toast({ title: 'Erro ao remover conteudo', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            Pendentes
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved">Revisados</TabsTrigger>
          <TabsTrigger value="dismissed">Dispensados</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center text-muted-foreground">
              <ShieldAlert className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">Nenhuma denuncia encontrada</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {report.target_type === 'post' ? 'Post' : 'Comentario'}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {REASON_LABELS[report.reason] || report.reason}
                      </Badge>
                      <Badge
                        variant={
                          report.status === 'pending'
                            ? 'destructive'
                            : report.status === 'resolved'
                              ? 'default'
                              : 'secondary'
                        }
                        className="text-xs"
                      >
                        {report.status === 'pending'
                          ? 'Pendente'
                          : report.status === 'resolved'
                            ? 'Resolvido'
                            : 'Dispensado'}
                      </Badge>
                    </div>

                    {report.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {DOMPurify.sanitize(report.description, { ALLOWED_TAGS: [] })}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {report.reporter && (
                        <span>
                          Denunciado por {report.reporter.first_name} {report.reporter.last_name}
                        </span>
                      )}
                      <span>
                        {formatDistanceToNow(new Date(report.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </div>

                  {report.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actionLoading === report.id}
                        onClick={() => handleDismiss(report)}
                      >
                        {actionLoading === report.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Dispensar'
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={actionLoading === report.id}
                        onClick={() => handleRemoveContent(report)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remover
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={actionLoading === report.id}
                        onClick={async () => {
                          // Buscar o autor do conteúdo denunciado (não o denunciante)
                          let authorId = ''
                          let authorName = 'Usuário'
                          try {
                            const table = report.target_type === 'post' ? 'community_posts' : 'community_comments'
                            const { supabase: sb } = await import('@/lib/supabase/client')
                            const { data } = await sb
                              .from(table)
                              .select('user_id, users:user_id(first_name, last_name)')
                              .eq('id', report.target_id)
                              .single()
                            if (data) {
                              authorId = data.user_id
                              const u = data.users as any
                              if (u) authorName = `${u.first_name} ${u.last_name}`
                            }
                          } catch {}
                          if (authorId) {
                            setMuteDialog({
                              open: true,
                              userId: authorId,
                              userName: authorName,
                            })
                          }
                        }}
                      >
                        <VolumeX className="h-4 w-4 mr-1" />
                        Silenciar
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MuteUserDialog
        open={muteDialog.open}
        onOpenChange={(open) => setMuteDialog((prev) => ({ ...prev, open }))}
        userId={muteDialog.userId}
        userName={muteDialog.userName}
      />
    </div>
  )
}

// ── Spaces Tab ─────────────────────────────────────────────────────────────

function SpacesTab() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [spaces, setSpaces] = useState<CommunitySpace[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSpace, setEditingSpace] = useState<CommunitySpace | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formIcon, setFormIcon] = useState('MessageSquare')
  const [formColor, setFormColor] = useState('#3b82f6')
  const [formType, setFormType] = useState('general')
  const [formOrder, setFormOrder] = useState(0)

  const fetchSpaces = useCallback(async () => {
    setLoading(true)
    try {
      // Get all spaces including archived
      const { data, error } = await (await import('@/lib/supabase/client')).supabase
        .from('community_spaces')
        .select('*')
        .order('order', { ascending: true })

      if (error) throw error
      setSpaces((data || []) as CommunitySpace[])
    } catch (error) {
      logger.error('Failed to load spaces', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSpaces()
  }, [fetchSpaces])

  const resetForm = () => {
    setFormName('')
    setFormSlug('')
    setFormDescription('')
    setFormIcon('MessageSquare')
    setFormColor('#3b82f6')
    setFormType('general')
    setFormOrder(spaces.length)
    setEditingSpace(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setFormOrder(spaces.length)
    setDialogOpen(true)
  }

  const openEditDialog = (space: CommunitySpace) => {
    setEditingSpace(space)
    setFormName(space.name)
    setFormSlug(space.slug)
    setFormDescription(space.description || '')
    setFormIcon(space.icon)
    setFormColor(space.color)
    setFormType(space.space_type)
    setFormOrder(space.order)
    setDialogOpen(true)
  }

  const handleNameChange = (name: string) => {
    setFormName(name)
    if (!editingSpace) {
      setFormSlug(slugify(name))
    }
  }

  const handleSave = async () => {
    if (!formName.trim() || !formSlug.trim()) {
      toast({ title: 'Nome e slug sao obrigatorios', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: formName.trim(),
        slug: formSlug.trim(),
        description: formDescription.trim() || null,
        icon: formIcon,
        color: formColor,
        space_type: formType,
        order: formOrder,
        is_archived: false,
        created_by: user?.id || null,
      }

      if (editingSpace) {
        await communityService.updateSpace(editingSpace.id, payload)
        toast({ title: 'Espaco atualizado' })
      } else {
        await communityService.createSpace(payload)
        toast({ title: 'Espaco criado' })
      }

      setDialogOpen(false)
      resetForm()
      fetchSpaces()
    } catch (error) {
      logger.error('Failed to save space', error)
      toast({ title: 'Erro ao salvar espaco', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (space: CommunitySpace) => {
    try {
      await communityService.updateSpace(space.id, { is_archived: !space.is_archived })
      toast({ title: space.is_archived ? 'Espaco reativado' : 'Espaco arquivado' })
      fetchSpaces()
    } catch (error) {
      logger.error('Failed to archive space', error)
      toast({ title: 'Erro ao arquivar espaco', variant: 'destructive' })
    }
  }

  const handleDelete = async (space: CommunitySpace) => {
    if (!confirm(`Tem certeza que deseja excluir o espaco "${space.name}"? Esta acao nao pode ser desfeita.`)) {
      return
    }

    try {
      await communityService.deleteSpace(space.id)
      toast({ title: 'Espaco excluido' })
      fetchSpaces()
    } catch (error) {
      logger.error('Failed to delete space', error)
      toast({ title: 'Erro ao excluir espaco', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Espaco
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : spaces.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center text-muted-foreground">
              <Hash className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">Nenhum espaco criado</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {spaces.map((space) => (
            <Card key={space.id} className={space.is_archived ? 'opacity-60' : ''}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: space.color }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {space.name}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {space.space_type}
                        </Badge>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          #{space.order}
                        </Badge>
                        {space.is_archived && (
                          <Badge variant="destructive" className="text-xs shrink-0">
                            Arquivado
                          </Badge>
                        )}
                      </div>
                      {space.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {DOMPurify.sanitize(space.description, { ALLOWED_TAGS: [] })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(space)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleArchive(space)} aria-label="Arquivar">
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(space)}
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {editingSpace ? 'Editar Espaco' : 'Novo Espaco'}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {editingSpace
                ? 'Atualize as informacoes do espaco.'
                : 'Preencha as informacoes para criar um novo espaco.'}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="space-name">Nome</Label>
              <Input
                id="space-name"
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Nome do espaco"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="space-slug">Slug</Label>
              <Input
                id="space-slug"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="slug-do-espaco"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="space-description">Descricao</Label>
              <Input
                id="space-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descricao do espaco"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icone</Label>
                <Select value={formIcon} onValueChange={setFormIcon}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <Select value={formColor} onValueChange={setFormColor}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: opt.value }}
                          />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="space-order">Ordem</Label>
                <Input
                  id="space-order"
                  type="number"
                  min={0}
                  value={formOrder}
                  onChange={(e) => setFormOrder(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingSpace ? 'Salvar' : 'Criar'}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  )
}

// ── Word Filter Tab ────────────────────────────────────────────────────────

function WordFilterTab() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [words, setWords] = useState<{ id: string; word: string; created_by: string; created_at: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [newWord, setNewWord] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchWords = useCallback(async () => {
    setLoading(true)
    try {
      const data = await communityService.getWordFilter()
      setWords(data)
    } catch (error) {
      logger.error('Failed to load word filter', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWords()
  }, [fetchWords])

  const handleAdd = async () => {
    if (!newWord.trim() || !user?.id) return

    setAdding(true)
    try {
      await communityService.addFilterWord(newWord.trim(), user.id)
      setNewWord('')
      toast({ title: 'Palavra adicionada ao filtro' })
      fetchWords()
    } catch (error) {
      logger.error('Failed to add filter word', error)
      toast({ title: 'Erro ao adicionar palavra', variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await communityService.removeFilterWord(id)
      toast({ title: 'Palavra removida do filtro' })
      fetchWords()
    } catch (error) {
      logger.error('Failed to remove filter word', error)
      toast({ title: 'Erro ao remover palavra', variant: 'destructive' })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="space-y-4">
      {/* Add word form */}
      <div className="flex gap-2">
        <Input
          placeholder="Nova palavra..."
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          onKeyDown={handleKeyDown}
          className="max-w-xs"
        />
        <Button onClick={handleAdd} disabled={adding || !newWord.trim()}>
          {adding ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Adicionar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : words.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">Nenhuma palavra no filtro</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-2">
              {words.map((w) => (
                <Badge
                  key={w.id}
                  variant="secondary"
                  className="gap-1 text-sm py-1 px-3"
                >
                  {w.word}
                  <button
                    type="button"
                    onClick={() => handleRemove(w.id)}
                    className="ml-1 hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ModerationPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('reports')

  const isAuthorized = profile?.role === 'administrator' || profile?.role === 'teacher'

  if (!isAuthorized) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Voce nao tem permissao para acessar esta pagina.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/comunidade')} aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Moderacao</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie denuncias, espacos e filtros
          </p>
        </div>
      </div>

      <PageTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'reports', label: 'Denuncias', content: <ReportsTab /> },
          { value: 'spaces', label: 'Espacos', content: <SpacesTab /> },
          { value: 'words', label: 'Filtro de Palavras', content: <WordFilterTab /> },
        ]}
      />
    </div>
  )
}
