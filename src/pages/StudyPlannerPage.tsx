import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { StudyPlannerTutorial } from '@/components/study-planner/StudyPlannerTutorial'
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Check,
  Clock,
  TrendingUp,
  BookOpen,
  PenTool,
  Brain,
  Target,
  Calendar,
  Trophy,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  AlertCircle,
  Volume2,
  VolumeX,
  Zap,

  Search,
  Filter,
  Bell,
  BellOff,
  HelpCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageTabs } from '@/components/PageTabs'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionLoader } from '@/components/SectionLoader'
import { logger } from '@/lib/logger'
import { useAuth } from '@/hooks/use-auth'
import * as studyPlannerService from '@/services/studyPlannerService'
import { PomodoroWidget } from '@/components/study-planner/PomodoroWidget'
import { cachedFetch } from '@/lib/offlineCache'
import { TourButton } from '@/components/TourButton'
import type { DriveStep } from 'driver.js'

const STUDY_PLANNER_TOUR_STEPS: DriveStep[] = [
  { element: '[data-tour="planner-stats"]', popover: { title: 'Estatísticas de Estudo', description: 'Acompanhe seus conteúdos completos, total de tópicos, pomodoros realizados e progresso geral.' } },
  { element: '[data-tour="planner-tabs"]', popover: { title: 'Abas do Plano', description: 'Alterne entre Planejamento (seus tópicos), Cronômetro Pomodoro e Histórico de estudo.' } },
  { element: '[data-tour="planner-topics"]', popover: { title: 'Lista de Tópicos', description: 'Veja e organize seus tópicos de estudo. Marque como concluído, em andamento ou pendente.' } },
  { element: '[data-tour="planner-timer"]', popover: { title: 'Cronômetro Pomodoro', description: 'Use a técnica Pomodoro: 25 min de estudo + 5 min de pausa. Controle com play, pause e reset.' } },
  { element: '[data-tour="planner-pip"]', popover: { title: 'Janela Flutuante (PiP)', description: 'Abra o timer em uma mini-janela flutuante para acompanhar o tempo enquanto navega em outras páginas.' } },
]
import { OfflineBanner } from '@/components/OfflineBanner'

type StudyTopic = {
  id: string
  title: string
  category: 'portugues' | 'redacao' | 'matematica' | 'raciocinio-logico' | 'direito-constitucional' | 'direito-administrativo' | 'direito-penal' | 'direito-civil' | 'informatica' | 'atualidades' | 'conhecimentos-gerais' | 'ingles' | 'historia' | 'geografia' | 'legislacao' | 'outros'
  type: 'teoria' | 'exercicios' | 'pratica' | 'revisao'
  status: 'pending' | 'in-progress' | 'completed'
  pomodoros: number
  user_id: string
  created_at: string
}

type PomodoroSession = {
  id: string
  topic_id?: string
  topic_title: string
  duration_minutes: number
  completed: boolean
  user_id: string
  created_at: string
}

