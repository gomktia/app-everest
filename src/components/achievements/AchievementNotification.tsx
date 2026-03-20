import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { 
  Award, 
  Star, 
  X, 
  Sparkles,
  Trophy,
  Crown,
  Target,
  Zap,
  Flame,
  Brain
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import type { UserAchievement } from '@/services/rankingService'

interface AchievementNotificationProps {
  achievement: UserAchievement
  onClose: () => void
  autoClose?: boolean
  duration?: number
}

const achievementIcons = {
  'primeiro login': '🎉',
  'estudante dedicado': '📚',
  'top 10': '🏆',
  'maratonista': '🏃',
  'especialista': '💎',
  'mestre': '👑',
  'lenda': '🌟',
  'flashcard master': '🎯',
  'quiz champion': '⚡',
  'streak master': '🔥'
}

const achievementColors = {
  'primeiro login': 'from-blue-400 to-blue-600',
  'estudante dedicado': 'from-green-400 to-green-600',
  'top 10': 'from-yellow-400 to-yellow-600',
  'maratonista': 'from-orange-400 to-orange-600',
  'especialista': 'from-purple-400 to-purple-600',
  'mestre': 'from-red-400 to-red-600',
  'lenda': 'from-pink-400 to-pink-600',
  'flashcard master': 'from-emerald-400 to-emerald-600',
  'quiz champion': 'from-cyan-400 to-cyan-600',
  'streak master': 'from-rose-400 to-rose-600'
}

export function AchievementNotification({ 
  achievement, 
  onClose, 
  autoClose = true, 
  duration = 5000 
}: AchievementNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Animação de entrada
    const showTimer = setTimeout(() => {
      setIsVisible(true)
      setIsAnimating(true)
    }, 100)

    // Auto close
    if (autoClose) {
      const closeTimer = setTimeout(() => {
        handleClose()
      }, duration)

      return () => {
        clearTimeout(showTimer)
        clearTimeout(closeTimer)
      }
    }

    return () => clearTimeout(showTimer)
  }, [autoClose, duration])

  const handleClose = () => {
    setIsAnimating(false)
    setTimeout(() => {
      setIsVisible(false)
      onClose()
    }, 300)
  }

  const getAchievementIcon = (name: string) => {
    const lowerName = name.toLowerCase()
    return achievementIcons[lowerName as keyof typeof achievementIcons] || '🏆'
  }

  const getAchievementColor = (name: string) => {
    const lowerName = name.toLowerCase()
    return achievementColors[lowerName as keyof typeof achievementColors] || 'from-primary to-primary/80'
  }

  const getAchievementGlow = (name: string) => {
    const lowerName = name.toLowerCase()
    switch (lowerName) {
      case 'lenda':
      case 'mestre':
        return 'shadow-[0_0_30px_rgba(255,215,0,0.5)]'
      case 'top 10':
      case 'especialista':
        return 'shadow-[0_0_25px_rgba(255,165,0,0.4)]'
      default:
        return 'shadow-[0_0_20px_rgba(59,130,246,0.3)]'
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      <Card
        className={cn(
          "border-border shadow-sm",
          "transform transition-all duration-500 ease-out",
          isAnimating 
            ? "translate-x-0 opacity-100 scale-100" 
            : "translate-x-full opacity-0 scale-95",
          getAchievementGlow(achievement.achievement.name)
        )}
      >
        <div className="p-6 space-y-4">
          {/* Header com botão de fechar */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center text-2xl animate-pulse",
                getAchievementColor(achievement.achievement.name)
              )}>
                {getAchievementIcon(achievement.achievement.name)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-500 animate-spin" />
                  <span className="text-sm font-medium text-muted-foreground">Nova Conquista!</span>
                </div>
                <h3 className="font-bold text-lg text-foreground">
                  {achievement.achievement.name}
                </h3>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0 hover:bg-muted/50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Descrição */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {achievement.achievement.description}
          </p>

          {/* XP ganho */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-yellow-500/10 to-yellow-600/5 border border-yellow-300">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium text-foreground">XP Ganho</span>
            </div>
            <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white">
              +{achievement.achievement.xp_reward} XP
            </Badge>
          </div>

          {/* Efeitos visuais */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-2 right-2 w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
            <div className="absolute bottom-2 left-2 w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
            <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-green-400 rounded-full animate-bounce"></div>
          </div>
        </div>
      </Card>
    </div>
  )
}

// Hook para gerenciar notificações de conquistas
export function useAchievementNotifications() {
  const [notifications, setNotifications] = useState<UserAchievement[]>([])
  const { toast } = useToast()

  const addNotification = (achievement: UserAchievement) => {
    setNotifications(prev => [...prev, achievement])
    
    // Toast adicional para garantir que o usuário veja
    toast({
      title: "🏆 Nova Conquista Desbloqueada!",
      description: `${achievement.achievement.name} - +${achievement.achievement.xp_reward} XP`,
      duration: 5000,
    })
  }

  const removeNotification = (achievementId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== achievementId))
  }

  const clearAllNotifications = () => {
    setNotifications([])
  }

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications
  }
}

// Componente para renderizar todas as notificações
export function AchievementNotificationContainer() {
  const { notifications, removeNotification } = useAchievementNotifications()

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((achievement, index) => (
        <div
          key={achievement.id}
          className="transform transition-all duration-300"
          style={{
            transform: `translateY(${index * 10}px)`,
            zIndex: 50 - index
          }}
        >
          <AchievementNotification
            achievement={achievement}
            onClose={() => removeNotification(achievement.id)}
            autoClose={true}
            duration={6000}
          />
        </div>
      ))}
    </div>
  )
}
