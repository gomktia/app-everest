import { supabase } from '@/lib/supabase/client'
import { offlineStorage } from '@/lib/offlineStorage'
import { syncService } from '@/lib/syncService'
import { logger } from '@/lib/logger'

export interface FlashcardSubject {
  id: string
  name: string
  description: string
  image: string
  topics: FlashcardTopic[]
}

export interface FlashcardTopic {
  id: string
  name: string
  description: string
  flashcardCount: number
}

export interface Flashcard {
  id: string
  question: string
  answer: string
  explanation?: string
  difficulty: number
  external_resource_url?: string
}

export interface FlashcardProgress {
  id: string
  flashcard_id: string
  last_reviewed_at: string
  next_review_at?: string
  interval_days: number
  ease_factor: number
  repetitions: number
  quality?: number
}

export interface Subject {
  id: string
  name: string
  description: string
  image: string
}

export interface TopicWithCardCount {
  id: string
  name: string
  description: string
  flashcardCount?: number
  flashcards?: { count: number }[]
  progress?: number
}

export interface TopicWithSubjectAndCards {
  id: string
  name: string
  description: string
  subject: Subject
  flashcards: Flashcard[]
}

export interface SaveSessionPayload {
  topicId: string
  sessionMode: string
  cardsReviewed: number
  correctAnswers: number
  incorrectAnswers: number
  durationSeconds: number
}

