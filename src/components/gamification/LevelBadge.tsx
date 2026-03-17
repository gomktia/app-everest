import { useAuth } from '@/contexts/auth-provider'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { rankingService } from '@/services/rankingService'
import { useState, useEffect } from 'react'
import { Crown, Star, Trophy, Award, Target, Zap } from 'lucide-react'
import { logger } from '@/lib/logger'

interface LevelBadgeProps {
  variant?: 'compact' | 'detailed' | 'avatar'
  showProgress?: boolean
  className?: string
}

export function LevelBadge({ 
  variant = 'compact', 
  showProgress = false, 
  className 
}: LevelBadgeProps) {
  const { user } = useAuth()
  const [userPosition, setUserPosition] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchUserPosition = async () => {
      if (!user?.id) return

      try {
        const position = await rankingService.getUserPosition(user.id)
        setUserPosition(position)
      } catch (error) {
        logger.error('Erro ao carregar posição do usuário:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserPosition()
  }, [user?.id])

  if (isLoading || !userPosition) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-6 w-16 bg-muted/50 rounded-full"></div>
      </div>
    )
  }

  const levelInfo = rankingService.calculateLevelInfo(userPosition.total_xp)
  const progressInfo = rankingService.calculateProgressToNext(userPosition.total_xp)

  const getLevelIcon = (level: number) => {
    switch (level) {
      case 1: return '🥉'
      case 2: return '🥈'
      case 3: return '🥇'
      case 4: return '💎'
      case 5: return '👑'
      case 6: return '🌟'
      default: return '🏆'
    }
  }

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return 'from-gray-400 to-gray-600'
      case 2: return 'from-blue-400 to-blue-600'
      case 3: return 'from-green-400 to-green-600'
      case 4: return 'from-purple-400 to-purple-600'
      case 5: return 'from-orange-400 to-orange-600'
      case 6: return 'from-yellow-400 to-yellow-600'
      default: return 'from-primary to-primary/80'
    }
  }

  if (variant === 'avatar') {
    return (
      <div className={cn("relative", className)}>
        <Avatar className="h-10 w-10 ring-2 ring-primary/20">
          <AvatarImage src={user?.avatar_url} />
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </AvatarFallback>
        </Avatar>
        
        {/* Badge de nível no canto */}
        <div className={cn(
          "absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-bold text-white shadow-lg",
          getLevelColor(levelInfo.level)
        )}>
          {levelInfo.level}
        </div>
      </div>
    )
  }

  if (variant === 'detailed') {
    return (
      <div className={cn("space-y-3", className)}>
        {/* Header do nível */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-2xl",
            getLevelColor(levelInfo.level)
          )}>
            {getLevelIcon(levelInfo.level)}
          </div>
          <div>
            <h3 className="font-bold text-foreground">{levelInfo.title}</h3>
            <p className="text-sm text-muted-foreground">Nível {levelInfo.level}</p>
          </div>
        </div>

        {/* Progresso */}
        {showProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="text-muted-foreground">
                {progressInfo.xpToNext} XP para próximo nível
              </span>
            </div>
            <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full bg-gradient-to-r rounded-full transition-all duration-1000 ease-out",
                  getLevelColor(levelInfo.level)
                )}
                style={{ width: `${progressInfo.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold text-primary">{userPosition.total_xp}</div>
            <div className="text-xs text-muted-foreground">XP Total</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold text-primary">#{userPosition.rank_position}</div>
            <div className="text-xs text-muted-foreground">Posição</div>
          </div>
        </div>
      </div>
    )
  }

  // Variant compact (padrão)
  return (
    <Badge 
      className={cn(
        "px-3 py-1 text-sm font-medium",
        `bg-gradient-to-r ${getLevelColor(levelInfo.level)} text-white border-0`
      )}
    >
      <span className="mr-1">{getLevelIcon(levelInfo.level)}</span>
      {levelInfo.title}
    </Badge>
  )
}

// Componente para mostrar ranking rápido
export function QuickRanking({ className }: { className?: string }) {
  const { user } = useAuth()
  const [userPosition, setUserPosition] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchUserPosition = async () => {
      if (!user?.id) return

      try {
        const position = await rankingService.getUserPosition(user.id)
        setUserPosition(position)
      } catch (error) {
        logger.error('Erro ao carregar posição do usuário:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserPosition()
  }, [user?.id])

  if (isLoading || !userPosition) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-4 w-20 bg-muted/50 rounded"></div>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <Trophy className="h-4 w-4 text-yellow-500" />
      <span className="font-medium">#{userPosition.rank_position}</span>
      <span className="text-muted-foreground">•</span>
      <span className="text-muted-foreground">{userPosition.total_xp} XP</span>
    </div>
  )
}
