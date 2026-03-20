import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  Link as LinkIcon,
  Expand,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Brain,
  Timer,
} from 'lucide-react'
import {
  getTopicWithCards,
  saveFlashcardSession,
  updateFlashcardProgress,
  getDifficultFlashcardsForTopic,
  type Flashcard,
  type TopicWithSubjectAndCards,
  type SaveSessionPayload,
} from '@/services/flashcardService'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { SectionLoader } from '@/components/SectionLoader'
import { useActivityScoring } from '@/hooks/useAchievements'
import { LevelBadge } from '@/components/gamification/LevelBadge'
import { FlashcardInstructionsDialog } from '@/components/flashcards/FlashcardInstructionsDialog'
import { logger } from '@/lib/logger'

type SessionResult = { cardId: string; result: 'correct' | 'incorrect' }
type StudyState = 'question' | 'answer'

// ── Fullscreen hook ──
const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)
  const toggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => logger.error('Fullscreen error:', err))
    } else {
      document.exitFullscreen().catch((err) => logger.error('Exit fullscreen error:', err))
    }
  }
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])
  return { isFullscreen, toggle }
}

// ── Timer hook ──
const useTimer = () => {
  const [seconds, setSeconds] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const formatted = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  return { seconds, formatted }
}

// ── Swipe hook ──
const useSwipe = (onLeft: () => void, onRight: () => void) => {
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX
    const diff = touchStartX.current - touchEndX.current
    if (Math.abs(diff) > 60) {
      if (diff > 0) onLeft()
      else onRight()
    }
  }

  return { onTouchStart, onTouchEnd }
}

