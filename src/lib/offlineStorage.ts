/**
 * Sistema de armazenamento offline para Flashcards e Quizzes
 * Usa IndexedDB para persistência de dados
 */

import { openDB, IDBPDatabase } from 'idb'

const DB_NAME = 'everest-offline-db'
const DB_VERSION = 1

const STORES = {
  FLASHCARDS: 'flashcards',
  QUIZZES: 'quizzes',
  QUIZ_PROGRESS: 'quiz_progress',
  FLASHCARD_PROGRESS: 'flashcard_progress',
  SYNC_QUEUE: 'sync_queue',
} as const

export interface CachedFlashcard {
  id: string
  topic_id: string
  subject_id: string
  question: string
  answer: string
  explanation?: string
  difficulty_level: number
  image_url?: string
  cached_at: number
}

export interface CachedQuiz {
  id: string
  title: string
  description?: string
  topic_id?: string
  questions: Array<{
    id: string
    question_text: string
    question_type: string
    options: string[]
    correct_answer: string
    explanation?: string
    points: number
  }>
  duration_minutes?: number
  cached_at: number
}

export interface QuizProgress {
  quiz_id: string
  user_id: string
  answers: Record<string, string>
  started_at: number
  last_updated: number
  synced: boolean
}

export interface FlashcardProgress {
  flashcard_id: string
  user_id: string
  quality: number
  session_id: string
  timestamp: number
  synced: boolean
}

export interface SyncQueueItem {
  id: string
  type: 'quiz_attempt' | 'flashcard_session' | 'flashcard_progress'
  data: any
  timestamp: number
  retries: number
}

class OfflineStorage {
  private db: IDBPDatabase | null = null

