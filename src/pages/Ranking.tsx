import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { PageTabs } from '@/components/PageTabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Trophy,
  Crown,
  Star,
  Target,
  TrendingUp,
  Award,
  Users,
  Zap,
  Medal,
  ChevronUp,
  ChevronDown,
  Minus,

  GraduationCap,
} from 'lucide-react'
import {
  rankingService,
  type UserRanking,
  type UserPosition,
  type XPStatistics,
  type UserAchievement,
  type SubjectRanking
} from '@/services/rankingService'
import { getRankingByClass, getStudentClassIds, type RankingEntry } from '@/services/gamificationService'
import { SectionLoader } from '@/components/SectionLoader'
import { logger } from '@/lib/logger'
import { useAuth } from '@/hooks/use-auth'
import { cachedFetch } from '@/lib/offlineCache'
import { OfflineBanner } from '@/components/OfflineBanner'

export default function RankingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('turma')
  const [isLoading, setIsLoading] = useState(true)

  // Estados para dados
  const [globalRanking, setGlobalRanking] = useState<UserRanking[]>([])
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null)
  const [xpStats, setXpStats] = useState<XPStatistics | null>(null)
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([])
  const [flashcardRanking, setFlashcardRanking] = useState<SubjectRanking[]>([])
  const [quizRanking, setQuizRanking] = useState<SubjectRanking[]>([])
  const [classRanking, setClassRanking] = useState<RankingEntry[]>([])
  const [studentClasses, setStudentClasses] = useState<{ class_id: string; class_name: string }[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    const fetchRankingData = async () => {
      if (!user?.id) return

      try {
        setIsLoading(true)

        // Check and grant achievements first (only online)
        if (navigator.onLine) {
          await rankingService.checkAndGrantAchievements(user.id).catch(() => {})
        }

        const result = await cachedFetch(`ranking-${user.id}`, () =>
          Promise.all([
            rankingService.getUserRanking(50).catch(() => []),
            rankingService.getUserPosition(user.id).catch(() => null),
            rankingService.getXPStatistics().catch(() => null),
            rankingService.getUserAchievements(user.id).catch(() => []),
            rankingService.getRankingByActivity('flashcard', 20).catch(() => []),
            rankingService.getRankingByActivity('quiz', 20).catch(() => []),
            getStudentClassIds(user.id).catch(() => [])
          ])
        )

        setFromCache(result.fromCache)
        const [globalData, positionData, statsData, achievementsData, flashcardData, quizData, classesData] = result.data

        setGlobalRanking(globalData)
        setUserPosition(positionData)
        setXpStats(statsData)
        setUserAchievements(achievementsData)
        setFlashcardRanking(flashcardData)
        setQuizRanking(quizData)
        setStudentClasses(classesData)

        // Load ranking for first class
        if (classesData.length > 0) {
          setSelectedClassId(classesData[0].class_id)
          const classRankData = await getRankingByClass(classesData[0].class_id, 50)
          setClassRanking(classRankData)
        } else {
          setActiveTab('global')
        }
      } catch (error) {
        logger.error('Erro ao carregar dados do ranking:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRankingData()
  }, [user?.id])

  const handleClassChange = useCallback(async (classId: string) => {
    setSelectedClassId(classId)
    try {
      const data = await getRankingByClass(classId, 50)
      setClassRanking(data)
    } catch (error) {
      logger.error('Erro ao buscar ranking da turma:', error)
      setClassRanking([])
    }
  }, [])

  if (isLoading) {
    return <SectionLoader />
  }

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="h-6 w-6 text-yellow-500" />
      case 2: return <Medal className="h-6 w-6 text-muted-foreground/70" />
      case 3: return <Award className="h-6 w-6 text-amber-600" />
      default: return <span className="text-lg font-bold text-muted-foreground">#{position}</span>
    }
  }

  const getRankColor = (position: number) => {
    switch (position) {
      case 1: return 'bg-yellow-500'
      case 2: return 'bg-gray-400'
      case 3: return 'bg-amber-600'
      default: return 'bg-primary/15'
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

  const RankingCard = ({ user, position, showChange = false }: {
    user: UserRanking | SubjectRanking,
    position: number,
    showChange?: boolean
  }) => {
    const xp = 'total_xp' in user ? user.total_xp : (user.total_xp_general || user.total_xp_activity)
    const levelInfo = getLevelInfo(xp)
    const progressInfo = getProgressInfo(xp)
    const positionChange = showChange ? getPositionChange(position, user.rank_position) : null

    return (
      <Card
        className={cn(
          "border-border shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/30",
          position <= 3 && "ring-2 ring-primary/20"
        )}
      >
        <div className="flex items-center gap-4 p-4">
          {/* Posição */}
          <div className="flex-shrink-0">
            {getRankIcon(position)}
          </div>

          {/* Avatar iniciais */}
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {user.first_name?.[0]}{user.last_name?.[0]}
            </AvatarFallback>
          </Avatar>

          {/* Informações do usuário */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate">
                {user.first_name} {user.last_name}
              </h3>
              {position <= 3 && (
                <Badge className={cn("text-xs", `${getRankColor(position)} text-white`)}>
                  {levelInfo.title}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">{xp} XP</span>
              </div>

              {positionChange && (
                <div className={cn(
                  "flex items-center gap-1 text-xs",
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

            {/* Barra de progresso para próximo nível */}
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Nível {levelInfo.level}</span>
                <span>{progressInfo.xpToNext} XP para próximo</span>
              </div>
              <Progress
                value={progressInfo.progress}
                className="h-2"
              />
            </div>
          </div>

          {/* Badge de nível */}
          <div className="flex-shrink-0">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              getRankColor(position)
            )}>
              <Trophy className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      </Card>
    )
  }

  // Class ranking card (adapts RankingEntry to similar display)
  const ClassRankingCard = ({ entry, position }: { entry: RankingEntry; position: number }) => {
    const levelInfo = getLevelInfo(entry.total_xp)
    const progressInfo = getProgressInfo(entry.total_xp)
    const isCurrentUser = entry.user_id === user?.id

    return (
      <Card
        className={cn(
          "border-border shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/30",
          position <= 3 && "ring-2 ring-primary/20",
          isCurrentUser && "ring-2 ring-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20"
        )}
      >
        <div className="flex items-center gap-2.5 sm:gap-4 p-3 sm:p-4">
          <div className="flex-shrink-0">{getRankIcon(position)}</div>
          <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm sm:text-base">
              {entry.first_name?.[0]}{entry.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate text-sm sm:text-base">
                {entry.first_name} {entry.last_name}
                {isCurrentUser && <span className="text-xs text-blue-500 ml-1">(você)</span>}
              </h3>
              {position <= 3 && (
                <Badge className={cn("text-xs", `${getRankColor(position)} text-white`)}>
                  {levelInfo.title}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">{entry.total_xp} XP</span>
              </div>
              <div className="flex items-center gap-1">
                <Award className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-xs">{entry.achievements_count} conquistas</span>
              </div>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Nível {levelInfo.level}</span>
                <span>{progressInfo.xpToNext} XP para próximo</span>
              </div>
              <Progress value={progressInfo.progress} className="h-2" />
            </div>
          </div>
          <div className="flex-shrink-0">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-2xl",
              getRankColor(position)
            )}>
              {levelInfo.icon}
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <OfflineBanner fromCache={fromCache} />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ranking</h1>
          <p className="text-sm text-muted-foreground mt-1">Compete e evolua com outros estudantes</p>
        </div>
        {userPosition && (
          <div className="text-left md:text-right">
            <div className="text-xl font-bold text-primary">#{userPosition.rank_position}</div>
            <div className="text-xs text-muted-foreground">Sua posição</div>
          </div>
        )}
      </div>

      {/* Stats */}
      {xpStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-500/30">
            <CardContent className="p-4 text-center">
              <Users className="h-5 w-5 text-blue-500 mx-auto mb-1.5" />
              <div className="text-xl font-bold text-foreground">{xpStats.total_users}</div>
              <div className="text-xs text-muted-foreground">Estudantes</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-green-500/30">
            <CardContent className="p-4 text-center">
              <Star className="h-5 w-5 text-green-500 mx-auto mb-1.5" />
              <div className="text-xl font-bold text-foreground">{xpStats.total_xp_distributed.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">XP Total</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-purple-500/30">
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-5 w-5 text-purple-500 mx-auto mb-1.5" />
              <div className="text-xl font-bold text-foreground">{Math.round(xpStats.average_xp)}</div>
              <div className="text-xs text-muted-foreground">XP Médio</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-orange-500/30">
            <CardContent className="p-4 text-center">
              <Crown className="h-5 w-5 text-orange-500 mx-auto mb-1.5" />
              <div className="text-xl font-bold text-foreground">{xpStats.max_xp.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">XP Máximo</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs de ranking */}
      <PageTabs
        value={activeTab}
        onChange={setActiveTab}
        layout={studentClasses.length > 0 ? 4 : 3}
        tabs={[
          ...(studentClasses.length > 0 ? [{
            value: 'turma',
            label: 'Minha Turma',
            icon: <GraduationCap className="h-4 w-4" />,
            content: (
              <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Ranking da Turma</h2>
                    {studentClasses.length > 1 && (
                      <Select value={selectedClassId} onValueChange={handleClassChange}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Selecione a turma" />
                        </SelectTrigger>
                        <SelectContent>
                          {studentClasses.map((sc) => (
                            <SelectItem key={sc.class_id} value={sc.class_id}>
                              {sc.class_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {classRanking.length > 0 ? (
                    <div className="space-y-3">
                      {classRanking.map((entry, index) => (
                        <ClassRankingCard
                          key={entry.user_id}
                          entry={entry}
                          position={index + 1}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p>Nenhum dado de ranking disponível para esta turma ainda.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ),
          }] : []),
          {
            value: 'global',
            label: 'Global',
            icon: <Trophy className="h-4 w-4" />,
            content: (
              <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
                <CardContent className="p-5">
                  <h2 className="text-lg font-semibold mb-4">Ranking Global</h2>
                  {globalRanking.length > 0 ? (
                    <div className="space-y-3">
                      {globalRanking.map((user, index) => (
                        <RankingCard
                          key={user.user_id}
                          user={user}
                          position={index + 1}
                          showChange={true}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p>Nenhum dado de ranking disponível ainda.</p>
                      <p className="text-xs mt-1">Complete atividades para aparecer no ranking!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ),
          },
          {
            value: 'flashcards',
            label: 'Flashcards',
            icon: <Target className="h-4 w-4" />,
            content: (
              <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
                <CardContent className="p-5">
                  <h2 className="text-lg font-semibold mb-4">Ranking de Flashcards</h2>
                  {flashcardRanking.length > 0 ? (
                    <div className="space-y-3">
                      {flashcardRanking.map((user, index) => (
                        <RankingCard
                          key={user.user_id}
                          user={user}
                          position={index + 1}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p>Nenhum dado de ranking de flashcards disponível ainda.</p>
                      <p className="text-xs mt-1">Estude flashcards para aparecer no ranking!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ),
          },
          {
            value: 'quizzes',
            label: 'Quizzes',
            icon: <Zap className="h-4 w-4" />,
            content: (
              <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
                <CardContent className="p-5">
                  <h2 className="text-lg font-semibold mb-4">Ranking de Quizzes</h2>
                  {quizRanking.length > 0 ? (
                    <div className="space-y-3">
                      {quizRanking.map((user, index) => (
                        <RankingCard
                          key={user.user_id}
                          user={user}
                          position={index + 1}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Zap className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p>Nenhum dado de ranking de quizzes disponível ainda.</p>
                      <p className="text-xs mt-1">Complete quizzes para aparecer no ranking!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ),
          },
        ]}
      />

      {/* Seção de Conquistas */}
      {userAchievements.length > 0 && (
        <Card className="border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
          <CardContent className="p-5">
            <h2 className="text-lg font-semibold mb-4">Suas Conquistas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userAchievements.slice(0, 6).map((achievement) => (
                <div
                  key={achievement.id}
                  className="p-4 rounded-xl bg-primary/5 border border-primary/20 hover:border-primary/30 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-xl">
                      <Award className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {achievement.achievement.name}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {achievement.achievement.description}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="h-3 w-3 text-yellow-500" />
                        <span className="text-xs font-medium text-yellow-600">
                          +{achievement.achievement.xp_reward} XP
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {userAchievements.length > 6 && (
              <div className="text-center mt-4">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => navigate('/conquistas')}
                >
                  Ver Todas as Conquistas
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
