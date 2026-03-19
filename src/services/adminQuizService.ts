import { supabase } from '@/lib/supabase/client'
import type { Database, Json } from '@/lib/supabase/types'
import { logger } from '@/lib/logger'

export type AdminQuiz = Database['public']['Tables']['quizzes']['Row'] & {
  topics: { name: string } | null
  quiz_questions: { count: number }[]
}

export type AdminTopic = Database['public']['Tables']['topics']['Row']

export type QuizInsert = Database['public']['Tables']['quizzes']['Insert']
export type QuestionInsert =
  Database['public']['Tables']['quiz_questions']['Insert']

// Aliases used by adminSimulationService re-exports
export type QuizQuestion = Database['public']['Tables']['quiz_questions']['Row']
export type QuizQuestionInsert = Database['public']['Tables']['quiz_questions']['Insert']
export type QuizQuestionUpdate = Database['public']['Tables']['quiz_questions']['Update']
export type ReadingTextUpdate = Database['public']['Tables']['quiz_reading_texts']['Update']

export interface QuestionPerformance {
  question_id: string
  question_text: string
  correct_answers: number
  incorrect_answers: number
}

export interface StudentAttempt {
  attempt_id: string
  user_id: string
  user_name: string
  user_email: string
  score: number
  total_questions: number
  duration_seconds: number | null
  attempt_date: string
}

export interface QuizReport {
  quiz_title: string
  total_attempts: number
  average_score_percentage: number
  average_duration_seconds: number
  question_performance: QuestionPerformance[]
  student_attempts: StudentAttempt[]
}

export interface AttemptAnswer {
  question_text: string
  options: Json | null
  user_answer: string | null
  correct_answer: string
  is_correct: boolean
}

export const getAdminQuizzes = async (): Promise<AdminQuiz[]> => {
  const { data, error } = await supabase
    .from('quizzes')
    .select(
      `
      *,
      topics ( name ),
      quiz_questions ( count )
    `,
    )
    .or('type.eq.quiz,type.is.null')
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('Error fetching quizzes:', error)
    throw error
  }

  return data as AdminQuiz[]
}

export const getTopics = async (): Promise<AdminTopic[]> => {
  const { data, error } = await supabase.from('topics').select('id, name')

  if (error) {
    logger.error('Error fetching topics:', error)
    throw error
  }
  return data
}

