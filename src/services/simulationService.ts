import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export interface SimulationQuestion {
  id: string
  question_format: string
  question_text: string
  question_html?: string
  question_image_url?: string
  question_image_caption?: string
  options?: string[]
  options_rich?: Array<{
    id: string
    text: string
    html?: string
    imageUrl?: string
    isCorrect?: boolean
  }>
  correct_answer?: string
  correct_answers?: string[]
  explanation?: string
  explanation_html?: string
  difficulty?: string
  points?: number
  time_limit_seconds?: number
  source?: string
  year?: number
  subject?: string
}

export interface Simulation {
  id: string
  title: string
  description?: string
  duration_minutes?: number
  questions: SimulationQuestion[]
}

export async function getSimulation(quizId: string): Promise<Simulation | null> {
  try {
    // Buscar quiz
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('id, title, description, duration_minutes')
      .eq('id', quizId)
      .single()

    if (quizError) throw quizError
    if (!quiz) return null

    // Buscar questões do quiz
    const { data: questions, error: questionsError } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('created_at', { ascending: true })

    if (questionsError) throw questionsError

    // Transformar options de JSONB para array de strings
    const formattedQuestions = questions?.map(q => {
      let opts: string[] | undefined
      if (q.options) {
        if (Array.isArray(q.options)) {
          opts = q.options.map(String)
        } else if (typeof q.options === 'string') {
          try { opts = JSON.parse(q.options) } catch { opts = undefined }
        } else if (typeof q.options === 'object') {
          opts = Object.values(q.options).map(String)
        }
      }
      return {
        ...q,
        question_format: (q as any).question_type || 'multiple_choice',
        options: opts,
      }
    }) as unknown as SimulationQuestion[]

    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description || '',
      duration_minutes: quiz.duration_minutes || 0,
      questions: formattedQuestions || [],
    }
  } catch (error) {
    logger.error('Error fetching simulation:', error)
    throw error
  }
}

export async function getAvailableSimulations() {
  try {
    const { data, error } = await supabase
      .from('quizzes')
      .select(`
        id,
        title,
        description,
        duration_minutes,
        quiz_questions (count)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  } catch (error) {
    logger.error('Error fetching simulations:', error)
    throw error
  }
}

export async function startSimulationAttempt(quizId: string, userId: string): Promise<string> {
  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser || currentUser.id !== userId) throw new Error('Não autorizado')

    // Check for existing in-progress attempt
    const { data: existingAttempt } = await (supabase as any)
      .from('quiz_attempts')
      .select('id')
      .eq('quiz_id', quizId)
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .single()

    if (existingAttempt) {
      return existingAttempt.id
    }

    // Create new attempt
    const { data: newAttempt, error } = await (supabase as any)
      .from('quiz_attempts')
      .insert({
        quiz_id: quizId,
        user_id: userId,
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (error) throw error
    return newAttempt.id
  } catch (error) {
    logger.error('Error starting simulation attempt:', error)
    throw error
  }
}

export async function saveSimulationAnswer(
  attemptId: string,
  questionId: string,
  answer: any
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autorizado')

    // Validar se o attempt pertence ao usuário
    const { data: attempt } = await (supabase as any)
      .from('quiz_attempts')
      .select('user_id')
      .eq('id', attemptId)
      .single()

    const ifAttempt = attempt as any
    if (!ifAttempt || ifAttempt.user_id !== user.id) throw new Error('Não autorizado')

    const { error } = await (supabase as any)
      .from('quiz_answers')
      .upsert({
        attempt_id: attemptId,
        question_id: questionId,
        answer_value: typeof answer === 'string' ? answer : JSON.stringify(answer),
        is_correct: null
      }, {
        onConflict: 'attempt_id,question_id'
      })

    if (error) throw error
  } catch (error) {
    logger.error('Error saving answer:', error)
    throw error
  }
}

export async function submitSimulation(attemptId: string) {
  try {
    const { data, error } = await supabase.rpc('submit_quiz_attempt' as any, {
      p_attempt_id: attemptId
    })

    if (error) throw error
    return data
  } catch (error) {
    logger.error('Error submitting simulation:', error)
    throw error
  }
}

export async function getSimulationResult(attemptId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autorizado')

    const { data, error } = await (supabase as any)
      .from('quiz_attempts')
      .select(`
        *,
        quiz:quizzes(title, type),
        answers:quiz_answers(
          *,
          question:quiz_questions(
            id,
            subject,
            difficulty,
            points
          )
        )
      `)
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    logger.error('Error fetching simulation result:', error)
    throw error
  }
}

export async function getLastAttempt(quizId: string, userId: string) {
  try {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .select('id, status, submitted_at')
      .eq('quiz_id', quizId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  } catch (error) {
    logger.error('Error fetching last attempt:', error)
    throw error
  }
}
