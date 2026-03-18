import { supabase } from '@/lib/supabase/client'

export interface Achievement {
  id: string
  name: string
  description: string
  icon_url: string
  xp_reward: number
  category: string
  created_at: string
  unlocked_count?: number
}

export interface UserAchievement {
  id: string
  user_id: string
  achievement_id: string
  achieved_at: string
  achievement?: Achievement
}

export interface RankingEntry {
  user_id: string
  email: string
  first_name: string
  last_name: string
  total_xp: number
  level: number
  achievements_count: number
  position: number
}

export interface UserProgress {
  user_id: string
  total_xp: number
  level: number
  current_streak_days: number
  longest_streak_days: number
  last_activity_date: string
}

// Build XP totals from scores table (the actual source of truth)
// Batches requests to avoid hitting Supabase's .in() limit (~300 items)
async function getXPFromScores(userIds: string[]): Promise<Map<string, number>> {
  const xpMap = new Map<string, number>()
  const BATCH_SIZE = 200

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase
      .from('scores')
      .select('user_id, score_value')
      .in('user_id', batch)

    if (!error && data) {
      for (const row of data) {
        xpMap.set(row.user_id, (xpMap.get(row.user_id) || 0) + (row.score_value || 0))
      }
    }
  }

  return xpMap
}

// Achievements (optimized: 2 queries instead of 1+N)
export async function getAchievements(): Promise<Achievement[]> {
  const [achievementsResult, countsResult] = await Promise.all([
    supabase
      .from('achievements')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('user_achievements')
      .select('achievement_id'),
  ])

  if (achievementsResult.error) throw achievementsResult.error

  // Count unlocks per achievement in memory
  const unlockCounts = new Map<string, number>()
  for (const ua of countsResult.data || []) {
    unlockCounts.set(ua.achievement_id, (unlockCounts.get(ua.achievement_id) || 0) + 1)
  }

  return (achievementsResult.data || []).map(achievement => ({
    ...achievement,
    unlocked_count: unlockCounts.get(achievement.id) || 0,
  }))
}

export async function createAchievement(achievement: {
  name: string
  description: string
  icon_url: string
  xp_reward: number
  category: string
}): Promise<Achievement> {
  const { data, error } = await supabase
    .from('achievements')
    .insert(achievement)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateAchievement(
  achievementId: string,
  updates: Partial<Achievement>
): Promise<Achievement> {
  const { data, error } = await supabase
    .from('achievements')
    .update(updates)
    .eq('id', achievementId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteAchievement(achievementId: string): Promise<void> {
  const { error } = await supabase
    .from('achievements')
    .delete()
    .eq('id', achievementId)

  if (error) throw error
}

// User Achievements
export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
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
}

export async function unlockAchievement(userId: string, achievementId: string): Promise<void> {
  const { error } = await supabase
    .from('user_achievements')
    .insert({
      user_id: userId,
      achievement_id: achievementId
    })

  if (error) throw error
}

// Ranking by Class (turma) - uses RPC to aggregate at DB level
export async function getRankingByClass(classId: string, limit: number = 50): Promise<RankingEntry[]> {
  try {
    // Try RPC first (single query, aggregated at DB level)
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_ranking_by_class', {
      p_class_id: classId,
      ranking_limit: limit,
    })

    if (!rpcError && rpcData && rpcData.length > 0) {
      return (rpcData as any[]).map((row, index) => ({
        user_id: row.user_id,
        email: row.email || '',
        first_name: row.first_name || '',
        last_name: row.last_name || '',
        total_xp: row.total_xp || 0,
        level: calculateLevel(row.total_xp || 0),
        achievements_count: row.achievements_count || 0,
        position: index + 1,
      }))
    }

    // Fallback: client-side aggregation
    const { data: classStudents, error: classError } = await supabase
      .from('student_classes')
      .select('user_id')
      .eq('class_id', classId)

    if (classError || !classStudents || classStudents.length === 0) return []

    const studentIds = classStudents.map(s => s.user_id)

    const [xpMap, usersResult, achievementsResult] = await Promise.all([
      getXPFromScores(studentIds),
      supabase.from('users').select('id, email, first_name, last_name').in('id', studentIds),
      supabase.from('user_achievements').select('user_id').in('user_id', studentIds),
    ])

    const usersMap = new Map((usersResult.data || []).map(u => [u.id, u]))
    const achievementCounts = new Map<string, number>()
    for (const ua of achievementsResult.data || []) {
      achievementCounts.set(ua.user_id, (achievementCounts.get(ua.user_id) || 0) + 1)
    }

    const entries: RankingEntry[] = studentIds
      .map(uid => {
        const user = usersMap.get(uid)
        const totalXp = xpMap.get(uid) || 0
        return {
          user_id: uid,
          email: user?.email || '',
          first_name: user?.first_name || '',
          last_name: user?.last_name || '',
          total_xp: totalXp,
          level: calculateLevel(totalXp),
          achievements_count: achievementCounts.get(uid) || 0,
          position: 0,
        }
      })
      .sort((a, b) => b.total_xp - a.total_xp)
      .slice(0, limit)

    return entries.map((entry, index) => ({ ...entry, position: index + 1 }))
  } catch {
    return []
  }
}

// Get student's class IDs
export async function getStudentClassIds(userId: string): Promise<{ class_id: string; class_name: string }[]> {
  try {
    const { data, error } = await supabase
      .from('student_classes')
      .select('class_id, classes(name)')
      .eq('user_id', userId)

    if (error || !data) return []

    return data.map((sc: any) => ({
      class_id: sc.class_id,
      class_name: sc.classes?.name || 'Turma'
    }))
  } catch {
    return []
  }
}

