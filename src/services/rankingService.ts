import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

// In-memory flag to prevent concurrent checkAndGrantAchievements executions
const _achievementCheckInProgress = new Set<string>()

export interface UserRanking {
  user_id: string
  first_name: string
  last_name: string
  email: string
  rank_position: number
  total_xp: number
  total_xp_activity?: number
  total_xp_general?: number
  role: 'student' | 'teacher' | 'administrator'
}

export interface UserPosition {
  user_id: string
  first_name: string
  last_name: string
  email: string
  rank_position: number
  total_xp: number
  role: 'student' | 'teacher' | 'administrator'
}

export interface SubjectRanking {
  user_id: string
  first_name: string
  last_name: string
  email: string
  rank_position: number
  total_xp_activity: number
  total_xp_general: number
}

export interface ScoreHistory {
  id: string
  activity_id: string
  activity_type: string
  score_value: number
  recorded_at: string
}

export interface XPStatistics {
  total_users: number
  total_xp_distributed: number
  average_xp: number
  max_xp: number
  min_xp: number
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon_url?: string
  xp_reward: number
  created_at: string
}

export interface UserAchievement {
  id: string
  user_id: string
  achievement_id: string
  achieved_at: string
  achievement: Achievement
}

export interface LevelInfo {
  level: number
  title: string
  min_xp: number
  max_xp: number
  color: string
  icon: string
  description: string
}