export default function StudyPlannerPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'planner' | 'timer' | 'history'>('planner')
  const [isLoading, setIsLoading] = useState(true)

  // Tutorial states
  const [showTutorial, setShowTutorial] = useState(false)
  const [fromCache, setFromCache] = useState(false)

  // Timer states
  const [timerActive, setTimerActive] = useState(false)
  const [timerMode, setTimerMode] = useState<'study' | 'break'>('study')
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [currentTopicForTimer, setCurrentTopicForTimer] = useState('')
  const [completedPomodoros, setCompletedPomodoros] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed'>('all')

  // Screen reader announcement
  const [announcement, setAnnouncement] = useState('')

  // Audio ref for notification sound
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Topics states
  const [topics, setTopics] = useState<StudyTopic[]>([])
  const [sessions, setSessions] = useState<PomodoroSession[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTopic, setEditingTopic] = useState<StudyTopic | null>(null)
  const [newTopic, setNewTopic] = useState({
    title: '',
    category: 'portugues' as const,
    type: 'teoria' as const
  })

  const handleTutorialComplete = () => {
    setShowTutorial(false)
  }

  // Initialize audio element for notifications
  useEffect(() => {
    // Create a simple beep sound using data URI
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
    audioRef.current.volume = 0.5
  }, [])

  // Load timer state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('pomodoroTimer')
    if (savedState) {
      try {
        const state = JSON.parse(savedState)
        setTimerMode(state.timerMode || 'study')
        setTimeLeft(state.timeLeft || 25 * 60)
        setCurrentTopicForTimer(state.currentTopic || '')
        setCompletedPomodoros(state.completedPomodoros || 0)
      } catch (error) {
        logger.error('Error loading timer state:', error)
      }
    }
  }, [])

  // Save timer state to localStorage
  useEffect(() => {
    const state = {
      timerMode,
      timeLeft,
      currentTopic: currentTopicForTimer,
      completedPomodoros
    }
    localStorage.setItem('pomodoroTimer', JSON.stringify(state))
  }, [timerMode, timeLeft, currentTopicForTimer, completedPomodoros])

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true)
    }
  }, [])

  // Load data
  const loadData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const result = await cachedFetch(`study-planner-${user.id}`, () =>
        Promise.all([
          studyPlannerService.getStudyTopics(user.id),
          studyPlannerService.getPomodoroSessions(user.id, 20),
        ])
      )

      const [loadedTopics, loadedSessions] = result.data
      setTopics(loadedTopics)
      setSessions(loadedSessions)
      setFromCache(result.fromCache)
    } catch (error) {
      logger.error('Error loading study planner data:', error)
      if (error instanceof Error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
        toast({
          title: 'Erro ao carregar dados',
          description: 'Não foi possível carregar seu plano de estudos.',
          variant: 'destructive'
        })
      }
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleTimerComplete = useCallback(async () => {
    setTimerActive(false)

    if (soundEnabled) {
      playNotificationSound()
    }

    if (timerMode === 'study') {
      const newCompletedCount = completedPomodoros + 1
      setCompletedPomodoros(newCompletedCount)

      // Save pomodoro session to database
      if (user) {
        try {
          await studyPlannerService.createPomodoroSession({
            user_id: user.id,
            topic_title: currentTopicForTimer || 'Estudo geral',
            duration_minutes: 25,
            completed: true
          })

          // Reload sessions to update history
          const updatedSessions = await studyPlannerService.getPomodoroSessions(user.id, 20)
          setSessions(updatedSessions)

          // Reload topics to update pomodoro counts
          const updatedTopics = await studyPlannerService.getStudyTopics(user.id)
          setTopics(updatedTopics)

          logger.debug('✅ Pomodoro session saved successfully')
        } catch (error) {
          logger.error('Error saving pomodoro session:', error)
          toast({
            title: 'Erro ao salvar sessão',
            description: 'Não foi possível registrar a sessão do Pomodoro. Tente novamente.',
            variant: 'destructive',
          })
        }
      }

      // Determine break duration: 15min after every 4 pomodoros, 5min otherwise
      const isLongBreak = newCompletedCount % 4 === 0
      const breakDuration = isLongBreak ? 15 : 5

      const message = isLongBreak
        ? `Hora de fazer uma pausa longa de ${breakDuration} minutos! Você completou 4 pomodoros.`
        : `Hora de fazer uma pausa de ${breakDuration} minutos.`

      toast({
        title: '🎉 Pomodoro Completo!',
        description: message,
      })

      // Screen reader announcement
      setAnnouncement(`Pomodoro completo! ${message}`)

      // Desktop notification
      if (notificationsEnabled && 'Notification' in window) {
        new Notification('🎉 Pomodoro Completo!', {
          body: message,
          icon: '/logo.png'
        })
      }

      setTimerMode('break')
      setTimeLeft(breakDuration * 60)
    } else {
      const message = 'Pronto para mais um pomodoro de estudo?'
      toast({
        title: '✅ Pausa Completa!',
        description: message,
      })

      // Screen reader announcement
      setAnnouncement('Pausa completa! ' + message)

      // Desktop notification
      if (notificationsEnabled && 'Notification' in window) {
        new Notification('✅ Pausa Completa!', {
          body: message,
          icon: '/logo.png'
        })
      }

      setTimerMode('study')
      setTimeLeft(25 * 60)
    }
  }, [soundEnabled, timerMode, completedPomodoros, user, currentTopicForTimer, notificationsEnabled, toast])

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => time - 1)
      }, 1000)
    } else if (timeLeft === 0 && timerActive) {
      handleTimerComplete()
    }
    return () => clearInterval(interval)
  }, [timerActive, timeLeft, handleTimerComplete])

  const playNotificationSound = () => {
    // Use HTML Audio element for better sound quality
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(error => {
        logger.error('Error playing notification sound:', error)
      })
    }
  }

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast({
        title: 'Notificações não suportadas',
        description: 'Seu navegador não suporta notificações desktop.',
        variant: 'destructive'
      })
      return
    }

    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setNotificationsEnabled(true)
      toast({
        title: 'Notificações ativadas!',
        description: 'Você receberá notificações quando completar um pomodoro.'
      })
    } else {
      setNotificationsEnabled(false)
      toast({
        title: 'Notificações bloqueadas',
        description: 'Por favor, permita notificações nas configurações do navegador.',
        variant: 'destructive'
      })
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const resetTimer = () => {
    setTimerActive(false)
    setTimerMode('study')
    setTimeLeft(25 * 60)
    setCurrentTopicForTimer('')
    setCompletedPomodoros(0)
  }

  const addOrUpdateTopic = async () => {
    if (!newTopic.title.trim()) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha o título do conteúdo.',
        variant: 'destructive'
      })
      return
    }

    if (!user) return

    try {
      if (editingTopic) {
        // Atualizar tópico existente no banco
        const updatedTopic = await studyPlannerService.updateStudyTopic(editingTopic.id, newTopic)
        setTopics(topics.map(t => t.id === editingTopic.id ? updatedTopic : t))
        toast({
          title: '✅ Conteúdo atualizado!',
          description: 'Suas alterações foram salvas.'
        })
      } else {
        // Criar novo tópico no banco
        const topicData = {
          ...newTopic,
          status: 'pending' as const,
          pomodoros: 0,
          user_id: user.id
        }
        const createdTopic = await studyPlannerService.createStudyTopic(topicData)
        setTopics([...topics, createdTopic])
        toast({
          title: '✅ Conteúdo adicionado!',
          description: 'Novo tópico de estudo criado com sucesso.'
        })
      }

      setNewTopic({ title: '', category: 'portugues', type: 'teoria' })
      setEditingTopic(null)
      setShowAddModal(false)
    } catch (error) {
      logger.error('Error saving topic:', error)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o tópico. Tente novamente.',
        variant: 'destructive'
      })
    }
  }

  const deleteTopic = async (id: string) => {
    // Add confirmation dialog
    if (!confirm('Tem certeza que deseja excluir este conteúdo? Esta ação não pode ser desfeita.')) {
      return
    }

    try {
      await studyPlannerService.deleteStudyTopic(id)
      setTopics(topics.filter(t => t.id !== id))
      toast({
        title: 'Conteúdo removido',
        description: 'O tópico foi excluído do seu planejamento.'
      })
    } catch (error) {
      logger.error('Error deleting topic:', error)
      toast({
        title: 'Erro ao deletar',
        description: 'Não foi possível deletar o tópico. Tente novamente.',
        variant: 'destructive'
      })
    }
  }

  const updateTopicStatus = async (id: string, status: StudyTopic['status']) => {
    try {
      await studyPlannerService.updateStudyTopic(id, { status })
      setTopics(topics.map(t => t.id === id ? { ...t, status } : t))
    } catch (error) {
      logger.error('Error updating topic status:', error)
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o status. Tente novamente.',
        variant: 'destructive'
      })
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'portugues': return <BookOpen className="w-5 h-5" />
      case 'redacao': return <PenTool className="w-5 h-5" />
      case 'matematica': return <Target className="w-5 h-5" />
      case 'raciocinio-logico': return <Brain className="w-5 h-5" />
      case 'direito-constitucional': return <Trophy className="w-5 h-5" />
      case 'direito-administrativo': return <Trophy className="w-5 h-5" />
      case 'direito-penal': return <Trophy className="w-5 h-5" />
      case 'direito-civil': return <Trophy className="w-5 h-5" />
      case 'informatica': return <Zap className="w-5 h-5" />
      case 'atualidades': return <TrendingUp className="w-5 h-5" />
      case 'conhecimentos-gerais': return <Brain className="w-5 h-5" />
      case 'ingles': return <BookOpen className="w-5 h-5" />
      case 'historia': return <BookOpen className="w-5 h-5" />
      case 'geografia': return <Target className="w-5 h-5" />
      case 'legislacao': return <CheckCircle className="w-5 h-5" />
      default: return <Target className="w-5 h-5" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'portugues': return 'blue'
      case 'redacao': return 'purple'
      case 'matematica': return 'orange'
      case 'raciocinio-logico': return 'cyan'
      case 'direito-constitucional': return 'green'
      case 'direito-administrativo': return 'emerald'
      case 'direito-penal': return 'red'
      case 'direito-civil': return 'indigo'
      case 'informatica': return 'yellow'
      case 'atualidades': return 'pink'
      case 'conhecimentos-gerais': return 'violet'
      case 'ingles': return 'sky'
      case 'historia': return 'amber'
      case 'geografia': return 'teal'
      case 'legislacao': return 'lime'
      default: return 'gray'
    }
  }

  // Memoized filtered topics based on search and status filter
  const filteredTopics = useMemo(() => {
    let filtered = topics

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(topic =>
        topic.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(topic => topic.status === statusFilter)
    }

    return filtered
  }, [topics, searchTerm, statusFilter])

  const completedTopics = topics.filter(t => t.status === 'completed').length
  const totalPomodoros = topics.reduce((acc, t) => acc + t.pomodoros, 0)
  const progressPercentage = topics.length > 0 ? Math.round((completedTopics / topics.length) * 100) : 0

  // Memoized topics grouped by category for performance
  const topicsByCategory = useMemo(() => ({
    portugues: filteredTopics.filter(t => t.category === 'portugues'),
    redacao: filteredTopics.filter(t => t.category === 'redacao'),
    matematica: filteredTopics.filter(t => t.category === 'matematica'),
    'raciocinio-logico': filteredTopics.filter(t => t.category === 'raciocinio-logico'),
    'direito-constitucional': filteredTopics.filter(t => t.category === 'direito-constitucional'),
    'direito-administrativo': filteredTopics.filter(t => t.category === 'direito-administrativo'),
    'direito-penal': filteredTopics.filter(t => t.category === 'direito-penal'),
    'direito-civil': filteredTopics.filter(t => t.category === 'direito-civil'),
    informatica: filteredTopics.filter(t => t.category === 'informatica'),
    atualidades: filteredTopics.filter(t => t.category === 'atualidades'),
    'conhecimentos-gerais': filteredTopics.filter(t => t.category === 'conhecimentos-gerais'),
    ingles: filteredTopics.filter(t => t.category === 'ingles'),
    historia: filteredTopics.filter(t => t.category === 'historia'),
    geografia: filteredTopics.filter(t => t.category === 'geografia'),
    legislacao: filteredTopics.filter(t => t.category === 'legislacao'),
    outros: filteredTopics.filter(t => t.category === 'outros')
  }), [filteredTopics])

  if (isLoading) {
    return <SectionLoader />
  }

  return (
    <div className="space-y-6">
      <OfflineBanner fromCache={fromCache} />
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Plano de Estudos</h1>
          <p className="text-sm text-muted-foreground mt-1">Organize seus estudos com a técnica Pomodoro</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <TourButton steps={STUDY_PLANNER_TOUR_STEPS} />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowTutorial(true)}
            className="hover:bg-primary/10 hover:text-primary hover:border-primary/30"
            aria-label="Ver tutorial do plano de estudos"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
          <Button
            onClick={() => { setEditingTopic(null); setShowAddModal(true); }}
            className="flex-1 md:flex-none hover:bg-green-600"
            aria-label="Adicionar novo conteúdo de estudo"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Conteúdo
          </Button>
        </div>
      </div>
      {/* Screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">

        {/* Stats */}
        <Card data-tour="planner-stats" className="border-border shadow-sm">
          <CardContent className="pt-6">
          <div className="space-y-6">

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
                <CardContent className="p-4">
                  <div className="p-2 rounded-lg w-fit mb-3 bg-emerald-500/10">
                    <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{completedTopics}</div>
                  <div className="text-xs text-muted-foreground mt-1">Conteúdos Completos</div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
                <CardContent className="p-4">
                  <div className="p-2 rounded-lg w-fit mb-3 bg-blue-500/10">
                    <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{topics.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total de Tópicos</div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
                <CardContent className="p-4">
                  <div className="p-2 rounded-lg w-fit mb-3 bg-violet-500/10">
                    <Clock className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{totalPomodoros}</div>
                  <div className="text-xs text-muted-foreground mt-1">Pomodoros Feitos</div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
                <CardContent className="p-4">
                  <div className="p-2 rounded-lg w-fit mb-3 bg-amber-500/10">
                    <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{progressPercentage}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Progresso Geral</div>
                </CardContent>
              </Card>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso total</span>
                <span className="font-medium">{completedTopics} de {topics.length} concluídos</span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
            </div>
          </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div data-tour="planner-tabs">
        <PageTabs
          value={activeTab}
          onChange={(v) => setActiveTab(v as 'planner' | 'timer' | 'history')}
          tabs={[
            {
              value: 'planner',
              label: 'Planejamento',
              icon: <Calendar className="h-4 w-4" />,
              content: (
                <div className="space-y-6">
                  {/* Search and Filter Bar */}
                  <Card className="border-border shadow-sm">
                    <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar conteúdos..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                          aria-label="Buscar conteúdos de estudo"
                        />
                      </div>
                      <Select
                        value={statusFilter}
                        onValueChange={(value: any) => setStatusFilter(value)}
                      >
                        <SelectTrigger className="w-full md:w-48" aria-label="Filtrar por status">
                          <Filter className="mr-2 h-4 w-4" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="pending">Pendentes</SelectItem>
                          <SelectItem value="in-progress">Em Progresso</SelectItem>
                          <SelectItem value="completed">Completos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    </CardContent>
                  </Card>

                  {/* Content */}
                  {topics.length === 0 ? (
                    <Card className="border-border shadow-sm">
                      <CardContent className="text-center py-24">
                      <div className="max-w-md mx-auto">
                        <div className="w-20 h-20 mx-auto mb-8 rounded-3xl bg-primary/10 flex items-center justify-center">
                          <BookOpen className="w-10 h-10 text-primary" />
                        </div>
                        <h3 className="text-2xl font-bold text-foreground mb-4">
                          Nenhum conteúdo adicionado
                        </h3>
                        <p className="text-muted-foreground mb-8">
                          Comece adicionando conteúdos de estudo ao seu planejamento. Organize seus tópicos por matéria e acompanhe seu progresso!
                        </p>
                        <Button
                          onClick={() => { setEditingTopic(null); setShowAddModal(true); }}
                          className="hover:bg-green-600"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar Primeiro Conteúdo
                        </Button>
                      </div>
                      </CardContent>
                    </Card>
                  ) : filteredTopics.length === 0 ? (
                    <Card className="border-border shadow-sm">
                      <CardContent className="text-center py-16">
                      <div className="max-w-md mx-auto">
                        <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <h3 className="text-xl font-semibold mb-2">Nenhum resultado encontrado</h3>
                        <p className="text-muted-foreground mb-4">
                          Não encontramos conteúdos com os filtros aplicados. Tente ajustar sua busca.
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSearchTerm('')
                            setStatusFilter('all')
                          }}
                        >
                          Limpar Filtros
                        </Button>
                      </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div data-tour="planner-topics" className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                      {Object.entries(topicsByCategory).map(([key, categoryTopics]) => {
                        if (categoryTopics.length === 0) return null

                        const categoryNames: Record<string, string> = {
                          'portugues': 'Português',
                          'redacao': 'Redação',
                          'matematica': 'Matemática',
                          'raciocinio-logico': 'Raciocínio Lógico',
                          'direito-constitucional': 'Direito Constitucional',
                          'direito-administrativo': 'Direito Administrativo',
                          'direito-penal': 'Direito Penal',
                          'direito-civil': 'Direito Civil',
                          'informatica': 'Informática',
                          'atualidades': 'Atualidades',
                          'conhecimentos-gerais': 'Conhecimentos Gerais',
                          'ingles': 'Inglês',
                          'historia': 'História',
                          'geografia': 'Geografia',
                          'legislacao': 'Legislação',
                          'outros': 'Outros'
                        }

                        return (
                          <CategoryCard
                            key={key}
                            title={categoryNames[key] || key}
                            icon={getCategoryIcon(key)}
                            color={getCategoryColor(key)}
                            topics={categoryTopics}
                            onAddTopic={() => {
                              setNewTopic({ ...newTopic, category: key as any })
                              setShowAddModal(true)
                            }}
                            onUpdateStatus={updateTopicStatus}
                            onEdit={(topic) => {
                              setEditingTopic(topic)
                              setNewTopic({
                                title: topic.title,
                                category: topic.category,
                                type: topic.type
                              })
                              setShowAddModal(true)
                            }}
                            onDelete={deleteTopic}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              ),
            },
            {
              value: 'timer',
              label: 'Cronômetro Pomodoro',
              icon: <Clock className="h-4 w-4" />,
              content: (
                <PomodoroTimer
                  timerActive={timerActive}
                  timerMode={timerMode}
                  timeLeft={timeLeft}
                  currentTopic={currentTopicForTimer}
                  completedPomodoros={completedPomodoros}
                  soundEnabled={soundEnabled}
                  notificationsEnabled={notificationsEnabled}
                  onToggleTimer={() => setTimerActive(!timerActive)}
                  onResetTimer={resetTimer}
                  onTopicChange={setCurrentTopicForTimer}
                  onToggleSound={() => setSoundEnabled(!soundEnabled)}
                  onRequestNotifications={requestNotificationPermission}
                  formatTime={formatTime}
                />
              ),
            },
            {
              value: 'history',
              label: 'Histórico',
              icon: <Trophy className="h-4 w-4" />,
              content: (
                <StudyHistory
                  totalPomodoros={totalPomodoros}
                  completedTopics={completedTopics}
                  sessions={sessions}
                />
              ),
            },
          ]}
        />
        </div>

      </div>

      {/* Add/Edit Modal */}
      <ResponsiveDialog open={showAddModal} onOpenChange={setShowAddModal}>
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {editingTopic ? 'Editar Conteúdo' : 'Adicionar Novo Conteúdo'}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Adicione um novo tópico ao seu plano de estudos
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título do Conteúdo</Label>
              <Input
                id="title"
                value={newTopic.title}
                onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
                placeholder="Ex: Crase, Vírgula, Argumentação..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Matéria</Label>
              <Select
                value={newTopic.category}
                onValueChange={(value: any) => setNewTopic({ ...newTopic, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="portugues">📘 Português</SelectItem>
                  <SelectItem value="redacao">📝 Redação</SelectItem>
                  <SelectItem value="matematica">🔢 Matemática</SelectItem>
                  <SelectItem value="raciocinio-logico">🧩 Raciocínio Lógico</SelectItem>
                  <SelectItem value="direito-constitucional">⚖️ Direito Constitucional</SelectItem>
                  <SelectItem value="direito-administrativo">🏛️ Direito Administrativo</SelectItem>
                  <SelectItem value="direito-penal">⚔️ Direito Penal</SelectItem>
                  <SelectItem value="direito-civil">📋 Direito Civil</SelectItem>
                  <SelectItem value="informatica">💻 Informática</SelectItem>
                  <SelectItem value="atualidades">📰 Atualidades</SelectItem>
                  <SelectItem value="conhecimentos-gerais">🌍 Conhecimentos Gerais</SelectItem>
                  <SelectItem value="ingles">🇬🇧 Inglês</SelectItem>
                  <SelectItem value="historia">📜 História</SelectItem>
                  <SelectItem value="geografia">🗺️ Geografia</SelectItem>
                  <SelectItem value="legislacao">📚 Legislação</SelectItem>
                  <SelectItem value="outros">📌 Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Estudo</Label>
              <Select
                value={newTopic.type}
                onValueChange={(value: any) => setNewTopic({ ...newTopic, type: value })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teoria">Teoria</SelectItem>
                  <SelectItem value="exercicios">Exercícios</SelectItem>
                  <SelectItem value="pratica">Prática</SelectItem>
                  <SelectItem value="revisao">Revisão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <Button
              onClick={addOrUpdateTopic}
              className="flex-1"
              aria-label={editingTopic ? 'Salvar alterações no conteúdo' : 'Adicionar novo conteúdo'}
            >
              {editingTopic ? 'Salvar Alterações' : 'Adicionar'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false)
                setEditingTopic(null)
                setNewTopic({ title: '', category: 'portugues', type: 'teoria' })
              }}
              className="flex-1"
              aria-label="Cancelar e fechar modal"
            >
              Cancelar
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Tutorial Modal */}
      <StudyPlannerTutorial
        open={showTutorial}
        onOpenChange={setShowTutorial}
        onComplete={handleTutorialComplete}
      />
    </div>
  )
}

// Component for category cards
function CategoryCard({
  title,
  icon,
  color,
  topics,
  onAddTopic,
  onUpdateStatus,
  onEdit,
  onDelete
}: {
  title: string
  icon: React.ReactNode
  color: string
  topics: StudyTopic[]
  onAddTopic: () => void
  onUpdateStatus: (id: string, status: StudyTopic['status']) => void
  onEdit: (topic: StudyTopic) => void
  onDelete: (id: string) => void
}) {
  const completedCount = topics.filter(t => t.status === 'completed').length

  const colorClasses = {
    icon: {
      'blue': "bg-blue-100 dark:bg-blue-950/30 text-blue-600",
      'purple': "bg-purple-100 dark:bg-purple-950/30 text-purple-600",
      'orange': "bg-orange-100 dark:bg-orange-950/30 text-orange-600",
      'cyan': "bg-cyan-100 dark:bg-cyan-950/30 text-cyan-600",
      'green': "bg-green-100 dark:bg-green-950/30 text-green-600",
      'emerald': "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600",
      'red': "bg-red-100 dark:bg-red-950/30 text-red-600",
      'indigo': "bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600",
      'yellow': "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-600",
      'pink': "bg-pink-100 dark:bg-pink-950/30 text-pink-600",
      'violet': "bg-violet-100 dark:bg-violet-950/30 text-violet-600",
      'sky': "bg-sky-100 dark:bg-sky-950/30 text-sky-600",
      'amber': "bg-amber-100 dark:bg-amber-950/30 text-amber-600",
      'teal': "bg-teal-100 dark:bg-teal-950/30 text-teal-600",
      'lime': "bg-lime-100 dark:bg-lime-950/30 text-lime-600",
      'gray': "bg-muted dark:bg-gray-950/30 text-muted-foreground"
    },
    hover: {
      'blue': "hover:bg-blue-50 dark:hover:bg-blue-950/20",
      'purple': "hover:bg-purple-50 dark:hover:bg-purple-950/20",
      'orange': "hover:bg-orange-50 dark:hover:bg-orange-950/20",
      'cyan': "hover:bg-cyan-50 dark:hover:bg-cyan-950/20",
      'green': "hover:bg-green-50 dark:hover:bg-green-950/20",
      'emerald': "hover:bg-emerald-50 dark:hover:bg-emerald-950/20",
      'red': "hover:bg-red-50 dark:hover:bg-red-950/20",
      'indigo': "hover:bg-indigo-50 dark:hover:bg-indigo-950/20",
      'yellow': "hover:bg-yellow-50 dark:hover:bg-yellow-950/20",
      'pink': "hover:bg-pink-50 dark:hover:bg-pink-950/20",
      'violet': "hover:bg-violet-50 dark:hover:bg-violet-950/20",
      'sky': "hover:bg-sky-50 dark:hover:bg-sky-950/20",
      'amber': "hover:bg-amber-50 dark:hover:bg-amber-950/20",
      'teal': "hover:bg-teal-50 dark:hover:bg-teal-950/20",
      'lime': "hover:bg-lime-50 dark:hover:bg-lime-950/20",
      'gray': "hover:bg-muted/50 dark:hover:bg-gray-950/20"
    }
  }

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="pt-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              colorClasses.icon[color as keyof typeof colorClasses.icon]
            )}>
              {icon}
            </div>
            <div>
              <h2 className="text-xl font-bold">{title}</h2>
              <p className="text-sm text-muted-foreground">
                {completedCount} de {topics.length} completos
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onAddTopic}
            className={cn(
              colorClasses.hover[color as keyof typeof colorClasses.hover]
            )}
            aria-label={`Adicionar conteúdo em ${title}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
          {topics.map(topic => (
            <TopicCard
              key={topic.id}
              topic={topic}
              onUpdateStatus={onUpdateStatus}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
      </CardContent>
    </Card>
  )
}

// Component for topic cards
function TopicCard({
  topic,
  onUpdateStatus,
  onEdit,
  onDelete
}: {
  topic: StudyTopic
  onUpdateStatus: (id: string, status: StudyTopic['status']) => void
  onEdit: (topic: StudyTopic) => void
  onDelete: (id: string) => void
}) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border-2 transition-colors duration-300",
        topic.status === 'completed' && "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
        topic.status === 'in-progress' && "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800",
        topic.status === 'pending' && "bg-muted/50 dark:bg-gray-950/20 border-border dark:border-gray-800"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold mb-2 truncate">{topic.title}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {topic.type}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {topic.pomodoros} pomodoros
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          {topic.status !== 'completed' && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onUpdateStatus(
                topic.id,
                topic.status === 'pending' ? 'in-progress' : 'completed'
              )}
              className={cn(
                "w-8 h-8",
                topic.status === 'in-progress'
                  ? "text-green-600 hover:bg-green-100 dark:hover:bg-green-950/20"
                  : "text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-950/20"
              )}
              aria-label={
                topic.status === 'in-progress'
                  ? `Marcar "${topic.title}" como completo`
                  : `Iniciar estudo de "${topic.title}"`
              }
            >
              {topic.status === 'in-progress' ? <Check className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onEdit(topic)}
            className="w-8 h-8"
            aria-label={`Editar "${topic.title}"`}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(topic.id)}
            className="w-8 h-8 text-red-600 hover:bg-red-100 dark:hover:bg-red-950/20"
            aria-label={`Excluir "${topic.title}"`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Pomodoro Timer Component
function PomodoroTimer({
  timerActive,
  timerMode,
  timeLeft,
  currentTopic,
  completedPomodoros,
  soundEnabled,
  notificationsEnabled,
  onToggleTimer,
  onResetTimer,
  onTopicChange,
  onToggleSound,
  onRequestNotifications,
  formatTime
}: {
  timerActive: boolean
  timerMode: 'study' | 'break'
  timeLeft: number
  currentTopic: string
  completedPomodoros: number
  soundEnabled: boolean
  notificationsEnabled: boolean
  onToggleTimer: () => void
  onResetTimer: () => void
  onTopicChange: (topic: string) => void
  onToggleSound: () => void
  onRequestNotifications: () => void
  formatTime: (seconds: number) => string
}) {
  // Calculate progress percentage
  const totalTime = timerMode === 'study' ? 25 * 60 : (completedPomodoros % 4 === 0 && completedPomodoros > 0 ? 15 : 5) * 60
  const progress = ((totalTime - timeLeft) / totalTime) * 100

  return (
    <Card data-tour="planner-timer" className="border-border shadow-sm max-w-3xl mx-auto">
      <CardContent className="pt-6">
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Zap className={cn(
              "w-6 h-6",
              timerMode === 'study' ? "text-primary animate-pulse" : "text-green-500"
            )} />
            <h2 className="text-2xl md:text-3xl font-bold">
              {timerMode === 'study' ? '⏱️ Tempo de Estudo' : '☕ Tempo de Pausa'}
            </h2>
          </div>
          <p className="text-muted-foreground">
            Técnica Pomodoro: 25min estudo / 5min pausa
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">
              {completedPomodoros} pomodoros completados hoje
            </span>
          </div>
        </div>

        <div className={cn(
          "text-center p-8 md:p-12 rounded-2xl transition-colors",
          timerMode === 'study'
            ? "bg-primary/5"
            : "bg-green-500/5"
        )}>
          <div className={cn(
            "text-6xl md:text-8xl font-bold mb-4 transition-colors",
            timerMode === 'study' ? "text-primary" : "text-green-600"
          )}
          aria-label={`Tempo restante: ${formatTime(timeLeft)}`}
          >
            {formatTime(timeLeft)}
          </div>

          {/* Visual Progress Bar */}
          <div className="max-w-md mx-auto mb-4">
            <Progress
              value={progress}
              className={cn(
                "h-2",
                timerMode === 'study' ? "bg-primary/20" : "bg-green-500/20"
              )}
              aria-label={`Progresso do ${timerMode === 'study' ? 'pomodoro' : 'intervalo'}: ${Math.round(progress)}%`}
            />
          </div>

          <Badge
            variant="outline"
            className={cn(
              "text-sm px-4 py-2",
              timerMode === 'study'
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-green-500/10 text-green-600 border-green-500/30"
            )}
          >
            {timerMode === 'study' ? '🎯 Foco total!' : '😌 Relaxe um pouco'}
          </Badge>
        </div>

        {timerMode === 'study' && (
          <div className="space-y-2">
            <Label htmlFor="currentTopic">
              O que você está estudando agora?
            </Label>
            <Input
              id="currentTopic"
              value={currentTopic}
              onChange={(e) => onTopicChange(e.target.value)}
              placeholder="Ex: Sintaxe - Período Composto"
              className="text-lg"
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={onToggleTimer}
            size="lg"
            className={cn(
              "flex-1 font-semibold shadow-lg",
              timerMode === 'study'
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-green-600 hover:bg-green-700 text-white"
            )}
            aria-label={timerActive ? 'Pausar cronômetro' : 'Iniciar cronômetro'}
          >
            {timerActive ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
            {timerActive ? 'Pausar' : 'Iniciar'}
          </Button>

          <Button
            onClick={onResetTimer}
            variant="outline"
            size="lg"
            className="flex-1 sm:flex-none"
            aria-label="Resetar cronômetro"
          >
            <RotateCcw className="mr-2 h-5 w-5" />
            Resetar
          </Button>

          <Button
            onClick={onToggleSound}
            variant="outline"
            size="lg"
            className="sm:w-auto"
            aria-label={soundEnabled ? 'Desativar som' : 'Ativar som'}
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>

          <Button
            onClick={onRequestNotifications}
            variant="outline"
            size="lg"
            className="sm:w-auto"
            aria-label={notificationsEnabled ? 'Notificações ativadas' : 'Ativar notificações'}
          >
            {notificationsEnabled ? <Bell className="h-5 w-5 text-green-600" /> : <BellOff className="h-5 w-5" />}
          </Button>

          <span data-tour="planner-pip">
          <PomodoroWidget
            timerActive={timerActive}
            timerMode={timerMode}
            timeLeft={timeLeft}
            currentTopic={currentTopic}
            completedPomodoros={completedPomodoros}
            onToggleTimer={onToggleTimer}
            onResetTimer={onResetTimer}
            formatTime={formatTime}
          />
          </span>
        </div>
      </div>
      </CardContent>
    </Card>
  )
}

// Study History Component
function StudyHistory({
  totalPomodoros,
  completedTopics,
  sessions
}: {
  totalPomodoros: number
  completedTopics: number
  sessions: PomodoroSession[]
}) {
  // Generate last 7 days data for graph
  const last7DaysData = useMemo(() => {
    const days = []
    const today = new Date()

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' })
      const dayNumber = date.getDate()

      // Count pomodoros for this day
      const pomodoros = sessions.filter(session => {
        const sessionDate = new Date(session.created_at)
        return sessionDate >= date && sessionDate < nextDate && session.completed
      }).length

      days.push({
        day: dayName,
        date: dayNumber,
        pomodoros
      })
    }

    return days
  }, [sessions])

  const maxPomodoros = Math.max(...last7DaysData.map(d => d.pomodoros), 1)

  // Get last 10 sessions
  const recentSessions = sessions.slice(0, 10)

  return (
    <div className="space-y-6">
      <Card className="border-border shadow-sm">
        <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">Histórico de Estudos</h2>
              <p className="text-muted-foreground">Acompanhe sua evolução</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
              <CardContent className="p-4 text-center">
                <div className="p-2 rounded-lg w-fit mb-3 mx-auto bg-violet-500/10">
                  <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <p className="text-3xl font-bold text-foreground mb-1">{totalPomodoros}</p>
                <p className="text-xs text-muted-foreground">Total de Pomodoros</p>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
              <CardContent className="p-4 text-center">
                <div className="p-2 rounded-lg w-fit mb-3 mx-auto bg-emerald-500/10">
                  <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-3xl font-bold text-foreground mb-1">{completedTopics}</p>
                <p className="text-xs text-muted-foreground">Conteúdos Concluídos</p>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
              <CardContent className="p-4 text-center">
                <div className="p-2 rounded-lg w-fit mb-3 mx-auto bg-amber-500/10">
                  <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-3xl font-bold text-foreground mb-1">{totalPomodoros * 25}</p>
                <p className="text-xs text-muted-foreground">Minutos Estudados</p>
              </CardContent>
            </Card>
          </div>
        </div>
        </CardContent>
      </Card>

      {/* Pomodoros Graph - Last 7 Days */}
      <Card className="border-border shadow-sm">
        <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Últimos 7 Dias</h3>
            <Badge variant="outline" className="text-xs">
              {last7DaysData.reduce((sum, d) => sum + d.pomodoros, 0)} pomodoros
            </Badge>
          </div>

          <div className="flex items-end justify-between gap-2 h-48 px-2">
            {last7DaysData.map((data, index) => {
              const height = maxPomodoros > 0 ? (data.pomodoros / maxPomodoros) * 100 : 0

              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center justify-end flex-1">
                    {data.pomodoros > 0 && (
                      <span className="text-xs font-semibold text-primary mb-1">
                        {data.pomodoros}
                      </span>
                    )}
                    <div
                      className="w-full bg-primary rounded-t-lg transition-colors duration-500 hover:bg-primary/90"
                      style={{ height: `${height}%`, minHeight: data.pomodoros > 0 ? '8px' : '0' }}
                      title={`${data.pomodoros} pomodoros em ${data.day} ${data.date}`}
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-medium">{data.day}</div>
                    <div className="text-xs text-muted-foreground">{data.date}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        </CardContent>
      </Card>

      {/* Recent Sessions List */}
      <Card className="border-border shadow-sm">
        <CardContent className="pt-6">
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Sessões Recentes</h3>

          {recentSessions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">
                Nenhuma sessão de estudo registrada ainda. Complete um pomodoro para ver seu histórico!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((session, index) => {
                const date = new Date(session.created_at)
                const dateStr = date.toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })

                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        session.completed
                          ? "bg-green-100 dark:bg-green-950/30 text-green-600"
                          : "bg-muted dark:bg-gray-950/30 text-muted-foreground"
                      )}>
                        {session.completed ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{session.topic_title}</p>
                        <p className="text-sm text-muted-foreground">{dateStr}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="secondary" className="text-xs">
                        {session.duration_minutes} min
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        </CardContent>
      </Card>
    </div>
  )
}