// Ranking - uses RPC to aggregate at DB level (no full table scan)
export async function getRanking(limit: number = 50): Promise<RankingEntry[]> {
  try {
    // Try RPC first (single query, aggregated at DB level)
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_ranking', { ranking_limit: limit })

    if (!rpcError && rpcData && rpcData.length > 0) {
      return (rpcData as any[]).map((row, index) => ({
        user_id: row.user_id,
        email: row.email || '',
        first_name: row.first_name || '',
        last_name: row.last_name || '',
        total_xp: row.total_xp || 0,
        level: calculateLevel(row.total_xp || 0),
        achievements_count: row.achievements_count || 0,
        position: index + 1,
      }))
    }

    // Fallback: client-side aggregation with limited data (top scores only)
    const { data: scoresData, error: scoresError } = await supabase
      .from('scores')
      .select('user_id, score_value')
      .order('score_value', { ascending: false })
      .limit(100)

    if (scoresError || !scoresData || scoresData.length === 0) return []

    const xpMap = new Map<string, number>()
    for (const row of scoresData) {
      xpMap.set(row.user_id, (xpMap.get(row.user_id) || 0) + (row.score_value || 0))
    }

    const topUsers = Array.from(xpMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)

    const userIds = topUsers.map(([uid]) => uid)

    const [usersResult, achievementsResult] = await Promise.all([
      supabase.from('users').select('id, email, first_name, last_name').in('id', userIds),
      supabase.from('user_achievements').select('user_id').in('user_id', userIds),
    ])

    const usersMap = new Map((usersResult.data || []).map(u => [u.id, u]))
    const achievementCounts = new Map<string, number>()
    for (const ua of achievementsResult.data || []) {
      achievementCounts.set(ua.user_id, (achievementCounts.get(ua.user_id) || 0) + 1)
    }

    return topUsers.map(([uid, totalXp], index) => {
      const user = usersMap.get(uid)
      return {
        user_id: uid,
        email: user?.email || '',
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        total_xp: totalXp,
        level: calculateLevel(totalXp),
        achievements_count: achievementCounts.get(uid) || 0,
        position: index + 1,
      }
    })
  } catch {
    return []
  }
}

// User Progress - built from scores table
export async function getUserProgress(userId: string): Promise<UserProgress | null> {
  try {
    const { data: scoresData, error } = await supabase
      .from('scores')
      .select('score_value, recorded_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })

    if (error || !scoresData || scoresData.length === 0) return null

    const totalXp = scoresData.reduce((sum, s) => sum + (s.score_value || 0), 0)
    const lastActivity = scoresData[0]?.recorded_at || new Date().toISOString()

    // Calculate streak from activity dates
    const activityDates = [...new Set(
      scoresData
        .filter(s => s.recorded_at)
        .map(s => new Date(s.recorded_at).toISOString().split('T')[0])
    )].sort().reverse()

    let currentStreak = 0
    if (activityDates.length > 0) {
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

      if (activityDates[0] === today || activityDates[0] === yesterday) {
        currentStreak = 1
        for (let i = 1; i < activityDates.length; i++) {
          const prev = new Date(activityDates[i - 1])
          const curr = new Date(activityDates[i])
          const diffDays = (prev.getTime() - curr.getTime()) / 86400000
          if (diffDays <= 1) currentStreak++
          else break
        }
      }
    }

    return {
      user_id: userId,
      total_xp: totalXp,
      level: calculateLevel(totalXp),
      current_streak_days: currentStreak,
      longest_streak_days: currentStreak, // approximation
      last_activity_date: lastActivity.split('T')[0],
    }
  } catch {
    return null
  }
}

/**
 * Calcula nível baseado no XP total.
 *   Nv 1: 0–1000 | Nv 2: 1001–2500 | Nv 3: 2501–5000
 *   Nv 4: 5001–10000 | Nv 5: 10001–20000 | Nv 6: 20001+
 */
function calculateLevel(totalXP: number): number {
  if (totalXP <= 1000) return 1
  if (totalXP <= 2500) return 2
  if (totalXP <= 5000) return 3
  if (totalXP <= 10000) return 4
  if (totalXP <= 20000) return 5
  return 6
}

export async function addXP(
  userId: string,
  xpAmount: number,
  activityType: string,
  activityId?: string
): Promise<void> {
  // Record in scores table (single source of truth for XP)
  const { error } = await supabase
    .from('scores')
    .insert({
      user_id: userId,
      score_value: xpAmount,
      activity_type: activityType,
      activity_id: activityId
    })

  if (error) throw error
}

// Global Stats - uses RPC to aggregate at DB level
export async function getGamificationStats() {
  try {
    // Try RPC first (1 query)
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_gamification_stats')
    if (!rpcError && rpcData) {
      const d = rpcData as any
      return {
        totalAchievements: d.total_achievements || 0,
        totalUnlocked: d.total_unlocked || 0,
        totalXP: d.total_xp || 0,
        activeUsers: d.active_users || 0,
      }
    }

    // Fallback: count queries (no full table scans)
    const [achievementsResult, rankingResult, scoresCountResult, activeUsersResult] = await Promise.all([
      supabase.from('achievements').select('*', { count: 'exact', head: true }),
      supabase.from('user_achievements').select('*', { count: 'exact', head: true }),
      supabase.rpc('get_total_xp'),
      supabase.from('scores').select('user_id').limit(10000),
    ])

    const activeUsers = new Set((activeUsersResult.data || []).map(s => s.user_id)).size

    return {
      totalAchievements: achievementsResult.count || 0,
      totalUnlocked: rankingResult.count || 0,
      totalXP: (scoresCountResult.data as any) || 0,
      activeUsers,
    }
  } catch {
    return { totalAchievements: 0, totalUnlocked: 0, totalXP: 0, activeUsers: 0 }
  }
}

