import { supabase } from '@/lib/supabase/client'
import { offlineStorage } from '@/lib/offlineStorage'
import { syncService } from '@/lib/syncService'
import { logger } from '@/lib/logger'

/** Safely parse JSONB options to string array */
function parseOptionsToArray(options: unknown): string[] {
  if (Array.isArray(options)) return options.map(String)
  if (typeof options === 'string') {
    try { return JSON.parse(options) } catch { return [] }
  }
  if (typeof options === 'object' && options !== null) {
    return Object.values(options).map(String)
  }
  return []
}

export interface QuizSubject {
  id: string
  name: string
  description: string
  image: string
  topics: QuizTopic[]
}

export interface QuizTopic {
  id: string
  name: string
  description: string
  questionCount: number
  quizzes: Quiz[]
}

export interface Quiz {
  id: string
  title: string
  description: string
  type?: string // 'quiz', 'simulation', 'answer_sheet'
  status?: string // 'draft', 'published'
  duration_minutes?: number
  questions: QuizQuestion[]
}

export interface QuizQuestion {
  id: string
  question_text: string
  question_type: string
  options: string[]
  correct_answer: string
  explanation?: string
  points: number
  reading_text?: {
    id: string
    title: string
    content: string
  } | null
}

export interface QuizAttempt {
  id: string
  quiz_id: string
  score: number
  total_questions: number
  attempt_date: string
  duration_seconds?: number
}

// Export individual functions for easier importing
export const getQuizzes = async (): Promise<Quiz[]> => {
  try {
    const { data: quizzes, error } = await supabase
      .from('quizzes')
      .select(`
        id,
        title,
        description,
        duration_minutes,
        quiz_questions (
          id,
          question_text,
          question_type,
          options,
          correct_answer,
          explanation,
          points
        )
      `)
      .order('title', { ascending: true })

    if (error) throw error

    return quizzes?.map(quiz => ({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description || '',
      duration_minutes: quiz.duration_minutes,
      questions: (quiz as any).quiz_questions?.map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: parseOptionsToArray(q.options),
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        points: q.points,
      })) || []
    })) || []
  } catch (error) {
    logger.error('Erro ao buscar quizzes:', error)
    return []
  }
}