  async init(): Promise<void> {
    if (this.db) return

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store para Flashcards
        if (!db.objectStoreNames.contains(STORES.FLASHCARDS)) {
          const flashcardStore = db.createObjectStore(STORES.FLASHCARDS, {
            keyPath: 'id',
          })
          flashcardStore.createIndex('topic_id', 'topic_id', { unique: false })
          flashcardStore.createIndex('subject_id', 'subject_id', {
            unique: false,
          })
        }

        // Store para Quizzes
        if (!db.objectStoreNames.contains(STORES.QUIZZES)) {
          const quizStore = db.createObjectStore(STORES.QUIZZES, {
            keyPath: 'id',
          })
          quizStore.createIndex('topic_id', 'topic_id', { unique: false })
        }

        // Store para progresso de Quiz
        if (!db.objectStoreNames.contains(STORES.QUIZ_PROGRESS)) {
          const quizProgressStore = db.createObjectStore(
            STORES.QUIZ_PROGRESS,
            { keyPath: ['quiz_id', 'user_id'] },
          )
          quizProgressStore.createIndex('synced', 'synced', { unique: false })
        }

        // Store para progresso de Flashcard
        if (!db.objectStoreNames.contains(STORES.FLASHCARD_PROGRESS)) {
          const flashcardProgressStore = db.createObjectStore(
            STORES.FLASHCARD_PROGRESS,
            { autoIncrement: true },
          )
          flashcardProgressStore.createIndex('synced', 'synced', {
            unique: false,
          })
          flashcardProgressStore.createIndex('session_id', 'session_id', {
            unique: false,
          })
        }

        // Store para fila de sincronização
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, {
            keyPath: 'id',
          })
          syncStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      },
    })
  }

  // =====================================================
  // FLASHCARDS
  // =====================================================

  async cacheFlashcards(
    flashcards: CachedFlashcard[],
  ): Promise<void> {
    await this.init()
    if (!this.db) return

    const tx = this.db.transaction(STORES.FLASHCARDS, 'readwrite')
    const store = tx.objectStore(STORES.FLASHCARDS)

    await Promise.all(
      flashcards.map((flashcard) =>
        store.put({
          ...flashcard,
          cached_at: Date.now(),
        }),
      ),
    )

    await tx.done
  }

  async getFlashcardsByTopic(
    topicId: string,
  ): Promise<CachedFlashcard[]> {
    await this.init()
    if (!this.db) return []

    const tx = this.db.transaction(STORES.FLASHCARDS, 'readonly')
    const index = tx.objectStore(STORES.FLASHCARDS).index('topic_id')
    return await index.getAll(topicId)
  }

  async getFlashcardsBySubject(
    subjectId: string,
  ): Promise<CachedFlashcard[]> {
    await this.init()
    if (!this.db) return []

    const tx = this.db.transaction(STORES.FLASHCARDS, 'readonly')
    const index = tx.objectStore(STORES.FLASHCARDS).index('subject_id')
    return await index.getAll(subjectId)
  }

  async saveFlashcardProgress(
    progress: FlashcardProgress,
  ): Promise<void> {
    await this.init()
    if (!this.db) return

    const tx = this.db.transaction(STORES.FLASHCARD_PROGRESS, 'readwrite')
    await tx.objectStore(STORES.FLASHCARD_PROGRESS).add(progress)
    await tx.done

    // Adicionar à fila de sincronização
    if (!progress.synced) {
      await this.addToSyncQueue({
        id: `flashcard_progress_${Date.now()}_${Math.random()}`,
        type: 'flashcard_progress',
        data: progress,
        timestamp: Date.now(),
        retries: 0,
      })
    }
  }

  async getUnsyncedFlashcardProgress(): Promise<FlashcardProgress[]> {
    await this.init()
    if (!this.db) return []

    const tx = this.db.transaction(STORES.FLASHCARD_PROGRESS, 'readonly')
    const index = tx.objectStore(STORES.FLASHCARD_PROGRESS).index('synced')
    // IDBIndex.getAll() requires a valid IDBKey — use 0 instead of boolean false
    return await index.getAll(0)
  }

  async markFlashcardProgressSynced(
    sessionId: string,
  ): Promise<void> {
    await this.init()
    if (!this.db) return

    const tx = this.db.transaction(STORES.FLASHCARD_PROGRESS, 'readwrite')
    const store = tx.objectStore(STORES.FLASHCARD_PROGRESS)
    const index = store.index('session_id')
    const items = await index.getAll(sessionId)

    await Promise.all(
      items.map((item) =>
        store.put({
          ...item,
          synced: true,
        }),
      ),
    )

    await tx.done
  }

  // =====================================================
  // QUIZZES
  // =====================================================

  async cacheQuiz(quiz: CachedQuiz): Promise<void> {
    await this.init()
    if (!this.db) return

    const tx = this.db.transaction(STORES.QUIZZES, 'readwrite')
    await tx.objectStore(STORES.QUIZZES).put({
      ...quiz,
      cached_at: Date.now(),
    })
    await tx.done
  }

  async getQuizById(quizId: string): Promise<CachedQuiz | undefined> {
    await this.init()
    if (!this.db) return undefined

    const tx = this.db.transaction(STORES.QUIZZES, 'readonly')
    return await tx.objectStore(STORES.QUIZZES).get(quizId)
  }

  async getQuizzesByTopic(topicId: string): Promise<CachedQuiz[]> {
    await this.init()
    if (!this.db) return []

    const tx = this.db.transaction(STORES.QUIZZES, 'readonly')
    const index = tx.objectStore(STORES.QUIZZES).index('topic_id')
    return await index.getAll(topicId)
  }

  async saveQuizProgress(progress: QuizProgress): Promise<void> {
    await this.init()
    if (!this.db) return

    const tx = this.db.transaction(STORES.QUIZ_PROGRESS, 'readwrite')
    await tx.objectStore(STORES.QUIZ_PROGRESS).put(progress)
    await tx.done
  }

  async getQuizProgress(
    quizId: string,
    userId: string,
  ): Promise<QuizProgress | undefined> {
    await this.init()
    if (!this.db) return undefined

    const tx = this.db.transaction(STORES.QUIZ_PROGRESS, 'readonly')
    return await tx.objectStore(STORES.QUIZ_PROGRESS).get([quizId, userId])
  }

  async getUnsyncedQuizProgress(): Promise<QuizProgress[]> {
    await this.init()
    if (!this.db) return []

    const tx = this.db.transaction(STORES.QUIZ_PROGRESS, 'readonly')
    const index = tx.objectStore(STORES.QUIZ_PROGRESS).index('synced')
    return await index.getAll(false)
  }

  async markQuizProgressSynced(
    quizId: string,
    userId: string,
  ): Promise<void> {
    await this.init()
    if (!this.db) return

    const tx = this.db.transaction(STORES.QUIZ_PROGRESS, 'readwrite')
    const store = tx.objectStore(STORES.QUIZ_PROGRESS)
    const progress = await store.get([quizId, userId])

    if (progress) {
      await store.put({
        ...progress,
        synced: true,
      })
    }

    await tx.done
  }

  // =====================================================
  // SYNC QUEUE
  // =====================================================

  async addToSyncQueue(item: SyncQueueItem): Promise<void> {
    await this.init()
    if (!this.db) return

    const tx = this.db.transaction(STORES.SYNC_QUEUE, 'readwrite')
    await tx.objectStore(STORES.SYNC_QUEUE).put(item)
    await tx.done
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    await this.init()
    if (!this.db) return []

    const tx = this.db.transaction(STORES.SYNC_QUEUE, 'readonly')
    return await tx.objectStore(STORES.SYNC_QUEUE).getAll()
  }

  async removeFromSyncQueue(id: string): Promise<void> {
    await this.init()
    if (!this.db) return

    const tx = this.db.transaction(STORES.SYNC_QUEUE, 'readwrite')
    await tx.objectStore(STORES.SYNC_QUEUE).delete(id)
    await tx.done
  }

  async incrementRetries(id: string): Promise<void> {
    await this.init()
    if (!this.db) return

    const tx = this.db.transaction(STORES.SYNC_QUEUE, 'readwrite')
    const store = tx.objectStore(STORES.SYNC_QUEUE)
    const item = await store.get(id)

    if (item) {
      await store.put({
        ...item,
        retries: item.retries + 1,
      })
    }

    await tx.done
  }

  // =====================================================
  // UTILITIES
  // =====================================================

  async clearAll(): Promise<void> {
    await this.init()
    if (!this.db) return

    const tx = this.db.transaction(
      [
        STORES.FLASHCARDS,
        STORES.QUIZZES,
        STORES.QUIZ_PROGRESS,
        STORES.FLASHCARD_PROGRESS,
        STORES.SYNC_QUEUE,
      ],
      'readwrite',
    )

    await Promise.all([
      tx.objectStore(STORES.FLASHCARDS).clear(),
      tx.objectStore(STORES.QUIZZES).clear(),
      tx.objectStore(STORES.QUIZ_PROGRESS).clear(),
      tx.objectStore(STORES.FLASHCARD_PROGRESS).clear(),
      tx.objectStore(STORES.SYNC_QUEUE).clear(),
    ])

    await tx.done
  }

  async getCacheSize(): Promise<number> {
    await this.init()
    if (!this.db) return 0

    const tx = this.db.transaction(
      [STORES.FLASHCARDS, STORES.QUIZZES],
      'readonly',
    )

    const [flashcardsCount, quizzesCount] = await Promise.all([
      tx.objectStore(STORES.FLASHCARDS).count(),
      tx.objectStore(STORES.QUIZZES).count(),
    ])

    return flashcardsCount + quizzesCount
  }
}

// Singleton instance
export const offlineStorage = new OfflineStorage()
