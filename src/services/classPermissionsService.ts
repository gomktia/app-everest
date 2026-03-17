import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

/**
 * Service para gerenciar permissões de recursos por turma (class_feature_permissions)
 *
 * Este serviço gerencia o controle granular de acesso de alunos aos recursos
 * da plataforma baseado na turma em que estão matriculados.
 */

export interface ClassFeaturePermission {
  id: string
  class_id: string
  feature_key: string
  created_at: string
  updated_at: string
}

/**
 * Chaves de recursos disponíveis na plataforma
 */
export const FEATURE_KEYS = {
  FLASHCARDS: 'flashcards',
  QUIZ: 'quiz',
  EVERCAST: 'evercast',
  ESSAYS: 'essays',
  VIDEO_LESSONS: 'video_lessons',
  LIVE_EVENTS: 'live_events',
  ACERVO: 'acervo',
  CALENDAR: 'calendar',
  STUDY_PLANNER: 'study_planner',
  RANKING: 'ranking',
  COMMUNITY: 'community',
} as const

export type FeatureKey = typeof FEATURE_KEYS[keyof typeof FEATURE_KEYS]

/**
 * Busca as permissões de recursos de uma turma específica
 */
export const getClassFeaturePermissions = async (
  classId: string
): Promise<ClassFeaturePermission[]> => {
  try {
    const { data, error } = await supabase
      .from('class_feature_permissions')
      .select('*')
      .eq('class_id', classId)

    if (error) {
      logger.error('❌ Erro ao buscar permissões de recursos:', error)
      return []
    }

    return data || []
  } catch (error) {
    logger.error('💥 Erro de rede ao buscar permissões de recursos:', error)
    return []
  }
}

/**
 * Busca as feature_keys permitidas para um usuário específico
 * com base em suas turmas matriculadas
 */
export const getUserAllowedFeatures = async (
  userId: string
): Promise<FeatureKey[]> => {
  try {
    // 1. Buscar turmas do aluno
    const { data: studentClasses, error: classError } = await supabase
      .from('student_classes')
      .select('class_id')
      .eq('user_id', userId)

    if (classError) {
      logger.error('❌ Erro ao buscar turmas do aluno:', classError)
      return []
    }

    if (!studentClasses || studentClasses.length === 0) {
      return []
    }

    const classIds = studentClasses.map(sc => sc.class_id)

    // 2. Buscar permissões de todas as turmas do aluno
    const { data: permissions, error: permError } = await supabase
      .from('class_feature_permissions')
      .select('feature_key')
      .in('class_id', classIds)

    if (permError) {
      logger.error('❌ Erro ao buscar permissões de recursos:', permError)
      return []
    }

    // 3. Remover duplicatas e retornar apenas as feature_keys
    const uniqueFeatures = [...new Set(permissions?.map(p => p.feature_key) || [])]

    return uniqueFeatures as FeatureKey[]
  } catch (error) {
    logger.error('💥 Erro de rede ao buscar recursos permitidos:', error)
    return []
  }
}

/**
 * Verifica se um usuário tem permissão para acessar um recurso específico
 */
export const hasFeaturePermission = async (
  userId: string,
  featureKey: FeatureKey
): Promise<boolean> => {
  try {
    const allowedFeatures = await getUserAllowedFeatures(userId)
    const hasPermission = allowedFeatures.includes(featureKey)

    return hasPermission
  } catch (error) {
    logger.error('💥 Erro ao verificar permissão:', error)
    return false
  }
}

/**
 * Adiciona uma permissão de recurso a uma turma
 * (APENAS para uso administrativo)
 */
export const addClassFeaturePermission = async (
  classId: string,
  featureKey: FeatureKey
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('class_feature_permissions')
      .insert({
        class_id: classId,
        feature_key: featureKey,
      })

    if (error) {
      logger.error('❌ Erro ao adicionar permissão:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    logger.error('💥 Erro de rede ao adicionar permissão:', error)
    return { success: false, error: 'Erro de rede' }
  }
}

/**
 * Remove uma permissão de recurso de uma turma
 * (APENAS para uso administrativo)
 */
export const removeClassFeaturePermission = async (
  classId: string,
  featureKey: FeatureKey
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('class_feature_permissions')
      .delete()
      .eq('class_id', classId)
      .eq('feature_key', featureKey)

    if (error) {
      logger.error('❌ Erro ao remover permissão:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    logger.error('Erro de rede ao remover permissão:', error)
    return { success: false, error: 'Erro de rede' }
  }
}

/**
 * Atualiza todas as permissões de uma turma de uma vez
 * (APENAS para uso administrativo)
 */
export const updateClassFeaturePermissions = async (
  classId: string,
  featureKeys: FeatureKey[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    // 1. Remover todas as permissões existentes
    const { error: deleteError } = await supabase
      .from('class_feature_permissions')
      .delete()
      .eq('class_id', classId)

    if (deleteError) {
      logger.error('❌ Erro ao remover permissões antigas:', deleteError)
      return { success: false, error: deleteError.message }
    }

    // 2. Inserir novas permissões (se houver)
    if (featureKeys.length > 0) {
      const permissions = featureKeys.map(featureKey => ({
        class_id: classId,
        feature_key: featureKey,
      }))

      const { error: insertError } = await supabase
        .from('class_feature_permissions')
        .insert(permissions)

      if (insertError) {
        logger.error('❌ Erro ao inserir novas permissões:', insertError)
        return { success: false, error: insertError.message }
      }
    }

    return { success: true }
  } catch (error) {
    logger.error('💥 Erro de rede ao atualizar permissões:', error)
    return { success: false, error: 'Erro de rede' }
  }
}

export type {
  ClassFeaturePermission as ClassFeaturePermissionType,
}