// Export individual functions for easier importing
export const getSubjectById = async (subjectId: string): Promise<Subject | null> => {
  try {
    const { data: subject, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', subjectId)
      .single()

    if (error) throw error

    return {
      id: subject.id,
      name: subject.name,
      description: subject.description,
      image: subject.image_url || `https://img.usecurling.com/p/400/200?q=${encodeURIComponent(subject.name)}`
    }
  } catch (error) {
    logger.error('Erro ao buscar matéria:', error)
    return null
  }
}

export const getTopicsBySubjectId = async (subjectId: string, userId?: string | null): Promise<TopicWithCardCount[]> => {
  try {
    const { data: topics, error } = await supabase
      .from('topics')
      .select(`
        id,
        name,
        description,
        flashcards (id)
      `)
      .eq('subject_id', subjectId)
      .order('name')

    if (error) throw error

    const baseTops = topics?.map(topic => ({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      flashcardCount: topic.flashcards?.length || 0,
      flashcards: [{ count: topic.flashcards?.length || 0 }],
      progress: 0,
    })) || []

    if (!userId) return baseTops

    // Collect all flashcard IDs per topic
    const topicCardIds = new Map<string, string[]>()
    topics?.forEach(t => {
      topicCardIds.set(t.id, t.flashcards?.map((f: any) => f.id) || [])
    })

    const allCardIds = Array.from(topicCardIds.values()).flat()
    if (allCardIds.length === 0) return baseTops

    const { data: userProgress } = await supabase
      .from('flashcard_progress')
      .select('flashcard_id, repetitions')
      .eq('user_id', userId)
      .in('flashcard_id', allCardIds)

    const learnedSet = new Set<string>()
    userProgress?.forEach(p => {
      if (p.repetitions > 0) learnedSet.add(p.flashcard_id)
    })

    return baseTops.map(t => {
      const cardIds = topicCardIds.get(t.id) || []
      const learned = cardIds.filter(id => learnedSet.has(id)).length
      return { ...t, progress: cardIds.length > 0 ? Math.round((learned / cardIds.length) * 100) : 0 }
    })
  } catch (error) {
    logger.error('Erro ao buscar tópicos:', error)
    return []
  }
}

export const getTopicWithCards = async (topicId: string): Promise<TopicWithSubjectAndCards | null> => {
  try {
    const { data: topic, error } = await supabase
      .from('topics')
      .select(`
        id,
        name,
        description,
        subjects (
          id,
          name,
          description,
          image_url
        ),
        flashcards (
          id,
          question,
          answer,
          explanation,
          difficulty,
          external_resource_url
        )
      `)
      .eq('id', topicId)
      .single()

    if (error) throw error

    return {
      id: topic.id,
      name: topic.name,
      description: topic.description,
      subject: {
        id: topic.subjects.id,
        name: topic.subjects.name,
        description: topic.subjects.description,
        image: topic.subjects.image_url || `https://img.usecurling.com/p/400/200?q=${encodeURIComponent(topic.subjects.name)}`
      },
      flashcards: topic.flashcards?.map(flashcard => ({
        id: flashcard.id,
        question: flashcard.question,
        answer: flashcard.answer,
        explanation: flashcard.explanation,
        difficulty: flashcard.difficulty,
        external_resource_url: flashcard.external_resource_url
      })) || []
    }
  } catch (error) {
    logger.warn('Erro ao buscar tópico com flashcards:', error)
    return null
  }
}

export const saveFlashcardSession = async (userId: string, payload: SaveSessionPayload): Promise<string | null> => {
  try {
    const { data: session, error } = await supabase
      .from('flashcard_session_history')
      .insert({
        user_id: userId,
        topic_id: payload.topicId,
        session_mode: payload.sessionMode,
        cards_reviewed: payload.cardsReviewed,
        correct_answers: payload.correctAnswers,
        incorrect_answers: payload.incorrectAnswers,
        ended_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (error) throw error

    return session.id
  } catch (error) {
    logger.error('Erro ao salvar sessão de flashcards:', error)
    return null
  }
}

export const updateFlashcardProgress = async (userId: string, flashcardId: string, quality: number): Promise<FlashcardProgress> => {
  try {
    logger.debug('Updating flashcard progress:', { userId, flashcardId, quality })

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Se offline, salvar localmente
    if (!syncService.getOnlineStatus()) {
      logger.debug('Offline - salvando progresso localmente')
      await offlineStorage.saveFlashcardProgress({
        flashcard_id: flashcardId,
        user_id: userId,
        quality,
        session_id: sessionId,
        timestamp: Date.now(),
        synced: false
      })

      // Retornar estrutura compatível
      return {
        id: `offline_${Date.now()}`,
        flashcard_id: flashcardId,
        last_reviewed_at: new Date().toISOString(),
        next_review_at: new Date(Date.now() + 86400000).toISOString(),
        interval_days: 1,
        ease_factor: 2.5,
        repetitions: 0,
        quality
      }
    }

    // Online - processar normalmente
    const { data: existingProgress, error: fetchError } = await supabase
      .from('flashcard_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('flashcard_id', flashcardId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      logger.error('Error fetching existing flashcard progress:', fetchError)
      throw new Error('Failed to fetch flashcard progress')
    }

    let newInterval: number
    let newRepetitions: number
    let newEaseFactor: number
    const now = new Date()

    if (!existingProgress) {
      newRepetitions = quality >= 3 ? 1 : 0
      newInterval = quality >= 3 ? 1 : 0
      newEaseFactor = 2.5
    } else {
      newRepetitions = existingProgress.repetitions || 0
      newEaseFactor = existingProgress.ease_factor || 2.5

      if (quality < 3) {
        newRepetitions = 0
        newInterval = 1
      } else {
        newEaseFactor = newEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        if (newEaseFactor < 1.3) newEaseFactor = 1.3

        if (newRepetitions === 0) {
          newInterval = 1
        } else if (newRepetitions === 1) {
          newInterval = 6
        } else {
          newInterval = Math.round((existingProgress.interval_days || 1) * newEaseFactor)
        }
        newRepetitions++
      }
    }

    const nextReviewAt = new Date(now)
    nextReviewAt.setDate(now.getDate() + newInterval)

    const upsertData = {
      user_id: userId,
      flashcard_id: flashcardId,
      last_reviewed_at: now.toISOString(),
      next_review_at: nextReviewAt.toISOString(),
      interval_days: newInterval,
      ease_factor: newEaseFactor,
      repetitions: newRepetitions,
      quality: quality,
      updated_at: now.toISOString(),
    }

    logger.debug('Upserting data:', upsertData)

    const { data, error } = await supabase
      .from('flashcard_progress')
      .upsert(upsertData, { onConflict: 'user_id,flashcard_id' })
      .select('*')
      .single()

    if (error) {
      logger.error('Error updating flashcard progress:', error)
      throw new Error('Failed to update flashcard progress')
    }

    logger.debug('Flashcard progress updated successfully:', data)
    return data as FlashcardProgress
  } catch (error) {
    logger.error('Error in updateFlashcardProgress:', error)
    throw error
  }
}

export const getDifficultFlashcardsForTopic = async (userId: string, topicId: string, limit: number = 10): Promise<Flashcard[]> => {
  try {
    logger.debug('Getting difficult flashcards for topic:', { userId, topicId })

    const { data: flashcards, error } = await supabase
      .from('flashcards')
      .select(`
        id,
        question,
        answer,
        explanation,
        difficulty,
        external_resource_url,
        flashcard_progress!left (
          ease_factor,
          repetitions,
          user_id
        )
      `)
      .eq('topic_id', topicId)
      .eq('flashcard_progress.user_id', userId)
      .or('flashcard_progress.ease_factor.lt.2.0,flashcard_progress.repetitions.lt.3,flashcard_progress.ease_factor.is.null')
      .limit(limit)

    if (error) {
      logger.error('Error fetching difficult flashcards:', error)
      throw error
    }

    logger.debug('Found difficult flashcards:', flashcards?.length || 0)

    return flashcards?.map(flashcard => ({
      id: flashcard.id,
      question: flashcard.question,
      answer: flashcard.answer,
      explanation: flashcard.explanation,
      difficulty: flashcard.difficulty,
      external_resource_url: flashcard.external_resource_url
    })) || []
  } catch (error) {
    logger.error('Erro ao buscar flashcards difíceis:', error)
    return []
  }
}

export const getFlashcardSessionDetails = async (sessionId: string) => {
  try {
    const { data: session, error } = await supabase
      .from('flashcard_session_history')
      .select(`
        *,
        topics (
          id,
          name,
          description,
          subjects (
            id,
            name
          )
        )
      `)
      .eq('id', sessionId)
      .single()

    if (error) throw error

    return session
  } catch (error) {
    logger.error('Erro ao buscar detalhes da sessão:', error)
    return null
  }
}

export interface FlashcardSession {
  id: string
  topicTitle: string
  subjectName: string
  correct: number
  totalCards: number
  mode: string
  date: string
}

export const getFlashcardSessionHistory = async (userId: string, limit: number = 20): Promise<FlashcardSession[]> => {
  try {
    logger.debug('🔍 Fetching flashcard session history for user:', userId)

    const { data: sessions, error } = await supabase
      .from('flashcard_session_history')
      .select(`
        id,
        session_mode,
        cards_reviewed,
        correct_answers,
        incorrect_answers,
        ended_at,
        topics (
          id,
          name,
          description,
          subjects (
            id,
            name
          )
        )
      `)
      .eq('user_id', userId)
      .order('ended_at', { ascending: false })
      .limit(limit)

    if (error) {
      logger.error('❌ Error fetching session history:', error)
      throw error
    }

    logger.debug('✅ Found sessions:', sessions?.length || 0)

    // Map database structure to expected FlashcardSession interface
    const mappedSessions: FlashcardSession[] = sessions?.map(session => ({
      id: session.id,
      topicTitle: session.topics?.name || 'Tópico desconhecido',
      subjectName: session.topics?.subjects?.name || 'Matéria desconhecida',
      correct: session.correct_answers || 0,
      totalCards: session.cards_reviewed || 0,
      mode: session.session_mode || 'full',
      date: session.ended_at
    })) || []

    return mappedSessions
  } catch (error) {
    logger.error('Erro ao buscar histórico de sessões:', error)
    return []
  }
}

export const flashcardService = {
  // Buscar todas as matérias com flashcards
  async getFlashcardSubjects(): Promise<FlashcardSubject[]> {
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
            flashcards (id)
          )
        `)
        .order('name')

      if (error) throw error

      return subjects?.map(subject => ({
        id: subject.id,
        name: subject.name,
        description: subject.description,
        image: subject.image_url || `https://img.usecurling.com/p/400/200?q=${encodeURIComponent(subject.name)}`,
        topics: subject.topics?.map(topic => ({
          id: topic.id,
          name: topic.name,
          description: topic.description,
          flashcardCount: topic.flashcards?.length || 0
        })) || []
      })) || []
    } catch (error) {
      logger.error('Erro ao buscar matérias de flashcards:', error)
      return []
    }
  },

  // Buscar flashcards de um tópico (com suporte offline)
  async getFlashcardsByTopic(topicId: string): Promise<Flashcard[]> {
    try {
      // Tentar buscar do Supabase primeiro
      const { data: flashcards, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('topic_id', topicId)
        .order('created_at')

      if (error) throw error

      const result = flashcards?.map(flashcard => ({
        id: flashcard.id,
        question: flashcard.question,
        answer: flashcard.answer,
        explanation: flashcard.explanation,
        difficulty: flashcard.difficulty,
        external_resource_url: flashcard.external_resource_url
      })) || []

      // Cachear para uso offline
      if (result.length > 0 && syncService.getOnlineStatus()) {
        await offlineStorage.cacheFlashcards(
          result.map(f => ({
            id: f.id,
            topic_id: topicId,
            subject_id: '', // Será preenchido se necessário
            question: f.question,
            answer: f.answer,
            explanation: f.explanation,
            difficulty_level: f.difficulty,
            image_url: f.external_resource_url,
            cached_at: Date.now()
          }))
        )
      }

      return result
    } catch (error) {
      logger.error('Erro ao buscar flashcards do tópico online:', error)

      // Fallback para cache offline
      logger.debug('Tentando buscar flashcards do cache offline...')
      const cachedFlashcards = await offlineStorage.getFlashcardsByTopic(topicId)

      return cachedFlashcards.map(f => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        explanation: f.explanation,
        difficulty: f.difficulty_level,
        external_resource_url: f.image_url
      }))
    }
  },

  // Buscar progresso do usuário em flashcards
  async getUserFlashcardProgress(userId: string, topicId?: string): Promise<Record<string, FlashcardProgress>> {
    try {
      let query = supabase
        .from('flashcard_progress')
        .select('*')
        .eq('user_id', userId)

      if (topicId) {
        // Primeiro buscar os IDs dos flashcards do tópico
        const { data: flashcardIds } = await supabase
          .from('flashcards')
          .select('id')
          .eq('topic_id', topicId)

        if (flashcardIds && flashcardIds.length > 0) {
          query = query.in('flashcard_id', flashcardIds.map(f => f.id))
        }
      }

      const { data: progress, error } = await query

      if (error) throw error

      const progressMap: Record<string, FlashcardProgress> = {}
      progress?.forEach(p => {
        progressMap[p.flashcard_id] = {
          id: p.id,
          flashcard_id: p.flashcard_id,
          last_reviewed_at: p.last_reviewed_at,
          next_review_at: p.next_review_at,
          interval_days: p.interval_days,
          ease_factor: p.ease_factor,
          repetitions: p.repetitions,
          quality: p.quality
        }
      })

      return progressMap
    } catch (error) {
      logger.error('Erro ao buscar progresso dos flashcards:', error)
      return {}
    }
  },


  // Buscar flashcards para revisão
  async getFlashcardsForReview(userId: string, topicId?: string): Promise<Flashcard[]> {
    try {
      const now = new Date().toISOString()

      let query = supabase
        .from('flashcards')
        .select(`
          id,
          question,
          answer,
          explanation,
          difficulty,
          external_resource_url,
          flashcard_progress!left (
            next_review_at,
            repetitions
          )
        `)

      if (topicId) {
        query = query.eq('topic_id', topicId)
      }

      const { data: flashcards, error } = await query

      if (error) throw error

      // Filtrar flashcards que precisam de revisão
      const flashcardsForReview = flashcards?.filter(flashcard => {
        const progress = flashcard.flashcard_progress?.[0]
        if (!progress) return true // Novo flashcard
        return !progress.next_review_at || new Date(progress.next_review_at) <= new Date(now)
      }) || []

      return flashcardsForReview.map(flashcard => ({
        id: flashcard.id,
        question: flashcard.question,
        answer: flashcard.answer,
        explanation: flashcard.explanation,
        difficulty: flashcard.difficulty,
        external_resource_url: flashcard.external_resource_url
      }))
    } catch (error) {
      logger.error('Erro ao buscar flashcards para revisão:', error)
      return []
    }
  },

  // Buscar matéria por ID
  async getSubjectById(subjectId: string): Promise<Subject | null> {
    try {
      const { data: subject, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('id', subjectId)
        .single()

      if (error) throw error

      return {
        id: subject.id,
        name: subject.name,
        description: subject.description,
        image: subject.image_url || `https://img.usecurling.com/p/400/200?q=${encodeURIComponent(subject.name)}`
      }
    } catch (error) {
      logger.error('Erro ao buscar matéria:', error)
      return null
    }
  },

  // Buscar tópicos por ID da matéria
  async getTopicsBySubjectId(subjectId: string): Promise<TopicWithCardCount[]> {
    try {
      const { data: topics, error } = await supabase
        .from('topics')
        .select(`
          id,
          name,
          description,
          flashcards (id)
        `)
        .eq('subject_id', subjectId)
        .order('name')

      if (error) throw error

      return topics?.map(topic => ({
        id: topic.id,
        name: topic.name,
        description: topic.description,
        flashcardCount: topic.flashcards?.length || 0
      })) || []
    } catch (error) {
      logger.error('Erro ao buscar tópicos:', error)
      return []
    }
  },

  // Buscar tópico com flashcards
  async getTopicWithCards(topicId: string): Promise<TopicWithSubjectAndCards | null> {
    try {
      const { data: topic, error } = await supabase
        .from('topics')
        .select(`
          id,
          name,
          description,
          subjects (
            id,
            name,
            description,
            image_url
          ),
          flashcards (
            id,
            question,
            answer,
            explanation,
            difficulty,
            external_resource_url
          )
        `)
        .eq('id', topicId)
        .single()

      if (error) throw error

      return {
        id: topic.id,
        name: topic.name,
        description: topic.description,
        subject: {
          id: topic.subjects.id,
          name: topic.subjects.name,
          description: topic.subjects.description,
          image: topic.subjects.image_url || `https://img.usecurling.com/p/400/200?q=${encodeURIComponent(topic.subjects.name)}`
        },
        flashcards: topic.flashcards?.map(flashcard => ({
          id: flashcard.id,
          question: flashcard.question,
          answer: flashcard.answer,
          explanation: flashcard.explanation,
          difficulty: flashcard.difficulty,
          external_resource_url: flashcard.external_resource_url
        })) || []
      }
    } catch (error) {
      logger.warn('Erro ao buscar tópico com flashcards:', error)
      return null
    }
  },

  // Salvar sessão de flashcards
  async saveFlashcardSession(userId: string, payload: SaveSessionPayload): Promise<string | null> {
    try {
      const { data: session, error } = await supabase
        .from('flashcard_session_history')
        .insert({
          user_id: userId,
          topic_id: payload.topicId,
          session_mode: payload.sessionMode,
          cards_reviewed: payload.cardsReviewed,
          correct_answers: payload.correctAnswers,
          incorrect_answers: payload.incorrectAnswers,
          ended_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (error) throw error

      return session.id
    } catch (error) {
      logger.error('Erro ao salvar sessão de flashcards:', error)
      return null
    }
  },

  // Buscar flashcards difíceis para um tópico
  async getDifficultFlashcardsForTopic(userId: string, topicId: string): Promise<Flashcard[]> {
    try {
      const { data: flashcards, error } = await supabase
        .from('flashcards')
        .select(`
          id,
          question,
          answer,
          explanation,
          difficulty,
          external_resource_url,
          flashcard_progress!left (
            ease_factor,
            repetitions
          )
        `)
        .eq('topic_id', topicId)
        .or('flashcard_progress.ease_factor.lt.2.0,flashcard_progress.repetitions.lt.3')

      if (error) throw error

      return flashcards?.map(flashcard => ({
        id: flashcard.id,
        question: flashcard.question,
        answer: flashcard.answer,
        explanation: flashcard.explanation,
        difficulty: flashcard.difficulty,
        external_resource_url: flashcard.external_resource_url
      })) || []
    } catch (error) {
      logger.error('Erro ao buscar flashcards difíceis:', error)
      return []
    }
  },
}

export type FlashcardUpsert = {
  id?: string
  topic_id: string
  question: string
  answer: string
  external_resource_url?: string | null
  difficulty?: number
  explanation?: string
  order_index?: number
}

export const saveFlashcards = async (
  topicId: string,
  flashcards: FlashcardUpsert[]
): Promise<void> => {
  // 1. Get existing to determine deletes
  const { data: existing, error: fetchError } = await supabase
    .from('flashcards')
    .select('id')
    .eq('topic_id', topicId)

  if (fetchError) throw fetchError

  const existingIds = new Set(existing?.map(f => f.id) || [])
  const newIds = new Set(flashcards.filter(f => f.id).map(f => f.id))

  // 2. Delete removed
  const toDelete = [...existingIds].filter(id => !newIds.has(id))

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('flashcards')
      .delete()
      .in('id', toDelete)

    if (deleteError) throw deleteError
  }

  // 3. Upsert
  for (const fc of flashcards) {
    const { id, ...data } = fc

    // Ensure we don't send undefined fields that shouldn't be touched if not present
    // But for a form replacement, we usually want to overwrite.

    if (id) {
      const { error } = await supabase
        .from('flashcards')
        .update(data)
        .eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('flashcards')
        .insert(data)
      if (error) throw error
    }
  }
}