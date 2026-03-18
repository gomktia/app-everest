import { useState, useEffect, useMemo } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { format, isSameDay, parseISO, isAfter, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  PlusCircle,
  Trash2,
  Calendar as CalendarIcon,
  Loader2,
  Clock,
  Video,
  Target,
  PenTool,
  Info,
  Filter,
  ChevronRight,
  Users,
  Pencil,
  List,
} from 'lucide-react'
import { PageTabs } from '@/components/PageTabs'
import {
  getCalendarEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  type CalendarEvent,
} from '@/services/calendarService'
import { getClasses, type Class } from '@/services/classService'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'

const eventConfig = {
  LIVE_CLASS: {
    label: 'Mentoria',
    icon: Video,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    dot: 'bg-emerald-500/100',
    badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  },
  SIMULATION: {
    label: 'Simulado',
    icon: Target,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    dot: 'bg-blue-500/100',
    badge: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  },
  ESSAY_DEADLINE: {
    label: 'Redação',
    icon: PenTool,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
    dot: 'bg-rose-500/100',
    badge: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400',
  },
  GENERAL: {
    label: 'Geral',
    icon: Info,
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-500/10 border-slate-500/20',
    dot: 'bg-slate-400',
    badge: 'bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400',
  },
}

type EventType = keyof typeof eventConfig