// ── Progress Dots ──
function ProgressDots({
  total,
  current,
  results,
}: {
  total: number
  current: number
  results: SessionResult[]
}) {
  const resultMap = new Map(results.map((r) => [r.cardId, r.result]))
  // Show max ~20 dots, group if more
  const maxDots = 20
  const showAll = total <= maxDots

  if (!showAll) {
    const answered = results.length
    const correct = results.filter((r) => r.result === 'correct').length
    const incorrect = answered - correct
    const remaining = total - answered
    return (
      <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> {correct}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> {incorrect}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" /> {remaining}
        </span>
        <span className="font-medium text-foreground">{current + 1}/{total}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      {Array.from({ length: total }, (_, i) => {
        const isCurrent = i === current
        // Find result for this card index — we need cardId from deck
        // Since we don't have deck here, we check by index in results
        const answered = i < results.length
        const result = answered ? results[i]?.result : null
        return (
          <div
            key={i}
            className={cn(
              'rounded-full transition-all duration-200',
              isCurrent ? 'w-6 h-2.5' : 'w-2.5 h-2.5',
              isCurrent
                ? 'bg-primary'
                : result === 'correct'
                  ? 'bg-green-500'
                  : result === 'incorrect'
                    ? 'bg-red-500'
                    : 'bg-muted-foreground/20',
            )}
          />
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════════

export default function FlashcardStudyPage() {
  const { subjectId, topicId } = useParams<{ subjectId: string; topicId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()
  const { user } = useAuth()
  const { scoreFlashcardActivity } = useActivityScoring()
  const timer = useTimer()

  const studyMode = searchParams.get('mode') || 'full'
  const cardCountParam = searchParams.get('count')
  const returnTo = searchParams.get('returnTo')

  const [topicData, setTopicData] = useState<TopicWithSubjectAndCards | null>(null)
  const [studyDeck, setStudyDeck] = useState<Flashcard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [studyState, setStudyState] = useState<StudyState>('question')
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([])
  const [isFlipped, setIsFlipped] = useState(false)
  const [cardTransition, setCardTransition] = useState(false)
  const [lastAnswer, setLastAnswer] = useState<'correct' | 'incorrect' | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)

  const sessionResultsRef = useRef<SessionResult[]>([])
  const isFinishingRef = useRef(false)

  useEffect(() => {
    sessionResultsRef.current = sessionResults
  }, [sessionResults])

  // ── Fetch deck ──
  useEffect(() => {
    if (!topicId || !subjectId) return
    setIsLoading(true)

    const fetchAndSetDeck = async () => {
      try {
        let fetchedCards: Flashcard[] = []
        if (studyMode === 'difficult_review') {
          if (!user?.id) throw new Error('Usuário não autenticado')
          fetchedCards = await getDifficultFlashcardsForTopic(user.id, topicId)
          if (fetchedCards.length === 0) {
            toast({ title: 'Nenhum card difícil!', description: 'Você não marcou nenhum card como difícil neste tópico.' })
            navigate(`/flashcards/${subjectId}`)
            return
          }
          // Set minimal topicData so finishSession can save the session
          setTopicData({ id: topicId, name: 'Revisão de Difíceis', flashcards: fetchedCards } as any)
        } else {
          const data = await getTopicWithCards(topicId)
          if (data) {
            setTopicData(data)
            fetchedCards = data.flashcards
          }
        }

        let deck = [...fetchedCards].sort(() => 0.5 - Math.random())
        if (cardCountParam && cardCountParam !== 'all' && studyMode !== 'difficult_review') {
          const count = parseInt(cardCountParam, 10)
          if (count > 0 && count < deck.length) deck = deck.slice(0, count)
        }
        setStudyDeck(deck)
        setCurrentIndex(0)
        setSessionResults([])
        setStudyState('question')
        setIsFlipped(false)
        setLastAnswer(null)
      } catch (error) {
        logger.error('Failed to fetch study deck:', error)
        toast({ title: 'Erro ao carregar cards', variant: 'destructive' })
      } finally {
        setIsLoading(false)
      }
    }

    fetchAndSetDeck()
  }, [topicId, studyMode, cardCountParam, subjectId, navigate, toast, user])

  // ── Finish session ──
  const finishSession = useCallback(async () => {
    if (!topicData || !user?.id) return
    if (isFinishingRef.current) return
    isFinishingRef.current = true

    const results = sessionResultsRef.current
    const correct = results.filter((r) => r.result === 'correct').length
    const incorrect = results.length - correct

    const sessionPayload: SaveSessionPayload = {
      topicId: topicData.id,
      sessionMode: studyMode,
      cardsReviewed: results.length,
      correctAnswers: correct,
      incorrectAnswers: incorrect,
      durationSeconds: timer.seconds,
    }

    const sessionId = await saveFlashcardSession(user.id, sessionPayload)

    if (!sessionId) {
      toast({ title: 'Erro ao salvar sessão', variant: 'destructive' })
      navigate(`/flashcards/${subjectId}`)
      return
    }

    await scoreFlashcardActivity(correct, studyDeck.length, sessionId)
    navigate(returnTo || `/flashcards/session/${sessionId}/result`)
  }, [topicData, user, studyMode, studyDeck.length, navigate, scoreFlashcardActivity, toast, subjectId, timer.seconds])

  // ── Navigation ──
  const handleNext = useCallback(() => {
    setCardTransition(true)
    setIsFlipped(false)
    setLastAnswer(null)

    setTimeout(() => {
      if (currentIndex < studyDeck.length - 1) {
        setCurrentIndex((prev) => prev + 1)
        setStudyState('question')
      } else {
        finishSession()
      }
      setCardTransition(false)
    }, 300)
  }, [currentIndex, studyDeck.length, finishSession])

  const handlePrev = useCallback(() => {
    setCardTransition(true)
    setIsFlipped(false)
    setLastAnswer(null)

    setTimeout(() => {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : 0))
      setStudyState('question')
      setCardTransition(false)
    }, 300)
  }, [])

  // ── Swipe support ──
  const swipeHandlers = useSwipe(handleNext, handlePrev)

  // ── Answer handler ──
  const handleAnswer = useCallback(async (quality: number) => {
    if (studyState !== 'answer') {
      toast({ title: 'Veja a resposta primeiro!', variant: 'destructive' })
      return
    }

    const card = studyDeck[currentIndex]
    if (!card) return

    try {
      if (!user?.id) throw new Error('Usuário não autenticado')

      await updateFlashcardProgress(user.id, card.id, quality)
      const result: 'correct' | 'incorrect' = quality <= 2 ? 'incorrect' : 'correct'

      setSessionResults((prev) => [...prev, { cardId: card.id, result }])
      setLastAnswer(result)
    } catch {
      toast({ title: 'Erro ao salvar progresso', variant: 'destructive' })
    }

    setTimeout(handleNext, 1200)
  }, [studyState, studyDeck, currentIndex, user, toast, handleNext])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        setIsFlipped((prev) => {
          const next = !prev
          setStudyState(next ? 'answer' : 'question')
          return next
        })
      }
      if (event.code === 'ArrowRight') handleNext()
      if (event.code === 'ArrowLeft') handlePrev()
      // Keyboard shortcuts for difficulty: 1, 2, 3
      if (studyState === 'answer') {
        if (event.code === 'Digit1') handleAnswer(1)
        if (event.code === 'Digit2') handleAnswer(3)
        if (event.code === 'Digit3') handleAnswer(5)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [studyState, handleNext, handlePrev, handleAnswer])

  const handleFlip = () => {
    setIsFlipped((prev) => {
      const next = !prev
      setStudyState(next ? 'answer' : 'question')
      return next
    })
  }

  // ── Loading / empty states ──
  if (isLoading) return <SectionLoader />

  if (!topicData || studyDeck.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sessão não encontrada</h1>
          <p className="text-sm text-muted-foreground mt-1">Sessão de estudo não encontrada ou vazia.</p>
        </div>
        <Button variant="outline" onClick={() => navigate(`/flashcards/${subjectId}`)}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Voltar aos Tópicos
        </Button>
      </div>
    )
  }

  const currentCard = studyDeck[currentIndex]
  const correctCount = sessionResults.filter((r) => r.result === 'correct').length
  const incorrectCount = sessionResults.filter((r) => r.result === 'incorrect').length

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  const progressPercent = studyDeck.length > 0 ? Math.round(((currentIndex + 1) / studyDeck.length) * 100) : 0
  const modeLabel = studyMode === 'difficult_review' ? 'Revisão Difíceis' : studyMode === 'lightning' ? 'Relâmpago' : studyMode === 'test' ? 'Modo Teste' : 'Sessão Completa'

  return (
    <>
      <FlashcardInstructionsDialog isOpen={showInstructions} onClose={() => { setShowInstructions(false); localStorage.setItem('flashcard-instructions-seen', '1') }} />

      <div className={cn('space-y-5', isFullscreen && 'fixed inset-0 z-50 bg-background p-6 overflow-y-auto')}>
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="outline" size="icon" onClick={() => navigate(returnTo || `/flashcards/${subjectId}`)} aria-label="Voltar">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground truncate">{topicData.name}</h1>
                <Badge variant="secondary" className="shrink-0 text-[10px]">{modeLabel}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{topicData.subject?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-mono tabular-nums">
              <Timer className="h-3.5 w-3.5 text-primary" />
              <span className="text-foreground font-medium">{timer.formatted}</span>
            </div>
            <LevelBadge variant="compact" />
            <Button variant="outline" size="icon" onClick={toggleFullscreen} title="Tela Cheia" aria-label="Tela cheia">
              <Expand className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Stats Card ── */}
        <Card className="border-border shadow-sm mx-auto max-w-2xl">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-950/50">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-bold text-green-600 text-sm">{correctCount}</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">acertos</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-950/50">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="font-bold text-red-600 text-sm">{incorrectCount}</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">erros</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-foreground">{currentIndex + 1}</span>
                <span className="text-muted-foreground text-sm"> / {studyDeck.length}</span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-2.5 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Progress Dots ── */}
        <ProgressDots total={studyDeck.length} current={currentIndex} results={sessionResults} />

        {/* ── Flashcard with flip ── */}
        <div
          className="mx-auto max-w-2xl"
          style={{ perspective: '1200px' }}
          {...swipeHandlers}
        >
          <div
            className={cn(
              'relative w-full transition-all duration-500 cursor-pointer',
              cardTransition && 'scale-95 opacity-50',
            )}
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              minHeight: '360px',
              maxHeight: '70vh',
              height: 'auto',
            }}
            onClick={studyState === 'question' ? handleFlip : undefined}
          >
            {/* Front (Question) */}
            <Card
              className={cn(
                'absolute inset-0 overflow-hidden border-border shadow-md',
                lastAnswer === 'correct' && 'ring-2 ring-green-500/50',
                lastAnswer === 'incorrect' && 'ring-2 ring-red-500/50',
              )}
              style={{ backfaceVisibility: 'hidden' }}
            >
              {/* Top accent bar */}
              <div className="h-1.5 bg-primary w-full" />
              <CardContent className="h-full flex flex-col p-6 pt-5" style={{ minHeight: '344px' }}>
                <div className="flex items-center justify-between mb-4">
                  <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                    <Brain className="mr-1 h-3 w-3" />
                    Pergunta
                  </Badge>
                  <span className="text-xs text-muted-foreground font-medium">
                    Card {currentIndex + 1} de {studyDeck.length}
                  </span>
                </div>
                <div className="flex-grow flex items-center justify-center overflow-y-auto py-4">
                  <p className={cn(
                    'font-bold text-center leading-relaxed text-foreground break-words',
                    currentCard.question.length > 300 ? 'text-sm sm:text-base' :
                    currentCard.question.length > 150 ? 'text-base sm:text-lg md:text-xl' :
                    'text-xl sm:text-2xl md:text-3xl'
                  )}>
                    {currentCard.question}
                  </p>
                </div>
                {/* Feedback overlay */}
                {lastAnswer && (
                  <div className={cn(
                    'absolute inset-0 flex items-center justify-center rounded-xl transition-opacity duration-300',
                    lastAnswer === 'correct' ? 'bg-green-100 dark:bg-green-950/50' : 'bg-red-100 dark:bg-red-950/50',
                  )}>
                    {lastAnswer === 'correct'
                      ? <CheckCircle className="h-24 w-24 text-green-500/50" />
                      : <XCircle className="h-24 w-24 text-red-500/50" />}
                  </div>
                )}
                <Button onClick={handleFlip} size="lg" className="w-full mt-4 gap-2">
                  <Eye className="h-4 w-4" />
                  Mostrar Resposta
                  <kbd className="ml-2 px-1.5 py-0.5 rounded bg-primary-foreground/20 text-[10px] font-mono">Espaço</kbd>
                </Button>
              </CardContent>
            </Card>

            {/* Back (Answer) */}
            <Card
              className={cn(
                'absolute inset-0 overflow-hidden border-border shadow-md',
                lastAnswer === 'correct' && 'ring-2 ring-green-500/50',
                lastAnswer === 'incorrect' && 'ring-2 ring-red-500/50',
              )}
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              {/* Top accent bar - green for answer */}
              <div className="h-1.5 bg-green-500 w-full" />
              <CardContent className="h-full flex flex-col p-6 pt-5" style={{ minHeight: '344px' }}>
                <div className="flex items-center justify-between mb-4">
                  <Badge className="bg-green-100 dark:bg-green-950/50 text-green-600 border-green-300 dark:border-green-800 hover:bg-green-500/10">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Resposta
                  </Badge>
                  <span className="text-xs text-muted-foreground font-medium">
                    Card {currentIndex + 1} de {studyDeck.length}
                  </span>
                </div>
                <div className="flex-grow overflow-y-auto py-4">
                  <div className="flex items-center justify-center min-h-full">
                    <p className={cn(
                      'font-bold text-center leading-relaxed text-foreground break-words',
                      currentCard.answer.length > 300 ? 'text-sm sm:text-base' :
                      currentCard.answer.length > 150 ? 'text-base sm:text-lg md:text-xl' :
                      'text-xl sm:text-2xl md:text-3xl'
                    )}>
                      {currentCard.answer}
                    </p>
                  </div>
                  {currentCard.explanation && (
                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-300 dark:border-blue-800 mt-4">
                      <p className="text-xs font-semibold text-blue-600 mb-1">Explicação:</p>
                      <p className="text-xs sm:text-sm text-foreground line-clamp-6">{currentCard.explanation}</p>
                    </div>
                  )}
                </div>
                {currentCard.external_resource_url && (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <a href={currentCard.external_resource_url} target="_blank" rel="noopener noreferrer">
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Recurso Externo
                    </a>
                  </Button>
                )}
                {/* Feedback overlay */}
                {lastAnswer && (
                  <div className={cn(
                    'absolute inset-0 flex items-center justify-center rounded-xl transition-opacity duration-300',
                    lastAnswer === 'correct' ? 'bg-green-100 dark:bg-green-950/50' : 'bg-red-100 dark:bg-red-950/50',
                  )}>
                    {lastAnswer === 'correct'
                      ? <CheckCircle className="h-24 w-24 text-green-500/50" />
                      : <XCircle className="h-24 w-24 text-red-500/50" />}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Difficulty buttons (below card, always visible when answer shown) ── */}
        {studyState === 'answer' && !lastAnswer && (
          <div className="mx-auto max-w-2xl">
            <p className="text-sm text-center font-medium text-foreground mb-3">Como você se saiu?</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleAnswer(1)}
                className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/50 p-4 transition-all hover:border-red-400 hover:shadow-md active:scale-[0.97]"
              >
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <span className="text-sm font-bold text-red-600">Difícil</span>
                <kbd className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-500/50 text-[10px] font-mono text-red-500">1</kbd>
              </button>
              <button
                onClick={() => handleAnswer(3)}
                className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-yellow-200 bg-yellow-50 dark:border-yellow-500/30 dark:bg-yellow-500/50 p-4 transition-all hover:border-yellow-400 hover:shadow-md active:scale-[0.97]"
              >
                <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-950/50 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <span className="text-sm font-bold text-yellow-600">Médio</span>
                <kbd className="px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-500/50 text-[10px] font-mono text-yellow-500">2</kbd>
              </button>
              <button
                onClick={() => handleAnswer(5)}
                className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/50 p-4 transition-all hover:border-green-400 hover:shadow-md active:scale-[0.97]"
              >
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <span className="text-sm font-bold text-green-600">Fácil</span>
                <kbd className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-500/50 text-[10px] font-mono text-green-500">3</kbd>
              </button>
            </div>
          </div>
        )}

        {/* ── Navigation (below difficulty) ── */}
        <div className="mx-auto max-w-2xl flex items-center justify-between gap-3">
          <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0} size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Anterior
          </Button>
          <p className="text-xs text-muted-foreground text-center hidden sm:block">
            <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px] font-mono">Espaço</kbd> virar ·
            <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px] font-mono ml-1">←</kbd>
            <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px] font-mono ml-0.5">→</kbd> navegar
          </p>
          <Button variant="outline" onClick={handleNext} size="sm">
            Próximo <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  )
}