export const getAllQuestions = async () => {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select(`
      id,
      question_text,
      question_type,
      options,
      correct_answer,
      explanation,
      points,
      topics (
        id,
        name,
        subjects (
          id,
          name
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('Error fetching questions:', error)
    throw error
  }
  return data
}

export const createQuiz = async (
  quizData: Omit<QuizInsert, 'created_by_user_id'>,
): Promise<AdminQuiz | null> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const { data, error } = await supabase
    .from('quizzes')
    .insert({ ...quizData, created_by_user_id: user.id, type: 'quiz' })
    .select(`*, topics(name), quiz_questions(count)`)
    .single()

  if (error) {
    logger.error('Error creating quiz:', error)
    throw error
  }
  return data as AdminQuiz
}

export const getQuizById = async (quizId: string): Promise<AdminQuiz | null> => {
  const { data, error } = await supabase
    .from('quizzes')
    .select(
      `
      *,
      topics ( name ),
      quiz_questions ( count )
    `,
    )
    .eq('id', quizId)
    .single()

  if (error) {
    logger.error('Error fetching quiz:', error)
    throw error
  }

  return data as AdminQuiz
}

export const updateQuiz = async (
  quizId: string,
  quizData: Partial<QuizInsert>,
): Promise<AdminQuiz | null> => {
  const { data, error } = await supabase
    .from('quizzes')
    .update(quizData)
    .eq('id', quizId)
    .select(`*, topics(name), quiz_questions(count)`)
    .single()

  if (error) {
    logger.error('Error updating quiz:', error)
    throw error
  }
  return data as AdminQuiz
}

export const deleteQuiz = async (quizId: string): Promise<void> => {
  const { error } = await supabase.from('quizzes').delete().eq('id', quizId)

  if (error) {
    logger.error('Error deleting quiz:', error)
    throw error
  }
}

export const bulkInsertQuestions = async (
  questions: QuestionInsert[],
): Promise<void> => {
  const { error } = await supabase.from('quiz_questions').insert(questions)
  if (error) {
    logger.error('Error bulk inserting questions:', error)
    throw error
  }
}

export const updateQuestion = async (
  questionId: string,
  questionData: Partial<QuestionInsert>,
): Promise<void> => {
  const { error } = await supabase
    .from('quiz_questions')
    .update(questionData)
    .eq('id', questionId)

  if (error) {
    logger.error('Error updating question:', error)
    throw error
  }
}

export const deleteQuestion = async (questionId: string): Promise<void> => {
  const { error } = await supabase
    .from('quiz_questions')
    .delete()
    .eq('id', questionId)

  if (error) {
    logger.error('Error deleting question:', error)
    throw error
  }
}

export const getQuizReport = async (
  quizId: string,
): Promise<QuizReport | null> => {
  const { data: quizData, error: quizError } = await supabase
    .from('quizzes')
    .select('title')
    .eq('id', quizId)
    .single()

  if (quizError || !quizData) {
    logger.error('Error fetching quiz details:', quizError)
    return null
  }

  const { data: attemptsData, error: attemptsError } = await supabase
    .from('quiz_attempts')
    .select(
      `
      id,
      score,
      total_questions,
      duration_seconds,
      attempt_date,
      users ( id, first_name, last_name, email )
    `,
    )
    .eq('quiz_id', quizId)

  if (attemptsError) {
    logger.error('Error fetching quiz attempts:', attemptsError)
    return null
  }

  const total_attempts = attemptsData.length
  if (total_attempts === 0) {
    return {
      quiz_title: quizData.title,
      total_attempts: 0,
      average_score_percentage: 0,
      average_duration_seconds: 0,
      question_performance: [],
      student_attempts: [],
    }
  }

  const total_score = attemptsData.reduce(
    (acc, attempt) => acc + attempt.score / attempt.total_questions,
    0,
  )
  const average_score_percentage = (total_score / total_attempts) * 100
  const total_duration = attemptsData.reduce(
    (acc, attempt) => acc + (attempt.duration_seconds || 0),
    0,
  )
  const average_duration_seconds = total_duration / total_attempts

  const student_attempts: StudentAttempt[] = attemptsData.map(
    (attempt: any) => ({
      attempt_id: attempt.id,
      user_id: attempt.users?.id || '',
      user_name:
        `${attempt.users?.first_name || ''} ${attempt.users?.last_name || ''}`.trim(),
      user_email: attempt.users?.email || '',
      score: attempt.score,
      total_questions: attempt.total_questions,
      duration_seconds: attempt.duration_seconds,
      attempt_date: attempt.attempt_date,
    }),
  )

  const { data: qpData, error: qpError } = await supabase.rpc(
    'get_question_performance_for_quiz',
    {
      p_quiz_id: quizId,
    },
  )

  if (qpError) {
    logger.error('Error fetching question performance:', qpError)
  }

  return {
    quiz_title: quizData.title,
    total_attempts,
    average_score_percentage,
    average_duration_seconds,
    question_performance: (qpData as any) || [],
    student_attempts,
  }
}

export const getAttemptDetails = async (
  attemptId: string,
): Promise<AttemptAnswer[] | null> => {
  const { data, error } = await supabase
    .from('quiz_attempt_answers')
    .select(
      `
      is_correct,
      user_answer,
      quiz_questions (
        question_text,
        options,
        correct_answer
      )
    `,
    )
    .eq('quiz_attempt_id', attemptId)

  if (error) {
    logger.error('Error fetching attempt details:', error)
    return null
  }

  return data.map((item: any) => ({
    question_text: item.quiz_questions?.question_text || '',
    options: item.quiz_questions?.options || [],
    user_answer: item.user_answer,
    correct_answer: item.quiz_questions?.correct_answer || '',
    is_correct: item.is_correct,
  }))
}

export const getQuizQuestions = async (quizId: string) => {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('Error fetching quiz questions:', error)
    throw error
  }
  return data
}

// Aliases for adminSimulationService compatibility
export const getQuestions = getQuizQuestions

export const createQuestion = async (question: QuizQuestionInsert): Promise<QuizQuestion> => {
  const { data, error } = await supabase
    .from('quiz_questions')
    .insert(question)
    .select()
    .single()

  if (error) {
    logger.error('Error creating question:', error)
    throw error
  }
  return data
}

export type QuestionUpsert = Database['public']['Tables']['quiz_questions']['Insert'] & {
  id?: string
}

/* ==================================================================================
 *  READING TEXTS (TEXTOS DE APOIO)
 * ================================================================================== */

export type ReadingText = Database['public']['Tables']['quiz_reading_texts']['Row']
export type ReadingTextInsert = Database['public']['Tables']['quiz_reading_texts']['Insert']

export const getReadingTexts = async (quizId: string): Promise<ReadingText[]> => {
  const { data, error } = await supabase
    .from('quiz_reading_texts')
    .select('*')
    .eq('quiz_id', quizId)
    .order('display_order', { ascending: true })

  if (error) {
    logger.error('Error fetching reading texts:', error)
    throw error
  }
  return data
}

export const createReadingText = async (textData: ReadingTextInsert): Promise<ReadingText> => {
  const { data, error } = await supabase
    .from('quiz_reading_texts')
    .insert(textData)
    .select()
    .single()

  if (error) {
    logger.error('Error creating reading text:', error)
    throw error
  }
  return data
}

export const updateReadingText = async (
  id: string,
  textData: Partial<ReadingTextInsert>,
): Promise<ReadingText> => {
  const { data, error } = await supabase
    .from('quiz_reading_texts')
    .update(textData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    logger.error('Error updating reading text:', error)
    throw error
  }
  return data
}

export const deleteReadingText = async (id: string): Promise<void> => {
  const { error } = await supabase.from('quiz_reading_texts').delete().eq('id', id)

  if (error) {
    logger.error('Error deleting reading text:', error)
    throw error
  }
}

export const saveQuizQuestions = async (
  quizId: string,
  questions: QuestionUpsert[],
): Promise<void> => {
  // 1. Get existing questions to determine deletes
  const existingQuestions = await getQuizQuestions(quizId)
  const newIds = new Set(questions.filter((q) => q.id).map((q) => q.id))

  // 2. Delete removed questions (single batch)
  const idsToDelete = existingQuestions
    .filter((q) => !newIds.has(q.id))
    .map((q) => q.id)

  if (idsToDelete.length > 0) {
    const { error } = await supabase
      .from('quiz_questions')
      .delete()
      .in('id', idsToDelete)
    if (error) throw error
  }

  // 3. Batch upsert: separate into updates and inserts
  const toUpdate = questions.filter(q => q.id)
  const toInsert = questions.filter(q => !q.id).map(q => ({ ...q, quiz_id: quizId }))

  // Batch update via Promise.all (parallel, not sequential)
  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map(({ id, ...data }) =>
        supabase.from('quiz_questions').update(data).eq('id', id!).then(({ error }) => { if (error) throw error })
      )
    )
  }

  // Batch insert (single request)
  if (toInsert.length > 0) {
    const { error } = await supabase.from('quiz_questions').insert(toInsert)
    if (error) throw error
  }

  // 4. Auto-generate flashcards (non-blocking background)
  generateFlashcardsFromQuiz(quizId).catch(err => logger.error('Flashcard gen error:', err))
}

/**
 * Auto-generate flashcards from quiz questions.
 * For each question, creates a flashcard with:
 *   - front (question) = question text
 *   - back (answer) = correct answer option text + explanation
 * Deletes old auto-generated flashcards for this quiz's topic first,
 * then inserts fresh ones so they stay in sync.
 */
const generateFlashcardsFromQuiz = async (quizId: string): Promise<void> => {
  try {
    // Get quiz + questions in parallel
    const [{ data: quiz }, questions] = await Promise.all([
      supabase.from('quizzes').select('topic_id, created_by_user_id').eq('id', quizId).single(),
      getQuizQuestions(quizId),
    ])

    if (!quiz?.topic_id || questions.length === 0) return

    // Delete existing auto-generated flashcards for THIS SPECIFIC quiz only
    // source_type='quiz_auto' + source_exam=quizId scopes the delete
    await supabase
      .from('flashcards')
      .delete()
      .eq('source_type', 'quiz_auto')
      .eq('source_exam', quizId)

    // Build flashcards from questions
    const flashcards = questions.map((q) => {
      const options = Array.isArray(q.options) ? q.options as string[] : []
      const correctIndex = options.indexOf(q.correct_answer)
      const correctLetter = correctIndex >= 0 ? String.fromCharCode(65 + correctIndex) : ''
      const answerText = correctLetter
        ? `${correctLetter}) ${q.correct_answer}`
        : q.correct_answer

      return {
        question: q.question_text,
        answer: answerText,
        explanation: q.explanation || null,
        topic_id: quiz.topic_id!,
        created_by_user_id: quiz.created_by_user_id,
        source_type: 'quiz_auto',
        source_exam: quizId,
        difficulty: 3,
      }
    })

    if (flashcards.length > 0) {
      const { error } = await supabase.from('flashcards').insert(flashcards)
      if (error) {
        logger.error('Error generating flashcards from quiz:', error)
      }
    }
  } catch (error) {
    // Non-blocking: don't fail the quiz save if flashcard generation fails
    logger.error('Error in generateFlashcardsFromQuiz:', error)
  }
}
