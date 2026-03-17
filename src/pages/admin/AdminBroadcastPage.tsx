import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { notificationService } from '@/services/notificationService'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import {
  Send,
  Megaphone,
  Users,
  GraduationCap,
  User,
  Loader2,
  Bell,
  AlertCircle,
  BookOpen,
  Calendar,
  Info,
  CheckCircle2,
  History,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const NOTIFICATION_TYPES = [
  { value: 'system', label: 'Aviso Geral', icon: Bell, color: 'text-muted-foreground' },
  { value: 'reminder', label: 'Lembrete', icon: Calendar, color: 'text-blue-500' },
  { value: 'course', label: 'Curso / Aula', icon: BookOpen, color: 'text-primary' },
  { value: 'warning', label: 'Alerta Importante', icon: AlertCircle, color: 'text-amber-500' },
  { value: 'social', label: 'Comunidade', icon: Users, color: 'text-purple-500' },
]

interface ClassOption {
  id: string
  name: string
  student_count: number
}

interface RecentBroadcast {
  title: string
  type: string
  target: string
  count: number
  created_at: string
}

export default function AdminBroadcastPage() {
  usePageTitle('Comunicados')
  const { toast } = useToast()
  const { user } = useAuth()

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState('system')
  const [target, setTarget] = useState<'all' | 'class' | 'student'>('all')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [studentEmail, setStudentEmail] = useState('')
  const [sending, setSending] = useState(false)

  const [classes, setClasses] = useState<ClassOption[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [recentBroadcasts, setRecentBroadcasts] = useState<RecentBroadcast[]>([])
  const [loadingClasses, setLoadingClasses] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoadingClasses(true)

      // Fetch classes with student counts
      const { data: classData } = await supabase
        .from('classes')
        .select('id, name')
        .order('name')

      if (classData) {
        const classesWithCounts = await Promise.all(
          classData.map(async (c) => {
            const { count } = await supabase
              .from('student_classes')
              .select('*', { count: 'exact', head: true })
              .eq('class_id', c.id)
            return { id: c.id, name: c.name, student_count: count || 0 }
          })
        )
        setClasses(classesWithCounts)
      }

      // Total students
      const { count: studentCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student')
      setTotalStudents(studentCount || 0)

    } catch (err) {
      logger.error('Error loading broadcast data:', err)
    } finally {
      setLoadingClasses(false)
    }
  }

  const getRecipientCount = (): number => {
    if (target === 'all') return totalStudents
    if (target === 'class') {
      const cls = classes.find(c => c.id === selectedClassId)
      return cls?.student_count || 0
    }
    return 1
  }

  const getRecipientLabel = (): string => {
    if (target === 'all') return `Todos os alunos (${totalStudents})`
    if (target === 'class') {
      const cls = classes.find(c => c.id === selectedClassId)
      return cls ? `${cls.name} (${cls.student_count} alunos)` : 'Selecione uma turma'
    }
    return studentEmail || 'Digite o e-mail'
  }

  const handleSend = async () => {
    if (!title.trim()) {
      toast({ title: 'Preencha o título', variant: 'destructive' })
      return
    }
    if (!message.trim()) {
      toast({ title: 'Preencha a mensagem', variant: 'destructive' })
      return
    }

    try {
      setSending(true)

      let userIds: string[] = []

      if (target === 'all') {
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'student')
        userIds = data?.map(u => u.id) || []
      } else if (target === 'class') {
        if (!selectedClassId) {
          toast({ title: 'Selecione uma turma', variant: 'destructive' })
          return
        }
        const { data } = await supabase
          .from('student_classes')
          .select('user_id')
          .eq('class_id', selectedClassId)
        userIds = data?.map(sc => sc.user_id) || []
      } else if (target === 'student') {
        if (!studentEmail.trim()) {
          toast({ title: 'Digite o e-mail do aluno', variant: 'destructive' })
          return
        }
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('email', studentEmail.trim().toLowerCase())
          .single()
        if (!data) {
          toast({ title: 'Aluno não encontrado', description: 'Verifique o e-mail digitado.', variant: 'destructive' })
          return
        }
        userIds = [data.id]
      }

      if (userIds.length === 0) {
        toast({ title: 'Nenhum destinatário encontrado', variant: 'destructive' })
        return
      }

      const success = await notificationService.createBulkNotifications(userIds, {
        type,
        title: title.trim(),
        message: message.trim(),
      })

      if (success) {
        toast({
          title: 'Aviso enviado!',
          description: `Notificação enviada para ${userIds.length} ${userIds.length === 1 ? 'aluno' : 'alunos'}.`,
        })

        // Add to recent history
        setRecentBroadcasts(prev => [{
          title: title.trim(),
          type,
          target: target === 'all' ? 'Todos' : target === 'class' ? classes.find(c => c.id === selectedClassId)?.name || 'Turma' : studentEmail,
          count: userIds.length,
          created_at: new Date().toISOString(),
        }, ...prev].slice(0, 5))

        // Reset form
        setTitle('')
        setMessage('')
        setType('system')
      } else {
        toast({ title: 'Erro ao enviar', description: 'Tente novamente.', variant: 'destructive' })
      }
    } catch (err) {
      logger.error('Error sending broadcast:', err)
      toast({ title: 'Erro ao enviar', description: 'Verifique sua conexão.', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const selectedType = NOTIFICATION_TYPES.find(t => t.value === type)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Enviar Aviso</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie notificações para alunos no portal
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="border-border shadow-sm">
            <CardContent className="p-5 space-y-5">
              {/* Type */}
              <div className="space-y-1.5">
                <Label className="font-semibold">Tipo do Aviso</Label>
                <div className="flex flex-wrap gap-2">
                  {NOTIFICATION_TYPES.map((nt) => {
                    const Icon = nt.icon
                    const isSelected = type === nt.value
                    return (
                      <button
                        key={nt.value}
                        onClick={() => setType(nt.value)}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200',
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/50'
                        )}
                      >
                        <Icon className={cn('h-4 w-4', isSelected ? 'text-primary' : nt.color)} />
                        {nt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="title" className="font-semibold">Título *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Simulado EAOF amanhã às 14h"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">{title.length}/100</p>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="message" className="font-semibold">Mensagem *</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escreva o conteúdo do aviso..."
                  rows={4}
                  maxLength={500}
                  className="resize-y"
                />
                <p className="text-xs text-muted-foreground">{message.length}/500</p>
              </div>

              {/* Target */}
              <div className="space-y-1.5">
                <Label className="font-semibold">Destinatários</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'all' as const, label: 'Todos os Alunos', icon: Users, count: totalStudents },
                    { key: 'class' as const, label: 'Por Turma', icon: GraduationCap },
                    { key: 'student' as const, label: 'Aluno Específico', icon: User },
                  ].map((opt) => {
                    const Icon = opt.icon
                    const isSelected = target === opt.key
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setTarget(opt.key)}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200',
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/50'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {opt.label}
                        {'count' in opt && (
                          <Badge variant="secondary" className="text-xs">{opt.count}</Badge>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Class selector */}
                {target === 'class' && (
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecione a turma..." />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.student_count} alunos)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Student email */}
                {target === 'student' && (
                  <Input
                    className="mt-2"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="email@aluno.com"
                    type="email"
                  />
                )}
              </div>

              {/* Send */}
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  {getRecipientLabel()}
                </p>
                <Button
                  onClick={handleSend}
                  disabled={sending || !title.trim() || !message.trim()}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar Aviso
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Preview */}
          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Pré-visualização
              </h3>
              {title || message ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {selectedType && <selectedType.icon className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground">{title || 'Título do aviso'}</p>
                      <p className="text-xs text-muted-foreground mt-1">{message || 'Mensagem do aviso...'}</p>
                      <p className="text-[10px] text-muted-foreground mt-2">agora mesmo</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Preencha o formulário para ver a pré-visualização
                </p>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" />
                Alcance
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="text-xl font-bold text-blue-600">{totalStudents}</div>
                  <div className="text-xs text-muted-foreground">Alunos Total</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="text-xl font-bold text-green-600">{classes.length}</div>
                  <div className="text-xs text-muted-foreground">Turmas</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent */}
          {recentBroadcasts.length > 0 && (
            <Card className="border-border shadow-sm">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Enviados agora
                </h3>
                <div className="space-y-2">
                  {recentBroadcasts.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{b.title}</p>
                        <p className="text-muted-foreground">{b.target} · {b.count} aluno{b.count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
