import { useState, useEffect, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowLeft,
  Eye,
  MoreHorizontal,
  FileText,
  CheckCircle,
  Clock,
  PenLine,
  Send,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import { SectionLoader } from '@/components/SectionLoader'
import { cn } from '@/lib/utils'
import { createNotification } from '@/services/notificationService'
import { logger } from '@/lib/logger'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; color: string }> = {
  submitted: { label: 'Pendente', variant: 'secondary', color: 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-800' },
  correcting: { label: 'Em Correção', variant: 'outline', color: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800' },
  corrected: { label: 'Corrigida', variant: 'default', color: 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 border-green-300 dark:border-green-800' },
}

interface EssaySubmission {
  id: string
  status: string
  final_grade: number | null
  final_grade_ciaar: number | null
  submission_date: string | null
  created_at: string
  student_id: string
  prompt_title: string
  prompt_id: string
  student_name: string
}

export default function AdminEssaySubmissionsPage() {
  const { classId } = useParams()
  const navigate = useNavigate()
  usePageTitle('Submissões de Redação')
  const { toast } = useToast()
  const { classIds: teacherClassIds, isTeacher, loading: teacherLoading } = useTeacherClasses()

  const [loading, setLoading] = useState(true)
  const [className, setClassName] = useState('')
  const [essays, setEssays] = useState<EssaySubmission[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [sendingResults, setSendingResults] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [themeFilter, setThemeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (teacherLoading) return
    if (isTeacher && classId && !teacherClassIds.includes(classId)) {
      toast({ title: 'Acesso negado', description: 'Você não tem permissão para acessar esta turma.', variant: 'destructive' })
      navigate('/admin/essays')
      return
    }
    if (classId) loadData()
  }, [classId, teacherLoading])

  const loadData = async () => {
    try {
      setLoading(true)

      // Get class info
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('id', classId!)
        .single()

      if (classError) throw classError
      setClassName(classData?.name || 'Turma')

      // Get student IDs in this class
      const { data: studentClasses, error: scError } = await supabase
        .from('student_classes')
        .select('user_id')
        .eq('class_id', classId!)

      if (scError) throw scError

      const studentIds = studentClasses?.map(sc => sc.user_id) || []

      if (studentIds.length === 0) {
        setEssays([])
        return
      }

      // Get essays from these students with related data
      const { data: essaysData, error: essaysError } = await supabase
        .from('essays')
        .select(`
          id, status, final_grade, final_grade_ciaar, submission_date, created_at, student_id, prompt_id,
          essay_prompts(title),
          users!student_id(first_name, last_name)
        `)
        .in('student_id', studentIds)
        .order('submission_date', { ascending: false })

      if (essaysError) throw essaysError

      const mapped: EssaySubmission[] = (essaysData || []).map((e: any) => ({
        id: e.id,
        status: e.status,
        final_grade: e.final_grade,
        final_grade_ciaar: e.final_grade_ciaar,
        submission_date: e.submission_date,
        created_at: e.created_at,
        student_id: e.student_id,
        prompt_id: e.prompt_id,
        prompt_title: e.essay_prompts?.title || 'Sem tema',
        student_name: e.users
          ? `${e.users.first_name} ${e.users.last_name}`
          : 'Aluno desconhecido',
      }))

      setEssays(mapped)
    } catch (error: any) {
      logger.error('Error loading class essays:', error)
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // Unique themes from essays for filter dropdown
  const themes = useMemo(() => {
    const map = new Map<string, string>()
    essays.forEach(e => {
      if (e.prompt_id && e.prompt_title) {
        map.set(e.prompt_id, e.prompt_title)
      }
    })
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }))
  }, [essays])

  // Client-side filtering
  const filteredEssays = useMemo(() => {
    let result = essays

    if (statusFilter !== 'all') {
      result = result.filter(e => e.status === statusFilter)
    }

    if (themeFilter !== 'all') {
      result = result.filter(e => e.prompt_id === themeFilter)
    }

    if (dateFrom) {
      const from = new Date(dateFrom)
      from.setHours(0, 0, 0, 0)
      result = result.filter(e => {
        const d = new Date(e.submission_date || e.created_at)
        return d >= from
      })
    }

    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      result = result.filter(e => {
        const d = new Date(e.submission_date || e.created_at)
        return d <= to
      })
    }

    return result
  }, [essays, statusFilter, themeFilter, dateFrom, dateTo])

  // Stats
  const stats = useMemo(() => {
    const total = essays.length
    const pending = essays.filter(e => e.status === 'submitted').length
    const correcting = essays.filter(e => e.status === 'correcting').length
    const corrected = essays.filter(e => e.status === 'corrected').length
    return { total, pending, correcting, corrected }
  }, [essays])

  const hasActiveFilters = statusFilter !== 'all' || themeFilter !== 'all' || dateFrom || dateTo

  const clearFilters = () => {
    setStatusFilter('all')
    setThemeFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  // Selection handlers
  const handleSelect = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    setSelected(filteredEssays.map(e => e.id))
  }

  const handleClearSelection = () => {
    setSelected([])
  }

  const isAllSelected = filteredEssays.length > 0 && selected.length === filteredEssays.length

  const handleToggleAll = () => {
    if (isAllSelected) {
      handleClearSelection()
    } else {
      handleSelectAll()
    }
  }

  // Send result notification for a single essay
  const sendResultNotification = async (essay: EssaySubmission) => {
    if (essay.status !== 'corrected') {
      toast({ title: 'Ação não permitida', description: 'Só é possível enviar resultado de redações corrigidas.', variant: 'destructive' })
      return
    }

    try {
      await createNotification({
        user_id: essay.student_id,
        type: 'essay_corrected',
        title: 'Sua redação foi corrigida!',
        message: `A redação "${essay.prompt_title}" recebeu nota ${essay.final_grade_ciaar || essay.final_grade || 'N/A'}.`,
        related_entity_id: essay.id,
        related_entity_type: 'essay',
      })
      toast({ title: 'Resultado enviado', description: `Notificação enviada para ${essay.student_name}.` })
    } catch (error: any) {
      logger.error('Error sending result notification:', error)
      toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' })
    }
  }

  // Bulk send results
  const handleBulkSendResults = async () => {
    const selectedEssays = essays.filter(e => selected.includes(e.id))
    const correctedEssays = selectedEssays.filter(e => e.status === 'corrected')

    if (correctedEssays.length === 0) {
      toast({ title: 'Nenhuma redação corrigida', description: 'Selecione redações com status "Corrigida" para enviar resultados.', variant: 'destructive' })
      return
    }

    setSendingResults(true)
    let successCount = 0
    let errorCount = 0

    for (const essay of correctedEssays) {
      try {
        await createNotification({
          user_id: essay.student_id,
          type: 'essay_corrected',
          title: 'Sua redação foi corrigida!',
          message: `A redação "${essay.prompt_title}" recebeu nota ${essay.final_grade_ciaar || essay.final_grade || 'N/A'}.`,
          related_entity_id: essay.id,
          related_entity_type: 'essay',
        })
        successCount++
      } catch {
        errorCount++
      }
    }

    setSendingResults(false)

    const skipped = selectedEssays.length - correctedEssays.length
    let description = `${successCount} notificação(ões) enviada(s) com sucesso.`
    if (errorCount > 0) description += ` ${errorCount} erro(s).`
    if (skipped > 0) description += ` ${skipped} ignorada(s) (não corrigidas).`

    toast({ title: 'Resultados enviados', description })
    setSelected([])
  }

  const formatDateTime = (dateStr: string | null, fallback: string) => {
    const d = dateStr || fallback
    if (!d) return '\u2014'
    const date = new Date(d)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) return <SectionLoader />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/admin/essays"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{className}</h1>
        <p className="text-sm text-muted-foreground mt-1">Redações da turma {className}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-500/30">
          <CardContent className="p-4 text-center">
            <FileText className="h-5 w-5 text-blue-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-orange-500/30">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 text-orange-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Pendentes</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-500/30">
          <CardContent className="p-4 text-center">
            <PenLine className="h-5 w-5 text-blue-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{stats.correcting}</div>
            <div className="text-xs text-muted-foreground">Em Correção</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-green-500/30">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{stats.corrected}</div>
            <div className="text-xs text-muted-foreground">Corrigidas</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="submitted">Pendente</SelectItem>
                  <SelectItem value="correcting">Em Correção</SelectItem>
                  <SelectItem value="corrected">Corrigida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-56">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tema</label>
              <Select value={themeFilter} onValueChange={setThemeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {themes.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de envio &quot;De&quot;</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>

            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de envio &quot;Até&quot;</label>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
                <X className="h-3.5 w-3.5" />
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk actions bar */}
      {selected.length > 0 && (
        <Card className="border-border shadow-sm border-primary/30">
          <CardContent className="p-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">{selected.length} selecionado(s)</span>
            <Button
              size="sm"
              onClick={handleBulkSendResults}
              disabled={sendingResults}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              {sendingResults ? 'Enviando...' : 'Enviar Resultados'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleSelectAll}>
              Selecionar Todos
            </Button>
            <Button size="sm" variant="outline" onClick={handleClearSelection}>
              Limpar Seleção
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          {filteredEssays.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">
                {hasActiveFilters
                  ? 'Nenhuma redação encontrada com os filtros aplicados.'
                  : 'Nenhuma redação enviada nesta turma.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleToggleAll}
                      />
                    </TableHead>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Tema</TableHead>
                    <TableHead>Data de Envio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEssays.map((essay) => {
                    const statusInfo = STATUS_MAP[essay.status] || STATUS_MAP.submitted
                    const grade = essay.final_grade_ciaar || essay.final_grade

                    return (
                      <TableRow key={essay.id} className="transition-colors hover:bg-muted/50">
                        <TableCell>
                          <Checkbox
                            checked={selected.includes(essay.id)}
                            onCheckedChange={() => handleSelect(essay.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{essay.student_name}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {essay.prompt_title}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDateTime(essay.submission_date, essay.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={statusInfo.variant}
                            className={cn(statusInfo.color)}
                          >
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-primary">
                          {grade ?? '\u2014'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to={`/admin/essays/submissions/${essay.id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  {essay.status === 'corrected' ? 'Ver Correção' : 'Corrigir'}
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={essay.status !== 'corrected'}
                                onClick={() => sendResultNotification(essay)}
                              >
                                <Send className="mr-2 h-4 w-4" />
                                Enviar Resultado
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
