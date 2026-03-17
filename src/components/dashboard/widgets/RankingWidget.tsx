import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-provider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { 
  Trophy, 
  Crown, 
  Star, 
  TrendingUp, 
  ChevronUp,
  ChevronDown,
  Minus,
  Target,
  Zap,
  Award,
  Users
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { logger } from '@/lib/logger'
import {
  rankingService,
  type UserPosition,
  type UserRanking,
  type UserAchievement
} from '@/services/rankingService'

interface RankingWidgetProps {
  className?: string
}

function RankingWidget({ className }: RankingWidgetProps) {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null)
  const [topRanking, setTopRanking] = useState<UserRanking[]>([])
  const [recentAchievements, setRecentAchievements] = useState<UserAchievement[]>([])

  useEffect(() => {
    const fetchRankingData = async () => {
      if (!user?.id) return

      try {
        setIsLoading(true)

        const [
          positionData,
          rankingData,
          achievementsData
        ] = await Promise.all([
          rankingService.getUserPosition(user.id),
          rankingService.getUserRanking(5),
          rankingService.getUserAchievements(user.id)
        ])

        setUserPosition(positionData)
        setTopRanking(rankingData)
        setRecentAchievements(achievementsData.slice(0, 3))
      } catch (error) {
        logger.error('Erro ao carregar dados do ranking:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRankingData()
  }, [user?.id])

  if (isLoading) {
    return (
      <Card className={cn("border-border shadow-sm", className)}><CardContent className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted/50 rounded w-1/3"></div>
          <div className="h-8 bg-muted/50 rounded w-1/2"></div>
          <div className="h-2 bg-muted/50 rounded"></div>
        </div>
      </CardContent></Card>
    )
  }

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="h-4 w-4 text-yellow-500" />
      case 2: return <Trophy className="h-4 w-4 text-muted-foreground/70" />
      case 3: return <Award className="h-4 w-4 text-amber-600" />
      default: return <span className="text-sm font-bold text-muted-foreground">#{position}</span>
    }
  }

  const getLevelInfo = (xp: number) => {
    return rankingService.calculateLevelInfo(xp)
  }

  const getProgressInfo = (xp: number) => {
    return rankingService.calculateProgressToNext(xp)
  }

  const getPositionChange = (currentPosition: number, previousPosition?: number) => {
    if (!previousPosition) return null
    const change = previousPosition - currentPosition
    if (change > 0) return { type: 'up', value: change }
    if (change < 0) return { type: 'down', value: Math.abs(change) }
    return { type: 'same', value: 0 }
  }

  return (
    <Card className={cn("border-border shadow-sm", className)}><CardContent className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Ranking</h3>
              <p className="text-sm text-muted-foreground">Sua posição atual</p>
            </div>
          </div>
          <Link to="/ranking">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
              Ver Todos
            </Button>
          </Link>
        </div>

        {/* Posição do usuário */}
        {userPosition && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={userPosition.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10">
                    {userPosition.first_name[0]}{userPosition.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-foreground">Você</div>
                  <div className="text-sm text-muted-foreground">
                    {userPosition.first_name} {userPosition.last_name}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  {getRankIcon(userPosition.rank_position)}
                  <span className="text-lg font-bold text-primary">
                    #{userPosition.rank_position}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {userPosition.total_xp} XP
                </div>
              </div>
            </div>

            {/* Progresso para próximo nível */}
            {(() => {
              const levelInfo = getLevelInfo(userPosition.total_xp)
              const progressInfo = getProgressInfo(userPosition.total_xp)

              return (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Nível {levelInfo.level} - {levelInfo.title}
                    </span>
                    <span className="text-muted-foreground">
                      {progressInfo.xpToNext} XP para próximo
                    </span>
                  </div>
                  <Progress value={progressInfo.progress} className="h-2" />
                </div>
              )
            })()}
          </div>
        )}

        {/* Top 3 do ranking */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Top 3</span>
          </div>

          {topRanking.slice(0, 3).map((user, index) => {
            const levelInfo = getLevelInfo(user.total_xp)
            const positionChange = getPositionChange(index + 1, user.rank_position)

            return (
              <div key={user.user_id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex-shrink-0">
                  {getRankIcon(index + 1)}
                </div>

                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {user.first_name[0]}{user.last_name[0]}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">
                    {user.first_name} {user.last_name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{user.total_xp} XP</span>
                    {positionChange && (
                      <div className={cn(
                        "flex items-center gap-1",
                        positionChange.type === 'up' && "text-green-500",
                        positionChange.type === 'down' && "text-red-500",
                        positionChange.type === 'same' && "text-muted-foreground"
                      )}>
                        {positionChange.type === 'up' && <ChevronUp className="h-3 w-3" />}
                        {positionChange.type === 'down' && <ChevronDown className="h-3 w-3" />}
                        {positionChange.type === 'same' && <Minus className="h-3 w-3" />}
                        {positionChange.value}
                      </div>
                    )}
                  </div>
                </div>

                <Badge variant="secondary" className="text-xs">
                  {levelInfo.title}
                </Badge>
              </div>
            )
          })}
        </div>

        {/* Conquistas recentes */}
        {recentAchievements.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Conquistas Recentes</span>
            </div>

            <div className="space-y-2">
              {recentAchievements.map((achievement) => (
                <div key={achievement.id} className="flex items-center gap-3 p-2 rounded-lg bg-gradient-to-r from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-xs">
                    🏆
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground truncate">
                      {achievement.achievement.name}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 text-yellow-500" />
                      <span>+{achievement.achievement.xp_reward} XP</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ações rápidas */}
        <div className="flex gap-2 pt-2">
          <Link to="/ranking" className="flex-1">
            <Button variant="outline" size="sm" className="w-full rounded-lg">
              <Trophy className="h-4 w-4 mr-2" />
              Ver Ranking
            </Button>
          </Link>
          <Link to="/achievements" className="flex-1">
            <Button variant="outline" size="sm" className="w-full rounded-lg">
              <Award className="h-4 w-4 mr-2" />
              Conquistas
            </Button>
          </Link>
        </div>
      </div>
    </CardContent></Card>
  )
}

export default RankingWidget
