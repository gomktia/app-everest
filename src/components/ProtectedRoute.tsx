import { useState, useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useAccessExpiration } from '@/hooks/use-access-expiration'
import { PageLoader } from '@/components/PageLoader'
import { ForcePasswordChangeModal } from '@/components/ForcePasswordChangeModal'
import type { UserProfile } from '@/contexts/auth-provider'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

interface ProtectedRouteProps {
  allowedRoles: Array<UserProfile['role']>
  redirectTo?: string
}

/**
 * Simplified Protected Route Component
 *
 * Much cleaner and more reliable than the previous version.
 * Handles all edge cases properly and provides clear feedback.
 */
export const ProtectedRoute = ({ allowedRoles, redirectTo }: ProtectedRouteProps) => {
  const { profile, loading, session, profileFetchAttempted, getRedirectPath, viewingAsStudent, refreshProfile } = useAuth()
  const location = useLocation()
  const { expired, expirationLoading } = useAccessExpiration()
  const [mustChangePassword, setMustChangePassword] = useState<boolean | null>(null)

  // Check must_change_password flag
  useEffect(() => {
    if (!profile?.id) { setMustChangePassword(null); return }
    supabase
      .from('users')
      .select('must_change_password')
      .eq('id', profile.id)
      .single()
      .then(({ data }) => setMustChangePassword(data?.must_change_password === true))
      .catch(() => setMustChangePassword(false))
  }, [profile?.id])

  // Show loading while authentication is being determined
  if (loading) {
    return <PageLoader />
  }

  // If we have a session but profile hasn't been attempted yet, keep loading
  if (session && !profileFetchAttempted) {
    return <PageLoader />
  }

  // Redirect to login if not authenticated (no session at all)
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // At this point we have session, fetch was attempted, but profile is null
  // This means the profile fetch failed after retries
  if (!profile) {
    logger.warn('⚠️ Profile failed to load')
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h2 className="text-2xl font-bold mb-2">Erro ao carregar perfil</h2>
        <p className="text-muted-foreground mb-4">
          Não foi possível carregar seus dados de perfil. Tente recarregar a página.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
        >
          Recarregar Página
        </button>
      </div>
    )
  }

  // Check access expiration for students only
  if (profile.role === 'student' && !expirationLoading && expired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <div className="max-w-md space-y-4">
          <div className="p-4 rounded-full bg-orange-100 dark:bg-orange-900/30 w-fit mx-auto">
            <svg className="h-12 w-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold">Acesso Expirado</h2>
          <p className="text-muted-foreground">
            Seu acesso à plataforma expirou. O período da sua turma chegou ao fim.
          </p>
          <p className="text-sm text-muted-foreground">
            Para renovar seu acesso, entre em contato ou adquira uma nova turma.
          </p>
        </div>
      </div>
    )
  }

  // Wait for must_change_password check to complete before rendering anything
  if (mustChangePassword === null && profile?.id) {
    return <PageLoader />
  }

  // Force password change on first access
  if (mustChangePassword) {
    return (
      <ForcePasswordChangeModal
        userId={profile.id}
        onSuccess={() => setMustChangePassword(false)}
      />
    )
  }

  // Check if user has required role (use effective role which respects "view as student" mode)
  const effectiveRole = viewingAsStudent && profile.role !== 'student' ? 'student' : profile.role

  if (allowedRoles.includes(effectiveRole)) {
    return <Outlet />
  }

  // Redirect to appropriate dashboard if user doesn't have required role
  const fallbackPath = redirectTo || getRedirectPath()

  // Prevent infinite redirect loops
  if (location.pathname === fallbackPath) {
    logger.warn('⚠️ Infinite redirect loop detected in ProtectedRoute')
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h2 className="text-2xl font-bold mb-2">Acesso Negado</h2>
        <p className="text-muted-foreground mb-4">
          Você não tem permissão para acessar esta página e não foi possível redirecioná-lo.
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 border rounded-md hover:bg-muted"
          >
            Voltar para Login
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            Ir para Início
          </button>
        </div>
      </div>
    )
  }

  return <Navigate to={fallbackPath} state={{ from: location }} replace />
}

/**
 * Admin Only Route - Convenience component for admin routes
 */
export const AdminRoute = () => {
  return <ProtectedRoute allowedRoles={['administrator']} />
}

/**
 * Teacher Route - For teacher and admin access
 */
export const TeacherRoute = () => {
  return <ProtectedRoute allowedRoles={['teacher', 'administrator']} />
}

/**
 * Student Route - For all authenticated users
 */
export const StudentRoute = () => {
  return <ProtectedRoute allowedRoles={['student', 'teacher', 'administrator']} />
}