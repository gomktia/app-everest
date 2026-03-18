import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { useNotifications } from '@/hooks/useNotifications'
import { useToast } from '@/hooks/use-toast'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Bell,
  Check,
  X,
  BookOpen,
  Award,
  Calendar,
  MessageSquare,
  AlertCircle,
  Info,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { TourButton } from '@/components/TourButton'
import type { DriveStep } from 'driver.js'

const NOTIFICATIONS_TOUR_STEPS: DriveStep[] = [
  {
    element: '[data-tour="notif-filters"]',
    popover: {
      title: 'Filtros',
      description: 'Filtre suas notificacoes: veja todas, apenas as nao lidas ou as ja lidas.',
    },
  },
  {
    element: '[data-tour="notif-mark-all"]',
    popover: {
      title: 'Marcar Todas como Lidas',
      description: 'Clique aqui para marcar todas as notificacoes como lidas de uma vez.',
    },
  },
  {
    element: '[data-tour="notif-list"]',
    popover: {
      title: 'Suas Notificacoes',
      description: 'Aqui aparecem suas notificacoes. Use os botoes para marcar como lida ou remover.',
    },
  },
]

export default function NotificationsPage() {
  const {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications()

  const { toast } = useToast()
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')

  const filteredNotifications = useMemo(() => {
    logger.debug('Filtrando notificações:', { filter, total: notifications.length })

    const filtered = notifications.filter(notification => {
      if (filter === 'unread') return !notification.is_read
      if (filter === 'read') return notification.is_read
      return true
    })

    logger.debug('Notificações filtradas:', filtered.length)
    return filtered
  }, [notifications, filter])

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id)
    } catch {
      toast({ title: 'Erro ao marcar como lida', variant: 'destructive' })
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead()
      toast({ title: 'Todas as notificações foram marcadas como lidas' })
    } catch {
      toast({ title: 'Erro ao marcar notificações', variant: 'destructive' })
    }
  }

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteNotification(id)
      toast({ title: 'Notificação removida' })
    } catch {
      toast({ title: 'Erro ao remover notificação', variant: 'destructive' })
    }
  }

  const handleFilterChange = (newFilter: 'all' | 'unread' | 'read') => {
    logger.debug('Mudando filtro de notificações:', { de: filter, para: newFilter })
    setFilter(newFilter)
  }

  const formatNotificationTime = (createdAt: string) => {
    try {
      return formatDistanceToNow(new Date(createdAt), {
        addSuffix: true,
        locale: ptBR
      })
    } catch {
      return 'há algum tempo'
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'achievement': return Award
      case 'course': return BookOpen
      case 'reminder': return Calendar
      case 'social': return MessageSquare
      case 'system': return Info
      case 'warning': return AlertCircle
      case 'quiz': return CheckCircle
      case 'material': return BookOpen
      default: return Bell
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'achievement': return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-l-amber-500' }
      case 'course': return { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40', border: 'border-l-blue-500' }
      case 'reminder': return { text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/40', border: 'border-l-cyan-500' }
      case 'social': return { text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/40', border: 'border-l-violet-500' }
      case 'system': return { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40', border: 'border-l-emerald-500' }
      case 'warning': return { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40', border: 'border-l-orange-500' }
      case 'quiz': return { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/40', border: 'border-l-green-500' }
      case 'material': return { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/40', border: 'border-l-indigo-500' }
      default: return { text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800/40', border: 'border-l-gray-500' }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
        <TourButton steps={NOTIFICATIONS_TOUR_STEPS} />
      </div>

      <div className="space-y-6">
        {/* Header */}
        <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Bell className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Central de Notificações</h2>
                  <p className="text-muted-foreground">
                    {unreadCount > 0
                      ? `${unreadCount} notificação${unreadCount > 1 ? 'ões' : ''} não lida${unreadCount > 1 ? 's' : ''}`
                      : 'Todas as notificações foram lidas'
                    }
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleMarkAllAsRead}
                  disabled={unreadCount === 0}
                  data-tour="notif-mark-all"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Marcar todas como lidas
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200" data-tour="notif-filters">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Filtrar:</span>
              <div className="flex gap-2 flex-1">
                {[
                  { key: 'all' as const, label: 'Todas', count: notifications.length },
                  { key: 'unread' as const, label: 'Não lidas', count: unreadCount },
                  { key: 'read' as const, label: 'Lidas', count: notifications.length - unreadCount }
                ].map(({ key, label, count }) => (
                  <Button
                    key={key}
                    variant={filter === key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFilterChange(key)}
                    className={cn(
                      "flex items-center justify-center gap-2 min-w-[120px] transition-colors duration-300",
                      filter === key
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-primary/5"
                    )}
                  >
                    <span className="whitespace-nowrap">{label}</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs transition-colors duration-300 min-w-[24px] justify-center",
                        filter === key
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {count}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        <div className="space-y-4" data-tour="notif-list">
          {filteredNotifications.length === 0 ? (
            <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Bell className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhuma notificação</h3>
                <p className="text-muted-foreground">
                  {filter === 'unread'
                    ? 'Você está em dia! Todas as notificações foram lidas.'
                    : 'Não há notificações para mostrar no momento.'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredNotifications.map((notification, index) => {
              const IconComponent = getNotificationIcon(notification.type)
              const colors = getNotificationColor(notification.type)

              return (
                <Card
                  key={notification.id}
                  className={cn(
                    "border-border shadow-sm transition-all duration-300 hover:shadow-md border-l-4 overflow-hidden",
                    !notification.is_read
                      ? cn(colors.border, "bg-card ring-1 ring-primary/15")
                      : cn("border-l-transparent", index % 2 === 1 && "bg-muted/30")
                  )}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                        notification.is_read ? "bg-muted" : colors.bg
                      )}>
                        <IconComponent className={cn(
                          "h-5 w-5",
                          notification.is_read ? "text-muted-foreground" : colors.text
                        )} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className={cn(
                              "font-semibold mb-1",
                              !notification.is_read && "text-foreground"
                            )}>
                              {notification.title}
                            </h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {formatNotificationTime(notification.created_at)}
                              </span>
                              {!notification.is_read && (
                                <Badge className={cn("text-xs border-0", colors.bg, colors.text)}>
                                  Nova
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-4">
                            {!notification.is_read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="h-8 w-8 p-0 hover:bg-primary/10"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteNotification(notification.id)}
                              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