export const quizService = {
  // Buscar todas as matérias com quizzes
  async getQuizSubjects(): Promise<QuizSubject[]> {
    try {
      const { data: subjects, error } = await supabase
        .from('subjects')
        .select(`
          id,
          name,
          description,
          image_url,
          topics (
            id,
            name,
            description,
            quizzes (
              id,
              title,
              description,
              duration_minutes,
              quiz_questions (id)
            )
          )
        `)
        .order('name')

      if (error) {
        logger.error('❌ Error fetching quiz subjects:', error)
        throw error
      }

      return subjects?.map(subject => ({
        id: subject.id,
        name: subject.name,
        description: subject.description,
        image: subject.image_url || `https://img.usecurling.com/p/400/200?q=${encodeURIComponent(subject.name)}`,
        topics: (subject as any).topics?.map((topic: any) => ({
          id: topic.id,
          name: topic.name,
          description: topic.description,
          questionCount: topic.quizzes?.reduce((total: number, quiz: any) => total + (quiz.quiz_questions?.length || 0), 0) || 0,
          quizzes: topic.quizzes?.filter((quiz: any) => (quiz.quiz_questions?.length || 0) > 0).map((quiz: any) => ({
            id: quiz.id,
            title: quiz.title,
            description: quiz.description,
            duration_minutes: quiz.duration_minutes,
            questions: []
          })) || []
        })) || []
      })) || []
    } catch (error) {
      logger.error('Erro ao buscar matérias de quizzes:', error)
      return []
    }
  },

  // Buscar quiz por ID com questões (com suporte offline)
  async getQuizById(quizId: string): Promise<Quiz | null> {
    try {
      // Buscar metadados do quiz
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .select('id, title, description, duration_minutes')
        .eq('id', quizId)
        .single()

      if (quizError) throw quizError

      // Buscar questões separadamente para evitar problemas de relação no join
      const { data: questions, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('id, question_text, question_type, options, correct_answer, explanation, points, reading_text_id')
        .eq('quiz_id', quizId)

      if (questionsError) throw questionsError

      // Buscar textos de leitura
      const { data: readingTexts } = await supabase
        .from('quiz_reading_texts')
        .select('*')
        .eq('quiz_id', quizId)

      const readingTextsMap = (readingTexts || []).reduce((acc: any, text: any) => {
        acc[text.id] = text
        return acc
      }, {})

      const result = {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description || '',
        duration_minutes: quiz.duration_minutes || 0,
        questions: questions?.map((q: any) => ({
          id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: parseOptionsToArray(q.options),
          correct_answer: q.correct_answer,
          explanation: q.explanation || '',
          points: q.points,
          reading_text: q.reading_text_id ? readingTextsMap[q.reading_text_id] ?? null : null
        })) || []
      }

      // Cachear para uso offline
      if (result.questions.length > 0 && syncService.getOnlineStatus()) {
        await offlineStorage.cacheQuiz({
          id: result.id,
          title: result.title,
          description: result.description,
          topic_id: undefined as any,
          questions: result.questions,
          duration_minutes: result.duration_minutes,
          cached_at: Date.now()
        })
      }

      return result
    } catch (error) {
      logger.error('Erro ao buscar quiz online:', error)

      // Fallback para cache offline
      const cachedQuiz = await offlineStorage.getQuizById(quizId)
      if (!cachedQuiz) return null

      return {
        id: cachedQuiz.id,
        title: cachedQuiz.title,
        description: (cachedQuiz as any).description || '',
        duration_minutes: (cachedQuiz as any).duration_minutes,
        questions: cachedQuiz.questions
      }
    }
  },

  // Salvar tentativa e resposta do quiz (Gabarito)
  async submitQuizAttempt(
    userId: string,
    quizId: string,
    answers: Record<string, string>,
    durationSeconds: number
  ): Promise<string | null> {
    try {
      // S1 Protection: Validate current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser || currentUser.id !== userId) throw new Error('Acesso não autorizado')

      // Se offline, adicionar à fila de sincronização
      if (!syncService.getOnlineStatus()) {
        const attemptId = `offline_attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        await offlineStorage.addToSyncQueue({
          id: attemptId,
          type: 'quiz_attempt',
          data: {
            quiz_id: quizId,
            user_id: userId,
            answers,
            total_questions: Object.keys(answers).length,
            duration_seconds: durationSeconds,
            started_at: Date.now()
          },
          timestamp: Date.now(),
          retries: 0
        })

        return attemptId
      }

      // 1. Criar a tentativa via Supabase (S2 Protection: Ignoramos score do cliente)
      const { data: attempt, error: attemptError } = await supabase
        .from('quiz_attempts')
        .insert({
          user_id: userId,
          quiz_id: quizId,
          duration_seconds: durationSeconds,
          status: 'submitted',
          submitted_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (attemptError) throw attemptError

      // 2. Salvar respostas
      const answerInserts = Object.entries(answers).map(([questionId, answer]) => ({
        attempt_id: attempt.id,
        question_id: questionId,
        answer_value: answer
      }))

      const { error: answersError } = await supabase
        .from('quiz_answers')
        .insert(answerInserts)

      if (answersError) throw answersError

      // 3. Chamar RPC para calcular nota e estatísticas no servidor (S2 Protection)
      const { error: rpcError } = await supabase.rpc('submit_quiz_attempt', {
        p_attempt_id: attempt.id
      })

      if (rpcError) {
        logger.warn('RPC submit_quiz_attempt falhou, usando fallback client-side:', rpcError)
        // Fallback: grade answers client-side
        if (rpcError.code === 'PGRST202') {
          const { data: questions } = await supabase
            .from('quiz_questions')
            .select('id, correct_answer, points')
            .eq('quiz_id', quizId)

          const questionMap = new Map(questions?.map((q: any) => [q.id, q]) || [])
          let totalPts = 0, earnedPts = 0
          for (const q of (questions || [])) totalPts += (q as any).points || 1

          for (const [qId, ansVal] of Object.entries(answers)) {
            const q = questionMap.get(qId) as any
            if (!q) continue
            const correct = q.correct_answer && ansVal === q.correct_answer
            const pts = correct ? (q.points || 1) : 0
            earnedPts += pts
            await supabase.from('quiz_answers')
              .update({ is_correct: correct, points_earned: pts })
              .eq('attempt_id', attempt.id)
              .eq('question_id', qId)
          }

          const pct = totalPts > 0 ? (earnedPts / totalPts) * 100 : 0
          await supabase.from('quiz_attempts')
            .update({ score: earnedPts, total_points: totalPts, percentage: Math.round(pct * 100) / 100 })
            .eq('id', attempt.id)
        }
      }

      return attempt.id
    } catch (error) {
      logger.error('Erro ao salvar tentativa de quiz:', error)
      return null
    }
  },

  // Buscar histórico de tentativas do usuário
  async getUserQuizAttempts(userId: string): Promise<QuizAttempt[]> {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser || currentUser.id !== userId) return []

      const { data: attempts, error } = await supabase
        .from('quiz_attempts')
        .select(`
          id,
          quiz_id,
          score,
          total_questions,
          attempt_date,
          duration_seconds,
          quizzes (
            title
          )
        `)
        .eq('user_id', userId)
        .order('attempt_date', { ascending: false })

      if (error) throw error

      return attempts?.map((attempt: any) => ({
        id: attempt.id,
        quiz_id: attempt.quiz_id,
        score: attempt.score,
        total_questions: attempt.total_questions,
        attempt_date: attempt.attempt_date,
        duration_seconds: attempt.duration_seconds
      })) || []
    } catch (error) {
      logger.error('Erro ao buscar tentativas de quiz:', error)
      return []
    }
  },

  // Buscar estatísticas de quiz do usuário
  async getUserQuizStats(userId: string): Promise<{
    totalAttempts: number
    averageScore: number
    bestScore: number
    totalQuestions: number
  }> {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser || currentUser.id !== userId) {
        return { totalAttempts: 0, averageScore: 0, bestScore: 0, totalQuestions: 0 }
      }

      const { data: attempts, error } = await supabase
        .from('quiz_attempts')
        .select('score, total_questions')
        .eq('user_id', userId)

      if (error) throw error

      const totalAttempts = attempts?.length || 0
      const totalScore = attempts?.reduce((sum: number, attempt: any) => sum + (attempt.score || 0), 0) || 0
      const averageScore = totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0
      const bestScore = attempts?.reduce((max: number, attempt: any) => Math.max(max, attempt.score || 0), 0) || 0
      const totalQuestions = attempts?.reduce((sum: number, attempt: any) => sum + (attempt.total_questions || 0), 0) || 0

      return {
        totalAttempts,
        averageScore,
        bestScore,
        totalQuestions
      }
    } catch (error) {
      logger.error('Erro ao buscar estatísticas de quiz:', error)
      return {
        totalAttempts: 0,
        averageScore: 0,
        bestScore: 0,
        totalQuestions: 0
      }
    }
  }
}