import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { logger } from '@/lib/logger'

interface AccessExpirationState {
  expired: boolean
  expirationLoading: boolean
  nearestExpiration: string | null // ISO date string
  daysRemaining: number | null
}

/**
 * Hook that checks if a student's access has expired.
 *
 * Logic:
 * 1. If student_classes.subscription_expires_at is set, use it (per-student override)
 * 2. Otherwise, use classes.end_date (class-level expiration)
 * 3. If no classes found, access is not expired (admin-created users without class)
 * 4. Only applies to students — admin/teacher always have access
 */
export function useAccessExpiration(): AccessExpirationState {
  const { profile, session } = useAuth()
  const [state, setState] = useState<AccessExpirationState>({
    expired: false,
    expirationLoading: true,
    nearestExpiration: null,
    daysRemaining: null,
  })

  useEffect(() => {
    if (!session?.user?.id || !profile) {
      setState(prev => ({ ...prev, expirationLoading: false }))
      return
    }

    // Only check for students
    if (profile.role !== 'student') {
      setState({ expired: false, expirationLoading: false, nearestExpiration: null, daysRemaining: null })
      return
    }

    const checkExpiration = async () => {
      try {
        const { data: enrollments, error } = await supabase
          .from('student_classes')
          .select('subscription_expires_at, class:classes(end_date, status)')
          .eq('user_id', session.user.id)

        if (error) {
          logger.warn('Error checking access expiration:', error)
          setState({ expired: false, expirationLoading: false, nearestExpiration: null, daysRemaining: null })
          return
        }

        // No enrollments — don't block (might be admin-created without class)
        if (!enrollments || enrollments.length === 0) {
          setState({ expired: false, expirationLoading: false, nearestExpiration: null, daysRemaining: null })
          return
        }

        const now = new Date()
        let hasActiveAccess = false
        let nearestDate: Date | null = null

        for (const enrollment of enrollments) {
          const classData = enrollment.class

          // Skip inactive/archived classes
          if (classData?.status && classData.status !== 'active') continue

          // Determine expiration date: per-student override > class end_date
          let expiresAt: Date | null = null
          if (enrollment.subscription_expires_at) {
            expiresAt = new Date(enrollment.subscription_expires_at)
          } else if (classData?.end_date) {
            expiresAt = new Date(classData.end_date + 'T23:59:59')
          }

          // No expiration set means unlimited access for this enrollment
          if (!expiresAt) {
            hasActiveAccess = true
            continue
          }

          if (expiresAt > now) {
            hasActiveAccess = true
            if (!nearestDate || expiresAt < nearestDate) {
              nearestDate = expiresAt
            }
          }
        }

        const daysRemaining = nearestDate
          ? Math.ceil((nearestDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null

        setState({
          expired: !hasActiveAccess,
          expirationLoading: false,
          nearestExpiration: nearestDate?.toISOString() || null,
          daysRemaining,
        })
      } catch (error) {
        logger.error('Error in access expiration check:', error)
        setState({ expired: false, expirationLoading: false, nearestExpiration: null, daysRemaining: null })
      }
    }

    checkExpiration()
  }, [session?.user?.id, profile?.role])

  return state
}
