import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-provider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageTabs } from '@/components/PageTabs'
import { AchievementsTutorial } from '@/components/achievements/AchievementsTutorial'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import {
  Award,
  Trophy,
  Star,
  Target,
  Lock,
  CheckCircle,
  TrendingUp,
  HelpCircle
} from 'lucide-react'
import {
  rankingService,
  type Achievement,
  type UserAchievement,
  type UserPosition
} from '@/services/rankingService'
import { SectionLoader } from '@/components/SectionLoader'
import { logger } from '@/lib/logger'
import { TourButton } from '@/components/TourButton'
import type { DriveStep } from 'driver.js'

const ACHIEVEMENTS_TOUR_STEPS: DriveStep[] = [
  { element: '[data-tour="achievements-stats"]', popover: { title: 'Resumo das Conquistas', description: 'Veja quantas conquistas você desbloqueou, quantas faltam, seu percentual de conclusão e o XP total acumulado.' } },
  { element: '[data-tour="achievements-tabs"]', popover: { title: 'Filtrar Conquistas', description: 'Alterne entre Desbloqueadas, Pendentes ou veja Todas de uma vez.' } },
  { element: '[data-tour="achievements-cards"]', popover: { title: 'Cards de Conquista', description: 'Cada card mostra o nome, descrição, raridade (Comum a Lendário) e a recompensa em XP. Conquistas bloqueadas aparecem com opacidade reduzida.' } },
]