export default function AdminCalendarPage() {
  usePageTitle('Calendário')
  const { isTeacher, classIds: teacherClassIds, loading: teacherLoading } = useTeacherClasses()
  const [activeTab, setActiveTab] = useState('calendar')
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [filterClass, setFilterClass] = useState<string>('ALL')
  const [filterType, setFilterType] = useState<string>('ALL')
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '19:30',
    endTime: '21:00',
    type: 'LIVE_CLASS',
    classId: 'global',
  })

  const loadData = async () => {
    try {
      setLoading(true)
      const [eventsData, classesData] = await Promise.all([
        getCalendarEvents(currentMonth),
        getClasses(),
      ])
      setEvents(eventsData)
      // Teacher scope: only show teacher's own classes in dropdown
      if (isTeacher && teacherClassIds.length > 0) {
        setClasses(classesData.filter(c => teacherClassIds.includes(c.id)))
      } else {
        setClasses(classesData)
      }
    } catch {
      setEvents([])
      toast({ title: 'Erro ao carregar eventos', description: 'Os eventos do mês não puderam ser carregados.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!teacherLoading) loadData()
  }, [currentMonth, teacherLoading, isTeacher, teacherClassIds.length])

  const filteredEvents = useMemo(() => {
    let result = events
    if (filterClass !== 'ALL') {
      result = result.filter(e =>
        filterClass === 'global' ? !e.class_id : e.class_id === filterClass
      )
    }
    if (filterType !== 'ALL') {
      result = result.filter(e => e.event_type === filterType)
    }
    return result
  }, [events, filterClass, filterType])

  const selectedDayEvents = useMemo(() => {
    if (!date) return []
    return filteredEvents.filter((event) => isSameDay(parseISO(event.start_time), date))
  }, [date, filteredEvents])

  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date())
    return events
      .filter(e => isAfter(new Date(e.start_time), today))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 8)
  }, [events])

  const eventCountByType = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of events) {
      counts[e.event_type] = (counts[e.event_type] || 0) + 1
    }
    return counts
  }, [events])

  const handleEditEvent = (event: CalendarEvent) => {
    const startDate = parseISO(event.start_time)
    setEditingEventId(event.id)
    setFormData({
      title: event.title,
      description: event.description || '',
      date: format(startDate, 'yyyy-MM-dd'),
      startTime: format(startDate, 'HH:mm'),
      endTime: event.end_time ? format(parseISO(event.end_time), 'HH:mm') : '',
      type: event.event_type || 'GENERAL',
      classId: event.class_id || 'global',
    })
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setEditingEventId(null)
    setFormData({
      title: '',
      description: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: '19:30',
      endTime: '21:00',
      type: 'LIVE_CLASS',
      classId: 'global',
    })
  }

  const handleSaveEvent = async () => {
    if (!formData.title.trim()) {
      toast({ title: 'Título obrigatório', variant: 'destructive' })
      return
    }
    // Teacher scope: verify classId belongs to teacher
    if (isTeacher && formData.classId !== 'global' && !teacherClassIds.includes(formData.classId)) {
      toast({ title: 'Acesso negado', description: 'Você só pode criar eventos para suas próprias turmas.', variant: 'destructive' })
      return
    }
    try {
      setIsSubmitting(true)
      const startDateTime = new Date(`${formData.date}T${formData.startTime}:00`)
      const endDateTime = formData.endTime
        ? new Date(`${formData.date}T${formData.endTime}:00`)
        : undefined

      const eventData = {
        title: formData.title,
        description: formData.description || undefined,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime?.toISOString(),
        event_type: formData.type as any,
        class_id: formData.classId === 'global' ? null : formData.classId,
      }

      if (editingEventId) {
        await updateEvent(editingEventId, eventData)
        toast({ title: 'Evento atualizado com sucesso' })
      } else {
        await createEvent(eventData)
        toast({ title: 'Evento criado com sucesso' })
      }

      setIsDialogOpen(false)
      resetForm()
      loadData()
    } catch {
      toast({ title: editingEventId ? 'Erro ao atualizar evento' : 'Erro ao criar evento', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteEvent = async (id: string) => {
    // Teacher scope: verify the event belongs to teacher's class
    if (isTeacher) {
      const event = events.find(e => e.id === id)
      if (event?.class_id && !teacherClassIds.includes(event.class_id)) {
        toast({ title: 'Acesso negado', description: 'Você só pode excluir eventos das suas próprias turmas.', variant: 'destructive' })
        return
      }
    }
    if (!confirm('Excluir este evento?')) return
    try {
      await deleteEvent(id)
      toast({ title: 'Evento excluído' })
      loadData()
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
    }
  }

  const getEventConfig = (type: string) => eventConfig[type as EventType] || eventConfig.GENERAL
  const getClassName = (classId: string | null) => {
    if (!classId) return 'Global'
    return classes.find(c => c.id === classId)?.name || 'Turma'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendário de Eventos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie mentorias, simulados e prazos por turma
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingEventId ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  placeholder="Ex: Mentoria 1 - Acentuação gráfica"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  placeholder="Detalhes do evento..."
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="date">Data</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Início</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">Fim</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LIVE_CLASS">Mentoria / Aula ao Vivo</SelectItem>
                      <SelectItem value="SIMULATION">Simulado</SelectItem>
                      <SelectItem value="ESSAY_DEADLINE">Prazo de Redação</SelectItem>
                      <SelectItem value="GENERAL">Geral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Turma</Label>
                  <Select
                    value={formData.classId}
                    onValueChange={(v) => setFormData({ ...formData, classId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (Todas)</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEvent} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingEventId ? 'Salvar' : 'Criar Evento'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <PageTabs
        value={activeTab}
        onChange={setActiveTab}
        layout="full"
        tabs={[
          {
            value: 'calendar',
            label: 'Calendário',
            icon: <CalendarIcon className="h-4 w-4" />,
            content: (
              <div className="space-y-6 mt-4">
                {/* Stats Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(Object.keys(eventConfig) as EventType[]).map((type) => {
                    const config = eventConfig[type]
                    const Icon = config.icon
                    const count = eventCountByType[type] || 0
                    return (
                      <button
                        key={type}
                        onClick={() => setFilterType(filterType === type ? 'ALL' : type)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                          filterType === type
                            ? "ring-2 ring-primary/50 " + config.bg
                            : "bg-card hover:bg-muted/50"
                        )}
                      >
                        <div className={cn("p-2 rounded-lg", config.bg)}>
                          <Icon className={cn("h-4 w-4", config.color)} />
                        </div>
                        <div>
                          <div className="text-xl font-bold leading-none">{count}</div>
                          <div className="text-xs text-muted-foreground">{config.label}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={filterClass} onValueChange={setFilterClass}>
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue placeholder="Filtrar por turma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas as turmas</SelectItem>
                      <SelectItem value="global">Apenas Globais</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(filterClass !== 'ALL' || filterType !== 'ALL') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => { setFilterClass('ALL'); setFilterType('ALL') }}
                    >
                      Limpar filtros
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {filteredEvents.length} de {events.length} eventos
                  </span>
                </div>

                {/* Main Content */}
                <div className="grid gap-6 lg:grid-cols-5">
                  {/* Calendar */}
                  <div className="lg:col-span-3">
                    <div className="rounded-lg border bg-card p-4">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        month={currentMonth}
                        onMonthChange={setCurrentMonth}
                        className="rounded-md mx-auto"
                        locale={ptBR}
                        modifiers={{
                          event: filteredEvents.map((event) => parseISO(event.start_time)),
                        }}
                        modifiersStyles={{
                          event: {
                            fontWeight: 'bold',
                            color: 'hsl(var(--primary))',
                            backgroundColor: 'hsl(var(--primary) / 0.1)',
                            borderRadius: '6px',
                          },
                        }}
                      />
                    </div>
                  </div>

                  {/* Day Events */}
                  <div className="lg:col-span-2">
                    <div className="rounded-lg border bg-card">
                      <div className="p-4 border-b">
                        <h2 className="font-semibold">
                          {date ? format(date, "dd 'de' MMMM", { locale: ptBR }) : 'Selecione um dia'}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {selectedDayEvents.length} evento{selectedDayEvents.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="p-3 space-y-2 max-h-[450px] overflow-y-auto">
                        {loading ? (
                          <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
                        ) : selectedDayEvents.length > 0 ? (
                          selectedDayEvents.map((event) => {
                            const config = getEventConfig(event.event_type)
                            const Icon = config.icon
                            return (
                              <div
                                key={event.id}
                                className={cn("p-3 rounded-lg border group", config.bg)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2 flex-1 min-w-0">
                                    <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
                                    <div className="min-w-0">
                                      <p className="font-medium text-sm leading-tight">{event.title}</p>
                                      {event.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                          {event.description}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {format(parseISO(event.start_time), 'HH:mm')}
                                          {event.end_time && ` - ${format(parseISO(event.end_time), 'HH:mm')}`}
                                        </span>
                                        <Badge variant="outline" className="text-[10px] h-5">
                                          <Users className="h-2.5 w-2.5 mr-1" />
                                          {getClassName(event.class_id)}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                      onClick={() => handleEditEvent(event)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive shrink-0"
                                      onClick={() => handleDeleteEvent(event.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        ) : (
                          <div className="text-center py-8">
                            <CalendarIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Nenhum evento</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
          {
            value: 'upcoming',
            label: 'Próximos Eventos',
            icon: <List className="h-4 w-4" />,
            count: upcomingEvents.length,
            content: (
              <div className="mt-4">
                {upcomingEvents.length > 0 ? (
                  <div className="rounded-lg border bg-card">
                    <div className="p-4 border-b flex items-center justify-between">
                      <h2 className="font-semibold">Próximos Eventos</h2>
                      <span className="text-xs text-muted-foreground">{events.length} eventos no mês</span>
                    </div>
                    <div className="divide-y">
                      {upcomingEvents.map((event) => {
                        const config = getEventConfig(event.event_type)
                        const Icon = config.icon
                        const eventDate = parseISO(event.start_time)
                        return (
                          <div
                            key={event.id}
                            className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group"
                            onClick={() => {
                              setDate(eventDate)
                              setCurrentMonth(eventDate)
                              setActiveTab('calendar')
                            }}
                          >
                            <div className="text-center w-10 shrink-0">
                              <div className="text-lg font-bold leading-none">{format(eventDate, 'dd')}</div>
                              <div className="text-[10px] uppercase text-muted-foreground">
                                {format(eventDate, 'MMM', { locale: ptBR })}
                              </div>
                            </div>
                            <div className={cn("w-1 h-8 rounded-full shrink-0", config.dot)} />
                            <Icon className={cn("h-4 w-4 shrink-0", config.color)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{event.title}</p>
                              <span className="text-xs text-muted-foreground">
                                {format(eventDate, "EEEE", { locale: ptBR })} · {format(eventDate, 'HH:mm')}
                                {event.end_time && ` - ${format(parseISO(event.end_time), 'HH:mm')}`}
                              </span>
                            </div>
                            <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                              {getClassName(event.class_id)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteEvent(event.id)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nenhum evento próximo</p>
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
