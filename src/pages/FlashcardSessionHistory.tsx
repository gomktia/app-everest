import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, Calendar, TrendingUp, BookOpen, Clock, Target, Zap, Star } from 'lucide-react'
import { getFlashcardSessionHistory, type FlashcardSession } from '@/services/flashcardService'
import { SectionLoader } from '@/components/SectionLoader'
import { Progress } from '@/components/ui/progress'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

const getModeDetails = (mode: string) => {
  switch (mode) {
    case 'full':
      return { name: 'Sessão Completa', icon: BookOpen, color: 'bg-blue-100 text-blue-600 border-blue-300' }
    case 'difficult_review':
      return { name: 'Revisão Difíceis', icon: Target, color: 'bg-red-100 text-red-600 border-red-300' }
    case 'lightning':
      return { name: 'Relâmpago', icon: Zap, color: 'bg-yellow-100 text-yellow-600 border-yellow-300' }
    case 'test':
      return { name: 'Modo Teste', icon: Clock, color: 'bg-purple-100 text-purple-600 border-purple-300' }
    case 'free':
      return { name: 'Estudo Livre', icon: Star, color: 'bg-green-100 text-green-600 border-green-300' }
    default:
      return { name: mode, icon: BookOpen, color: 'bg-muted/50 text-muted-foreground border-border' }
  }
}

const getPerformanceColor = (percentage: number) => {
  if (percentage >= 90) return 'text-purple-500'
  if (percentage >= 80) return 'text-green-500'
  if (percentage >= 70) return 'text-blue-500'
  if (percentage >= 60) return 'text-yellow-500'
  return 'text-red-500'
}

export default function FlashcardSessionHistoryPage() {
  const { user } = useAuth()
  const [history, setHistory] = useState<FlashcardSession[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    getFlashcardSessionHistory(user.id)
      .then((data) => setHistory(data))
      .catch((error) => logger.error('Error loading history:', error))
      .finally(() => setIsLoading(false))
  }, [user?.id])

  if (isLoading) return <SectionLoader />

  const totalSessions = history.length
  const totalCards = history.reduce((sum, s) => sum + s.totalCards, 0)
  const totalCorrect = history.reduce((sum, s) => sum + s.correct, 0)
  const averageAccuracy = totalCards > 0 ? Math.round((totalCorrect / totalCards) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Histórico de Sessões</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe seu progresso em todas as sessões de flashcards</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border shadow-sm">
          <CardContent className="p-4 text-center">
            <Calendar className="h-5 w-5 text-primary mx-auto mb-1.5" />
            <p className="text-xl font-bold text-foreground">{totalSessions}</p>
            <p className="text-xs text-muted-foreground">Sessões</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-green-500 mx-auto mb-1.5" />
            <p className="text-xl font-bold text-foreground">{averageAccuracy}%</p>
            <p className="text-xs text-muted-foreground">Precisão</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-4 text-center">
            <BookOpen className="h-5 w-5 text-blue-500 mx-auto mb-1.5" />
            <p className="text-xl font-bold text-foreground">{totalCards}</p>
            <p className="text-xs text-muted-foreground">Cards</p>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Histórico Detalhado</CardTitle>
              <CardDescription>Revise seu desempenho em sessões anteriores</CardDescription>
            </div>
            <Badge variant="outline">{totalSessions} sessões</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Calendar className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Nenhuma sessão encontrada</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Você ainda não realizou nenhuma sessão de flashcards.
              </p>
              <Button asChild>
                <Link to="/flashcards">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Começar a Estudar
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((session, index) => {
                const percentage = Math.round((session.correct / session.totalCards) * 100)
                const modeDetails = getModeDetails(session.mode)
                const ModeIcon = modeDetails.icon

                return (
                  <div key={session.id} className={cn("border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors", index % 2 === 1 && "bg-muted/30")}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{session.topicTitle}</h3>
                            <p className="text-sm text-muted-foreground">{session.subjectName}</p>
                          </div>
                          <div className="text-right">
                            <p className={cn('text-xl font-bold', getPerformanceColor(percentage))}>{percentage}%</p>
                            <p className="text-xs text-muted-foreground">{session.correct}/{session.totalCards}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className={modeDetails.color}>
                            <ModeIcon className="mr-1 h-3 w-3" />
                            {modeDetails.name}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(session.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Progresso</span>
                            <span className={getPerformanceColor(percentage)}>{percentage}%</span>
                          </div>
                          <Progress value={percentage} className="h-1.5" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/flashcards/session/${session.id}/result`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Detalhes
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