export const rankingService = {
  // Buscar ranking geral de usuários
  async getUserRanking(limit: number = 50): Promise<UserRanking[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_ranking', {
        p_limit: limit
      })

      if (error) throw error
      return data || []
    } catch (error) {
      logger.warn('Erro ao buscar ranking de usuários:', error)
      return []
    }
  },

  // Buscar posição específica do usuário
  async getUserPosition(userId: string): Promise<UserPosition | null> {
    try {
      const { data, error } = await supabase.rpc('get_user_rank_position', {
        p_user_id: userId
      })

      if (error) throw error
      return data?.[0] || null
    } catch (error) {
      logger.warn('Erro ao buscar posição do usuário:', error)
      return null
    }
  },

  // Buscar ranking por tipo de atividade
  async getRankingByActivity(activityType: string, limit: number = 50): Promise<SubjectRanking[]> {
    try {
      const { data, error } = await supabase.rpc('get_ranking_by_activity_type', {
        p_activity_type: activityType,
        p_limit: limit
      })

      if (error) throw error
      return data || []
    } catch (error) {
      logger.warn('Erro ao buscar ranking por atividade:', error)
      return []
    }
  },

  // Adicionar pontuação para usuário
  async addUserScore(
    userId: string, 
    activityType: string, 
    scoreValue: number, 
    activityId?: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('add_user_score', {
        p_user_id: userId,
        p_activity_type: activityType,
        p_score_value: scoreValue,
        p_activity_id: activityId
      })

      if (error) throw error
      return true
    } catch (error) {
      logger.error('Erro ao adicionar pontuação:', error)
      return false
    }
  },

  // Buscar histórico de pontuação do usuário
  async getUserScoreHistory(userId: string, limit: number = 20): Promise<ScoreHistory[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_score_history', {
        p_user_id: userId,
        p_limit: limit
      })

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('Erro ao buscar histórico de pontuação:', error)
      return []
    }
  },

  // Buscar estatísticas gerais de XP
  async getXPStatistics(): Promise<XPStatistics | null> {
    try {
      const { data, error } = await supabase.rpc('get_xp_statistics')

      if (error) throw error
      return data?.[0] || null
    } catch (error) {
      logger.error('Erro ao buscar estatísticas de XP:', error)
      return null
    }
  },

  // Buscar conquistas disponíveis
  async getAchievements(): Promise<Achievement[]> {
    try {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('xp_reward', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      logger.warn('Erro ao buscar conquistas:', error)
      return []
    }
  },

  // Buscar conquistas do usuário
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievement:achievements(*)
        `)
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      logger.warn('Erro ao buscar conquistas do usuário:', error)
      return []
    }
  },

  // Verificar e conceder conquistas
  async checkAndGrantAchievements(userId: string): Promise<UserAchievement[]> {
    // Prevent concurrent execution for the same user (called from multiple pages)
    if (_achievementCheckInProgress.has(userId)) {
      logger.debug('checkAndGrantAchievements already in progress for user, skipping')
      return []
    }
    _achievementCheckInProgress.add(userId)
    try {
      // Buscar conquistas já obtidas
      const userAchievements = await this.getUserAchievements(userId)
      const achievedIds = userAchievements.map(ua => ua.achievement_id)

      // Buscar todas as conquistas
      const allAchievements = await this.getAchievements()
      const availableAchievements = allAchievements.filter(a => !achievedIds.includes(a.id))

      // Buscar estatísticas do usuário para verificar conquistas
      const userPosition = await this.getUserPosition(userId)
      const scoreHistory = await this.getUserScoreHistory(userId, 100)

      const newAchievements: UserAchievement[] = []

      // Contadores por tipo de atividade
      const activityCounts: Record<string, number> = {}
      for (const score of scoreHistory) {
        activityCounts[score.activity_type] = (activityCounts[score.activity_type] || 0) + 1
      }

      const totalXP = userPosition?.total_xp || 0
      const rankPos = userPosition?.rank_position || 999

      for (const achievement of availableAchievements) {
        let shouldGrant = false
        const name = achievement.name.toLowerCase()

        // ── Conquistas de marco (login/XP/nível) ──
        if (name === 'primeiro login') {
          shouldGrant = scoreHistory.length > 0
        } else if (name === 'estudante dedicado') {
          shouldGrant = totalXP >= 100
        } else if (name === 'especialista') {
          shouldGrant = totalXP >= 500
        } else if (name === 'mestre' || name === 'mestre do conhecimento') {
          shouldGrant = totalXP >= 1000
        } else if (name === 'lenda') {
          shouldGrant = totalXP >= 2000

        // ── Conquistas de ranking ──
        } else if (name === 'top 10') {
          shouldGrant = rankPos <= 10
        } else if (name === 'top 3') {
          shouldGrant = rankPos <= 3
        } else if (name === 'número 1') {
          shouldGrant = rankPos === 1

        // ── Conquistas de streak/atividade ──
        } else if (name === 'maratonista') {
          shouldGrant = scoreHistory.length >= 7
        } else if (name === 'imparável') {
          shouldGrant = scoreHistory.length >= 30
        } else if (name === 'centurião') {
          shouldGrant = scoreHistory.length >= 100

        // ── Conquistas de aulas ──
        } else if (name === 'primeira aula') {
          shouldGrant = (activityCounts['video_lesson'] || activityCounts['lesson_complete'] || 0) >= 1
        } else if (name === 'assistiu 10 aulas') {
          shouldGrant = (activityCounts['video_lesson'] || activityCounts['lesson_complete'] || 0) >= 10
        } else if (name === 'assistiu 50 aulas') {
          shouldGrant = (activityCounts['video_lesson'] || activityCounts['lesson_complete'] || 0) >= 50
        } else if (name === 'assistiu 100 aulas') {
          shouldGrant = (activityCounts['video_lesson'] || activityCounts['lesson_complete'] || 0) >= 100

        // ── Conquistas de comentários ──
        } else if (name === 'comentarista') {
          shouldGrant = ((activityCounts['lesson_comment'] || 0) + (activityCounts['community_comment'] || 0)) >= 5
        } else if (name === 'participativo') {
          shouldGrant = ((activityCounts['lesson_comment'] || 0) + (activityCounts['community_comment'] || 0)) >= 20
        } else if (name === 'debatedor') {
          shouldGrant = ((activityCounts['lesson_comment'] || 0) + (activityCounts['community_comment'] || 0)) >= 50

        // ── Conquistas de avaliações ──
        } else if (name === 'avaliador') {
          shouldGrant = (activityCounts['lesson_rating'] || 0) >= 10
        } else if (name === 'crítico') {
          shouldGrant = (activityCounts['lesson_rating'] || 0) >= 30

        // ── Conquistas de flashcards ──
        } else if (name === 'flashcard iniciante') {
          shouldGrant = (activityCounts['flashcard'] || 0) >= 1
        } else if (name === 'flashcard master') {
          shouldGrant = (activityCounts['flashcard'] || 0) >= 20
        } else if (name === 'memória de elefante') {
          shouldGrant = (activityCounts['flashcard'] || 0) >= 50

        // ── Conquistas de quizzes ──
        } else if (name === 'primeiro quiz') {
          shouldGrant = (activityCounts['quiz'] || 0) >= 1
        } else if (name === 'quiz champion') {
          shouldGrant = (activityCounts['quiz'] || 0) >= 10
        } else if (name === 'mestre dos quizzes') {
          shouldGrant = (activityCounts['quiz'] || 0) >= 30

        // ── Conquistas de comunidade ──
        } else if (name === 'primeiro post') {
          shouldGrant = (activityCounts['community_post'] || 0) >= 1
        } else if (name === 'comunicador') {
          shouldGrant = (activityCounts['community_post'] || 0) >= 5
        } else if (name === 'influencer') {
          shouldGrant = (activityCounts['community_post'] || 0) >= 20
        } else if (name === 'colaborador') {
          shouldGrant = ((activityCounts['community_reply'] || 0) + (activityCounts['community_comment'] || 0)) >= 10
        } else if (name === 'popular') {
          shouldGrant = (activityCounts['community_reaction'] || 0) >= 50

        // ── Conquistas de simulados ──
        } else if (name === 'simulado completo') {
          shouldGrant = (activityCounts['simulation'] || 0) >= 1
        } else if (name === 'simulador nato') {
          shouldGrant = (activityCounts['simulation'] || 0) >= 10

        // ── Conquistas de redação ──
        } else if (name === 'escritor') {
          shouldGrant = (activityCounts['essay'] || 0) >= 1
        } else if (name === 'autor dedicado') {
          shouldGrant = (activityCounts['essay'] || 0) >= 5
        }

        if (shouldGrant) {
          // Use upsert with onConflict to prevent duplicate achievements and double-XP
          const { data, error } = await supabase
            .from('user_achievements')
            .upsert({
              user_id: userId,
              achievement_id: achievement.id
            }, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true })
            .select(`
              *,
              achievement:achievements(*)
            `)
            .single()

          // Only grant XP for truly new achievements (not duplicates)
          if (!error && data) {
            newAchievements.push(data)
            await this.addUserScore(userId, 'achievement', achievement.xp_reward, achievement.id)
          }
        }
      }

      return newAchievements
    } catch (error) {
      logger.error('Erro ao verificar conquistas:', error)
      return []
    } finally {
      _achievementCheckInProgress.delete(userId)
    }
  },

  // Calcular informações do nível do usuário
  calculateLevelInfo(totalXP: number): LevelInfo {
    const levels: LevelInfo[] = [
      {
        level: 1,
        title: 'Iniciante',
        min_xp: 0,
        max_xp: 1000,
        color: 'from-gray-400 to-gray-600',
        icon: '🥉',
        description: 'Começando sua jornada de aprendizado'
      },
      {
        level: 2,
        title: 'Estudante',
        min_xp: 1001,
        max_xp: 2500,
        color: 'from-blue-400 to-blue-600',
        icon: '🥈',
        description: 'Desenvolvendo suas habilidades'
      },
      {
        level: 3,
        title: 'Aprendiz',
        min_xp: 2501,
        max_xp: 5000,
        color: 'from-green-400 to-green-600',
        icon: '🥇',
        description: 'Demonstrando dedicação'
      },
      {
        level: 4,
        title: 'Especialista',
        min_xp: 5001,
        max_xp: 10000,
        color: 'from-purple-400 to-purple-600',
        icon: '💎',
        description: 'Dominando o conhecimento'
      },
      {
        level: 5,
        title: 'Mestre',
        min_xp: 10001,
        max_xp: 20000,
        color: 'from-orange-400 to-orange-600',
        icon: '👑',
        description: 'Líder em aprendizado'
      },
      {
        level: 6,
        title: 'Lenda',
        min_xp: 20001,
        max_xp: 999999,
        color: 'from-yellow-400 to-yellow-600',
        icon: '🌟',
        description: 'Ícone do conhecimento'
      }
    ]

    const currentLevel = levels.find(level => totalXP >= level.min_xp && totalXP <= level.max_xp) || levels[0]
    const nextLevel = levels.find(level => level.level === currentLevel.level + 1)
    
    return {
      ...currentLevel,
      max_xp: nextLevel ? nextLevel.min_xp - 1 : currentLevel.max_xp
    }
  },

  // Calcular progresso para próximo nível
  calculateProgressToNext(totalXP: number): { progress: number; xpToNext: number } {
    const levelInfo = this.calculateLevelInfo(totalXP)
    const xpInLevel = totalXP - levelInfo.min_xp
    const xpNeededForLevel = levelInfo.max_xp - levelInfo.min_xp
    const progress = Math.min(100, (xpInLevel / xpNeededForLevel) * 100)
    const xpToNext = Math.max(0, levelInfo.max_xp - totalXP)

    return { progress, xpToNext }
  }
}
