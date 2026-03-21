import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import type { Database, Json } from '@/lib/supabase/types'

export type Essay = Database['public']['Tables']['essays']['Row']
export type EssayPrompt = Database['public']['Tables']['essay_prompts']['Row']
export type EssayAnnotation = Database['public']['Tables']['essay_annotations']['Row']
export type ErrorCategory = Database['public']['Tables']['error_categories']['Row']

export type EssayForCorrection = Essay & {
  essay_prompts: Pick<EssayPrompt, 'title' | 'evaluation_criteria'> | null
  users: {
    first_name: string
    last_name: string
    student_classes: {
      class_id: string
      classes: {
        name: string
      }
    }[]
  } | null
}

export interface StudentEssayDetails {
  id: string
  title: string
  content: string
  status: string
  submitted_at: string
  feedback?: string
  score?: number
  theme: string
}

export const getEssayForCorrection = async (
  submissionId: string,
): Promise<EssayForCorrection | null> => {
  const { data, error } = await supabase
    .from('essays')
    .select(`
      *,
      essay_prompts ( title, evaluation_criteria ),
      users!student_id (
        first_name,
        last_name,
        student_classes (
          class_id,
          classes (
            name
          )
        )
      )
    `)
    .eq('id', submissionId)
    .single()

  if (error) {
    logger.error('Error fetching essay for correction:', error)
    return null
  }

  return (data as unknown) as EssayForCorrection
}

export const getEssaysForComparison = async (
  submissionIds: string[],
): Promise<EssayForCorrection[]> => {
  if (submissionIds.length !== 2) {
    throw new Error('Exactly two submission IDs are required for comparison.')
  }

  const { data, error } = await supabase
    .from('essays')
    .select(`
      *,
      essay_prompts ( title, evaluation_criteria ),
      users!student_id ( first_name, last_name )
    `)
    .in('id', submissionIds)

  if (error) {
    logger.error('Error fetching essays for comparison:', error)
    return []
  }

  return (data as unknown) as EssayForCorrection[]
}

export const getErrorCategories = async (): Promise<ErrorCategory[]> => {
  const { data, error } = await supabase.from('error_categories').select('*')
  if (error) {
    logger.error('Error fetching error categories:', error)
    return []
  }
  return data
}

export const saveCorrection = async (
  submissionId: string,
  teacherId: string,
  payload: {
    final_grade: number
    teacher_feedback_text: string
    annotations: Omit<EssayAnnotation, 'id' | 'created_at' | 'essay_id'>[]
  },
) => {
  const { error: updateError } = await supabase
    .from('essays')
    .update({
      final_grade: payload.final_grade,
      teacher_feedback_text: payload.teacher_feedback_text,
      teacher_id: teacherId,
      status: 'corrected',
      correction_date: new Date().toISOString(),
    })
    .eq('id', submissionId)

  if (updateError) throw updateError

  const annotationsToInsert = payload.annotations.map((anno) => ({
    ...anno,
    essay_id: submissionId,
    teacher_id: teacherId,
  }))

  const { error: annotationError } = await (supabase as any)
    .from('essay_annotations')
    .upsert(annotationsToInsert)

  if (annotationError) throw annotationError

  return { success: true }
}

export const getStudentEssayDetails = async (
  essayId: string,
): Promise<StudentEssayDetails | null> => {
  const { data, error } = await supabase
    .from('essays')
    .select(`
      *,
      essay_prompts ( title, evaluation_criteria ),
      essay_annotations ( * )
    `)
    .eq('id', essayId)
    .single()

  if (error) {
    logger.error('Error fetching student essay details:', error)
    return null
  }
  return (data as unknown) as StudentEssayDetails
}

// Funções para página de listagem de redações
export interface EssayListItem {
  id: string
  theme: string
  date: string
  status: 'Rascunho' | 'Enviada' | 'Corrigindo' | 'Corrigida'
  grade: number | null
}

export interface EssayStatsData {
  totalEssays: number
  averageGrade: number
  averageDays: number
  pending: number
}

