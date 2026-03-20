import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

/**
 * Serviço de assistente de IA para diversas funcionalidades pedagógicas.
 * Delega a execução para a Supabase Edge Function (ai-assistant)
 * para manter as chaves de API seguras no servidor.
 */
export const aiAssistantService = {
  /**
   * Audita questões de quiz em busca de erros de texto, opções ou gabarito suspeito.
   */
  async auditQuestions(
    questions: {
      id: string
      question_text: string
      options: any
      correct_answer: string
      question_type: string
    }[]
  ): Promise<{
    results: {
      id: string
      question_text_fixed: string | null
      options_fixed: string[] | null
      correct_answer_suspect: boolean
      suspect_reason: string | null
      explanation: string
    }[]
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'audit_questions',
          questions,
        },
      })

      if (error) {
        throw new Error(`Erro na Edge Function: ${error.message}`)
      }

      if (!data) {
        throw new Error('Resposta vazia da Edge Function')
      }

      return data
    } catch (err) {
      logger.error('Erro ao auditar questões via IA:', err)
      throw err
    }
  },

  /**
   * Gera uma explicação detalhada para uma questão e seu gabarito.
   */
  async explainQuestion(question: {
    question_text: string
    options: string[]
    correct_answer: string
    question_type: string
  }): Promise<{ explanation: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'explain_question',
          ...question,
        },
      })

      if (error) {
        throw new Error(`Erro na Edge Function: ${error.message}`)
      }

      if (!data) {
        throw new Error('Resposta vazia da Edge Function')
      }

      return data
    } catch (err) {
      logger.error('Erro ao explicar questão via IA:', err)
      throw err
    }
  },

  /**
   * Gera um quiz de múltipla escolha ou verdadeiro/falso a partir de um texto de conteúdo.
   */
  async generateQuiz(params: {
    content_text: string
    num_questions: number
    difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
    gen_question_type: 'multiple_choice' | 'true_false' | 'mixed'
  }): Promise<{
    questions: {
      question_text: string
      question_type: string
      options: string[]
      correct_answer: string
      explanation: string
      difficulty: number
      tags: string[]
    }[]
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'generate_quiz',
          ...params,
        },
      })

      if (error) {
        throw new Error(`Erro na Edge Function: ${error.message}`)
      }

      if (!data) {
        throw new Error('Resposta vazia da Edge Function')
      }

      return data
    } catch (err) {
      logger.error('Erro ao gerar quiz via IA:', err)
      throw err
    }
  },

  /**
   * Responde perguntas do aluno sobre o conteúdo de uma aula específica.
   */
  async lessonChat(params: {
    question: string
    lesson_content: string
    lesson_title: string
    module_name: string
  }): Promise<{ answer: string; is_on_topic: boolean }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'lesson_chat',
          ...params,
        },
      })

      if (error) {
        throw new Error(`Erro na Edge Function: ${error.message}`)
      }

      if (!data) {
        throw new Error('Resposta vazia da Edge Function')
      }

      return data
    } catch (err) {
      logger.error('Erro ao enviar mensagem no chat da aula via IA:', err)
      throw err
    }
  },

  /**
   * Gera um plano de estudos personalizado baseado no desempenho e disponibilidade do aluno.
   */
  async generateStudyPlan(params: {
    performance: any
    available_hours_per_week: number
    target_exam: string
  }): Promise<{ diagnosis: any[]; weekly_schedule: any[]; tips: string[] }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'study_plan',
          ...params,
        },
      })

      if (error) {
        throw new Error(`Erro na Edge Function: ${error.message}`)
      }

      if (!data) {
        throw new Error('Resposta vazia da Edge Function')
      }

      return data
    } catch (err) {
      logger.error('Erro ao gerar plano de estudos via IA:', err)
      throw err
    }
  },
}
