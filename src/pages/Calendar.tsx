import { useState, useEffect, useMemo } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { format, isSameDay, isAfter, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  getCalendarEvents,
  type CalendarEvent,
} from '@/services/calendarService'
import { SectionLoader } from '@/components/SectionLoader'
import { TourButton } from '@/components/TourButton'
import type { DriveStep } from 'driver.js'

import {
  Calendar as CalendarIcon,
  Clock,

  ChevronRight,
  Filter,
  Video,
  PenTool,
  Target,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const eventConfig = {
  LIVE_CLASS: {
    label: 'Mentoria',
    icon: Video,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 border-emerald-300',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-600 border-emerald-300 dark:text-emerald-400',
  },
  SIMULATION: {
    label: 'Simulado',
    icon: Target,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 border-blue-300',
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-600 border-blue-300 dark:text-blue-400',
  },
  ESSAY_DEADLINE: {
    label: 'Redação',
    icon: PenTool,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-100 border-rose-300',
    dot: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-600 border-rose-300 dark:text-rose-400',
  },
  GENERAL: {
    label: 'Geral',
    icon: Info,
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 border-slate-300',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 border-slate-300 dark:text-slate-400',
  },
}

type EventType = keyof typeof eventConfig

const CALENDAR_TOUR_STEPS: DriveStep[] = [
  {
    element: '[data-tour="calendar-widget"]',
    popover: {
      title: 'Calendário',
      description: 'Clique em uma data para ver os eventos agendados para aquele dia.',
    },
  },
  {
    element: '[data-tour="calendar-filters"]',
    popover: {
      title: 'Filtros por Tipo',
      description: 'Filtre os eventos por categoria: Mentorias, Simulados, Redações ou veja todos de uma vez.',
    },
  },
  {
    element: '[data-tour="calendar-day-events"]',
    popover: {
      title: 'Eventos do Dia',
      description: 'Aqui aparecem os detalhes dos eventos do dia selecionado, com horário e tipo.',
    },
  },
]

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<EventType | 'ALL'>('ALL')

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true)
      try {
        const fetchedEvents = await getCalendarEvents(currentMonth)
        setEvents(fetchedEvents)
      } catch {
        // silently fail
      } finally {
        setIsLoading(false)
      }
    }
    fetchEvents()
  }, [currentMonth])

  const filteredEvents = useMemo(() => {
    if (activeFilter === 'ALL') return events
    return events.filter(e => e.event_type === activeFilter)
  }, [events, activeFilter])

  const selectedDayEvents = useMemo(() => {
    if (!date) return []
    return filteredEvents.filter((event) => isSameDay(new Date(event.start_time), date))
  }, [date, filteredEvents])

  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date())
    return events
      .filter(e => isAfter(new Date(e.start_time), today))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 5)
  }, [events])

  const eventCountByType = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of events) {
      counts[e.event_type] = (counts[e.event_type] || 0) + 1
    }
    return counts
  }, [events])

  if (isLoading) {
    return <SectionLoader />
  }

  const getEventConfig = (type: string) => eventConfig[type as EventType] || eventConfig.GENERAL

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Calendário</h1>
            <p className="text-sm text-muted-foreground mt-1">Seus eventos, mentorias e simulados</p>
          </div>
          <TourButton steps={CALENDAR_TOUR_STEPS} />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarIcon className="h-4 w-4" />
          <span>{format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}</span>
        </div>
      </div>

      {/* Type Filter Pills */}
      <div className="flex flex-wrap gap-2" data-tour="calendar-filters">
        <Button
          variant={activeFilter === 'ALL' ? 'default' : 'outline'}
          size="sm"
          className="rounded-full h-8 text-xs"
          onClick={() => setActiveFilter('ALL')}
        >
          <Filter className="h-3 w-3 mr-1" />
          Todos ({events.length})
        </Button>
        {(Object.keys(eventConfig) as EventType[]).map(type => {
          const config = eventConfig[type]
          const count = eventCountByType[type] || 0
          if (count === 0) return null
          const Icon = config.icon
          return (
            <Button
              key={type}
              variant={activeFilter === type ? 'default' : 'outline'}
              size="sm"
              className={cn(
                "rounded-full h-8 text-xs",
                activeFilter !== type && config.color
              )}
              onClick={() => setActiveFilter(type)}
            >
              <Icon className="h-3 w-3 mr-1" />
              {config.label} ({count})
            </Button>
          )
        })}
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Calendar */}
        <div className="lg:col-span-3" data-tour="calendar-widget">
          <Card className="border-border shadow-sm">
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="rounded-xl mx-auto"
                locale={ptBR}
                modifiers={{
                  event: filteredEvents.map((event) => new Date(event.start_time)),
                }}
                modifiersStyles={{
                  event: {
                    fontWeight: 'bold',
                    color: 'hsl(var(--primary))',
                    backgroundColor: 'hsl(var(--primary) / 0.1)',
                    borderRadius: '8px',
                  },
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Selected Day Events */}
        <div className="lg:col-span-2" data-tour="calendar-day-events">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                {date ? format(date, "dd 'de' MMMM", { locale: ptBR }) : 'Selecione um dia'}
              </CardTitle>
              <CardDescription>
                {selectedDayEvents.length > 0
                  ? `${selectedDayEvents.length} evento${selectedDayEvents.length > 1 ? 's' : ''}`
                  : 'Nenhum evento'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {selectedDayEvents.length > 0 ? (
                  selectedDayEvents.map((event) => {
                    const config = getEventConfig(event.event_type)
                    const Icon = config.icon
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "p-3 rounded-lg border transition-colors",
                          config.bg
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn("mt-0.5", config.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm leading-tight">{event.title}</p>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(event.start_time), 'HH:mm')}
                                {event.end_time && ` - ${format(new Date(event.end_time), 'HH:mm')}`}
                              </span>
                              <Badge variant="outline" className={cn("text-[10px] h-5", config.badge)}>
                                {config.label}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-8">
                    <CalendarIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum evento neste dia</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Próximos Eventos</CardTitle>
              <span className="text-xs text-muted-foreground">Próximos 5 eventos</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {upcomingEvents.map((event, index) => {
                const config = getEventConfig(event.event_type)
                const eventDate = new Date(event.start_time)
                return (
                  <div
                    key={event.id}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer",
                      index % 2 === 1 && "bg-muted/30"
                    )}
                    onClick={() => {
                      setDate(eventDate)
                      setCurrentMonth(eventDate)
                    }}
                  >
                    <div className="text-center w-12 shrink-0">
                      <div className="text-2xl font-bold leading-none">
                        {format(eventDate, 'dd')}
                      </div>
                      <div className="text-[10px] uppercase text-muted-foreground font-medium">
                        {format(eventDate, 'MMM', { locale: ptBR })}
                      </div>
                    </div>

                    <div className={cn("w-1 h-10 rounded-full shrink-0", config.dot)} />

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{event.title}</p>
                      <span className="text-xs text-muted-foreground">
                        {format(eventDate, "EEEE", { locale: ptBR })} · {format(eventDate, 'HH:mm')}
                        {event.end_time && ` - ${format(new Date(event.end_time), 'HH:mm')}`}
                      </span>
                    </div>

                    <Badge variant="outline" className={cn("text-[10px] h-5 shrink-0", config.badge)}>
                      {config.label}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