export const getUserEssaysList = async (userId: string): Promise<EssayListItem[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== userId) return []

    const { data: essays, error } = await supabase
      .from('essays')
      .select(`
        id,
        status,
        final_grade,
        final_grade_ciaar,
        final_grade_enem,
        correction_type,
        created_at,
        submission_date,
        essay_prompts (
          title
        )
      `)
      .eq('student_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return essays?.map((essay: any) => {
      // Use the most specific grade available
      const grade = essay.final_grade
        ?? (essay.correction_type === 'enem' ? essay.final_grade_enem : essay.final_grade_ciaar)
        ?? null
      return {
        id: essay.id,
        theme: essay.essay_prompts?.title || 'Redação sem título',
        date: new Date(essay.submission_date || essay.created_at).toLocaleDateString('pt-BR'),
        status: mapStatusToPortuguese(essay.status || 'draft'),
        grade,
      }
    }) || []
  } catch (error) {
    logger.error('Erro ao buscar lista de redações:', error)
    return []
  }
}

export const getUserEssayStats = async (userId: string): Promise<EssayStatsData> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== userId) return { totalEssays: 0, averageGrade: 0, averageDays: 0, pending: 0 }

    // Single query with count instead of fetching full list (N+1 fix)
    const [totalResult, correctedResult, pendingResult] = await Promise.all([
      supabase.from('essays').select('id', { count: 'exact', head: true }).eq('student_id', userId),
      supabase.from('essays').select('final_grade').eq('student_id', userId).eq('status', 'corrected').not('final_grade', 'is', null),
      supabase.from('essays').select('id', { count: 'exact', head: true }).eq('student_id', userId).in('status', ['submitted', 'correcting']),
    ])

    const correctedGrades = correctedResult.data || []
    const averageGrade = correctedGrades.length > 0
      ? Math.round(correctedGrades.reduce((sum, e) => sum + (e.final_grade || 0), 0) / correctedGrades.length)
      : 0

    // Calcular tempo médio de correção (dias entre submission_date e correction_date)
    let averageDays = 0
    const { data: correctedEssays } = await supabase
      .from('essays')
      .select('submission_date, correction_date')
      .eq('student_id', userId)
      .eq('status', 'corrected')
      .not('correction_date', 'is', null)
      .not('submission_date', 'is', null)

    if (correctedEssays && correctedEssays.length > 0) {
      const totalDays = correctedEssays.reduce((sum, e) => {
        const sub = new Date(e.submission_date!).getTime()
        const cor = new Date(e.correction_date!).getTime()
        return sum + (cor - sub) / (1000 * 60 * 60 * 24)
      }, 0)
      averageDays = Math.round(totalDays / correctedEssays.length)
    }

    return {
      totalEssays: totalResult.count || 0,
      averageGrade,
      averageDays,
      pending: pendingResult.count || 0
    }
  } catch (error) {
    logger.error('Erro ao buscar estatísticas de redações:', error)
    return {
      totalEssays: 0,
      averageGrade: 0,
      averageDays: 0,
      pending: 0
    }
  }
}

export const submitEssay = async (
  userId: string,
  theme: string,
  content: string,
  file?: File
): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== userId) throw new Error('Não autorizado')

    // 1. Criar um prompt para esta redação (Tema Livre)
    const defaultCriteria = {
      c1: { name: 'Norma Culta', value: 200 },
      c2: { name: 'Compreensão do Tema', value: 200 },
      c3: { name: 'Argumentação', value: 200 },
      c4: { name: 'Coesão', value: 200 },
      c5: { name: 'Proposta de Intervenção', value: 200 }
    }

    const { data: prompt, error: promptError } = await (supabase as any)
      .from('essay_prompts')
      .insert({
        title: theme,
        description: 'Tema livre enviado pelo aluno',
        evaluation_criteria: defaultCriteria,
        created_by_user_id: userId
      })
      .select('id')
      .single()

    if (promptError) throw promptError

    // 2. Upload de arquivo se existir
    let fileUrl = null
    if (file) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${userId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('essays')
        .upload(filePath, file)

      if (uploadError) throw uploadError
      fileUrl = filePath
    }

    // 3. Enviar redação
    const { error: essayError } = await (supabase as any)
      .from('essays')
      .insert({
        student_id: userId,
        prompt_id: prompt.id,
        submission_text: content || '',
        file_url: fileUrl,
        status: 'submitted' as any,
        submission_date: new Date().toISOString()
      })

    if (essayError) throw essayError
    return true
  } catch (error) {
    logger.error('Erro ao enviar redação:', error)
    throw error
  }
}

function mapStatusToPortuguese(status: string): 'Rascunho' | 'Enviada' | 'Corrigindo' | 'Corrigida' {
  switch (status) {
    case 'draft':
      return 'Rascunho'
    case 'correcting':
      return 'Corrigindo'
    case 'corrected':
      return 'Corrigida'
    default:
      return 'Enviada'
  }
}