export default function AchievementsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('unlocked')
  const [isLoading, setIsLoading] = useState(true)

  // Tutorial states
  const [showTutorial, setShowTutorial] = useState(false)

  // Estados para dados
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([])
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([])
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null)

  const handleTutorialComplete = () => {
    setShowTutorial(false)
  }

  useEffect(() => {
    const fetchAchievementsData = async () => {
      if (!user?.id) return

      try {
        setIsLoading(true)

        // First check and grant any new achievements the user has earned
        await rankingService.checkAndGrantAchievements(user.id).catch(() => {})

        const [
          achievementsData,
          userAchievementsData,
          positionData
        ] = await Promise.all([
          rankingService.getAchievements(),
          rankingService.getUserAchievements(user.id),
          rankingService.getUserPosition(user.id)
        ])

        setAllAchievements(achievementsData)
        setUserAchievements(userAchievementsData)
        setUserPosition(positionData)
      } catch (error) {
        logger.error('Erro ao carregar dados das conquistas:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAchievementsData()
  }, [user?.id])

  if (isLoading) {
    return <SectionLoader />
  }

  const unlockedAchievementIds = userAchievements.map(ua => ua.achievement_id)
  const unlockedAchievements = allAchievements.filter(a => unlockedAchievementIds.includes(a.id))
  const lockedAchievements = allAchievements.filter(a => !unlockedAchievementIds.includes(a.id))

  const getAchievementIcon = (name: string) => {
    const lowerName = name.toLowerCase()
    const iconMap: Record<string, string> = {
      // Marco / XP
      'primeiro login': '🎉',
      'estudante dedicado': '📚',
      'especialista': '💎',
      'mestre do conhecimento': '👑',
      'lenda': '🌟',
      // Ranking
      'top 10': '🏆',
      'top 3': '🥇',
      'número 1': '👑',
      // Streak / atividade
      'maratonista': '🏃',
      'imparável': '🔥',
      'centurião': '💯',
      // Aulas
      'primeira aula': '▶️',
      'assistiu 10 aulas': '📺',
      'assistiu 50 aulas': '🎬',
      'assistiu 100 aulas': '🏅',
      // Comentários
      'comentarista': '💬',
      'participativo': '🗣️',
      'debatedor': '🎤',
      // Avaliações
      'avaliador': '⭐',
      'crítico': '🔍',
      // Flashcards
      'flashcard iniciante': '🃏',
      'flashcard master': '🎯',
      'memória de elefante': '🐘',
      // Quizzes
      'primeiro quiz': '❓',
      'quiz champion': '⚡',
      'mestre dos quizzes': '🧠',
      // Comunidade
      'primeiro post': '✍️',
      'comunicador': '📢',
      'influencer': '🌐',
      'colaborador': '🤝',
      'popular': '❤️',
      // Simulados
      'simulado completo': '📋',
      'simulador nato': '🎯',
      // Redação
      'escritor': '✏️',
      'autor dedicado': '📝',
    }
    return iconMap[lowerName] || '🏆'
  }

  const getAchievementColor = (name: string, isUnlocked: boolean) => {
    if (!isUnlocked) return 'bg-gray-500'

    const lowerName = name.toLowerCase()
    const colorMap: Record<string, string> = {
      'primeiro login': 'bg-blue-500',
      'estudante dedicado': 'bg-green-500',
      'especialista': 'bg-purple-500',
      'mestre do conhecimento': 'bg-red-500',
      'lenda': 'bg-yellow-500',
      'top 10': 'bg-yellow-500',
      'top 3': 'bg-amber-500',
      'número 1': 'bg-orange-500',
      'maratonista': 'bg-orange-500',
      'imparável': 'bg-rose-500',
      'centurião': 'bg-red-600',
      'primeira aula': 'bg-sky-500',
      'assistiu 10 aulas': 'bg-blue-500',
      'assistiu 50 aulas': 'bg-indigo-500',
      'assistiu 100 aulas': 'bg-violet-500',
      'comentarista': 'bg-teal-500',
      'participativo': 'bg-cyan-500',
      'debatedor': 'bg-emerald-600',
      'avaliador': 'bg-amber-500',
      'crítico': 'bg-orange-600',
      'flashcard iniciante': 'bg-lime-500',
      'flashcard master': 'bg-emerald-500',
      'memória de elefante': 'bg-green-600',
      'primeiro quiz': 'bg-cyan-500',
      'quiz champion': 'bg-blue-600',
      'mestre dos quizzes': 'bg-indigo-600',
      'primeiro post': 'bg-pink-500',
      'comunicador': 'bg-rose-500',
      'influencer': 'bg-fuchsia-500',
      'colaborador': 'bg-violet-500',
      'popular': 'bg-red-500',
      'simulado completo': 'bg-slate-500',
      'simulador nato': 'bg-slate-600',
      'escritor': 'bg-amber-600',
      'autor dedicado': 'bg-yellow-600',
    }
    return colorMap[lowerName] || 'bg-primary'
  }

  const getAchievementRarity = (xpReward: number) => {
    if (xpReward >= 100) return { name: 'Lendário', color: 'bg-purple-500' }
    if (xpReward >= 50) return { name: 'Épico', color: 'bg-blue-500' }
    if (xpReward >= 25) return { name: 'Raro', color: 'bg-green-500' }
    if (xpReward >= 10) return { name: 'Incomum', color: 'bg-yellow-500' }
    return { name: 'Comum', color: 'bg-gray-500' }
  }

  const AchievementCard = ({ achievement, isUnlocked, userAchievement }: {
    achievement: Achievement
    isUnlocked: boolean
    userAchievement?: UserAchievement
  }) => {
    const rarity = getAchievementRarity(achievement.xp_reward)

    return (
      <Card
        className={cn(
          "border-border shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/30",
          isUnlocked && "ring-2 ring-primary/20",
          !isUnlocked && "opacity-60"
        )}
      >
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Header da conquista */}
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl relative",
                getAchievementColor(achievement.name, isUnlocked)
              )}>
                {isUnlocked ? (
                  getAchievementIcon(achievement.name)
                ) : (
                  <Lock className="h-5 w-5 text-white" />
                )}

                {isUnlocked && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className={cn(
                    "font-bold text-base",
                    isUnlocked ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {achievement.name}
                  </h3>
                  <Badge className={cn(
                    "text-xs text-white",
                    rarity.color
                  )}>
                    {rarity.name}
                  </Badge>
                </div>

                <p className={cn(
                  "text-sm leading-relaxed",
                  isUnlocked ? "text-muted-foreground" : "text-muted-foreground/60"
                )}>
                  {achievement.description}
                </p>
              </div>
            </div>

            {/* Informações da conquista */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">
                  {achievement.xp_reward} XP
                </span>
              </div>

              {isUnlocked && userAchievement && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Desbloqueada em</span>
                  <span className="font-medium">
                    {new Date(userAchievement.achieved_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
            </div>

          </div>
        </CardContent>
      </Card>
    )
  }

  const totalXP = userAchievements.reduce((sum, ua) => sum + (ua.achievement?.xp_reward || 0), 0)
  const completionPercentage = allAchievements.length > 0 ? (unlockedAchievements.length / allAchievements.length) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Conquistas</h1>
            <p className="text-sm text-muted-foreground mt-1">Complete desafios e desbloqueie recompensas</p>
          </div>
          <TourButton steps={ACHIEVEMENTS_TOUR_STEPS} />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTutorial(true)}
        >
          <HelpCircle className="h-4 w-4 mr-2" />
          Ajuda
        </Button>
      </div>

      {/* Stats Cards */}
      <div data-tour="achievements-stats" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-green-500/30">
          <CardContent className="p-4 text-center">
            <Trophy className="h-5 w-5 text-green-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{unlockedAchievements.length}</div>
            <div className="text-xs text-muted-foreground">Desbloqueadas</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-500/30">
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 text-blue-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{lockedAchievements.length}</div>
            <div className="text-xs text-muted-foreground">Pendentes</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-purple-500/30">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-purple-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{Math.round(completionPercentage)}%</div>
            <div className="text-xs text-muted-foreground">Completado</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-orange-500/30">
          <CardContent className="p-4 text-center">
            <Star className="h-5 w-5 text-orange-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{totalXP}</div>
            <div className="text-xs text-muted-foreground">XP Total</div>
          </CardContent>
        </Card>
      </div>

        {/* Tabs de conquistas */}
        <div data-tour="achievements-tabs">
        <PageTabs
          value={activeTab}
          onChange={setActiveTab}
          layout={3}
          tabs={[
            {
              value: 'unlocked',
              label: 'Desbloqueadas',
              icon: <CheckCircle className="h-4 w-4" />,
              count: unlockedAchievements.length,
              content: unlockedAchievements.length > 0 ? (
                <div data-tour="achievements-cards" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {unlockedAchievements.map((achievement) => {
                    const ua = userAchievements.find(u => u.achievement_id === achievement.id)
                    return (
                      <AchievementCard
                        key={achievement.id}
                        achievement={achievement}
                        isUnlocked={true}
                        userAchievement={ua}
                      />
                    )
                  })}
                </div>
              ) : (
                <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
                  <CardContent className="text-center py-16">
                    <div className="max-w-md mx-auto">
                      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Trophy className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2">
                        Nenhuma conquista desbloqueada ainda
                      </h3>
                      <p className="text-muted-foreground mb-6">
                        Continue estudando e completando atividades para desbloquear suas primeiras conquistas!
                      </p>
                      <Button
                        onClick={() => navigate('/courses')}
                      >
                        Começar a Estudar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ),
            },
            {
              value: 'locked',
              label: 'Pendentes',
              icon: <Lock className="h-4 w-4" />,
              count: lockedAchievements.length,
              content: (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {lockedAchievements.map((achievement) => (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      isUnlocked={false}
                    />
                  ))}
                </div>
              ),
            },
            {
              value: 'all',
              label: 'Todas',
              icon: <Award className="h-4 w-4" />,
              count: allAchievements.length,
              content: (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allAchievements.map((achievement) => {
                    const isUnlocked = unlockedAchievementIds.includes(achievement.id)
                    const userAchievement = userAchievements.find(ua => ua.achievement_id === achievement.id)

                    return (
                      <AchievementCard
                        key={achievement.id}
                        achievement={achievement}
                        isUnlocked={isUnlocked}
                        userAchievement={userAchievement}
                      />
                    )
                  })}
                </div>
              ),
            },
          ]}
        />
        </div>

      {/* Tutorial Modal */}
      <AchievementsTutorial
        open={showTutorial}
        onOpenChange={setShowTutorial}
        onComplete={handleTutorialComplete}
      />
    </div>
  )
}
