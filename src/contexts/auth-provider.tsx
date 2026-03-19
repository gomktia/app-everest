import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import * as Sentry from '@sentry/react'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'

// Simplified UserProfile interface
export interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'student' | 'teacher' | 'administrator'
  is_active: boolean
  created_at: string
  updated_at: string
  avatar_url?: string
  bio?: string
  must_change_password?: boolean
  // Optional extended data
  student_id_number?: string
  employee_id_number?: string
  department?: string
  enrollment_date?: string
  hire_date?: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signInWithMagicLink: (email: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  loading: boolean
  profileFetchAttempted: boolean
  refreshProfile: () => Promise<void>
  getRedirectPath: () => string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Profile cache in localStorage for instant F5 reload
const PROFILE_CACHE_KEY = 'everest-profile-cache'

function getCachedProfile(): UserProfile | null {
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY)
    if (!cached) return null
    const parsed = JSON.parse(cached)
    // Cache expires after 1 hour
    if (parsed._cachedAt && Date.now() - parsed._cachedAt > 3600000) {
      localStorage.removeItem(PROFILE_CACHE_KEY)
      return null
    }
    const { _cachedAt, ...profile } = parsed
    return profile
  } catch {
    return null
  }
}

function setCachedProfile(profile: UserProfile | null) {
  try {
    if (profile) {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ ...profile, _cachedAt: Date.now() }))
    } else {
      localStorage.removeItem(PROFILE_CACHE_KEY)
    }
  } catch { /* ignore quota errors */ }
}

// Simple hook with better error handling - used internally by enhanced hook
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Centralized profile fetching with automatic profile creation
const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    // First try to fetch existing profile (fast timeout - profile should load in <3s)
    const fetchWithTimeout = () => Promise.race([
      supabase
        .from('users')
        .select(`
          id,
          email,
          first_name,
          last_name,
          role,
          is_active,
          bio,
          avatar_url,
          must_change_password,
          created_at,
          updated_at
        `)
        .eq('id', userId)
        .single(),
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
      )
    ])

    // Single attempt - no retries to keep page load fast
    let fetchError: any = null
    try {
      const { data: existingProfile, error } = await fetchWithTimeout()
      if (!error && existingProfile) return existingProfile
      fetchError = error
    } catch (err) {
      fetchError = err
    }

    // If profile doesn't exist (PGRST116 = no rows returned), try to create one
    if (fetchError && fetchError.code === 'PGRST116') {
      // Get user data from Supabase Auth
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        logger.error('Could not get user data for profile creation:', userError)
        return null
      }

      // Always default to 'student' - role promotion only via admin panel or edge functions
      // SECURITY: Never trust user_metadata.role from client-side signUp
      const role = 'student'

      const newProfile = {
        id: userId,
        email: user.email || '',
        first_name: user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.last_name || '',
        role: role as 'student' | 'teacher' | 'administrator',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Try to insert the profile
      const { data: createdProfile, error: createError } = await supabase
        .from('users')
        .insert(newProfile)
        .select()
        .single()

      if (createError) {
        logger.error('Failed to create profile:', createError)
        return null
      }

      // Create student record if role is student
      if (createdProfile.role === 'student') {
        const studentData = {
          user_id: userId,
          student_id_number: `STU-${userId.substring(0, 8)}`,
          enrollment_date: new Date().toISOString().split('T')[0]
        }

        const { error: studentError } = await supabase
          .from('students')
          .insert(studentData)

        if (studentError) {
          logger.error('Failed to create student record:', studentError)
        }
      }

      // Create teacher record if role is teacher
      if (createdProfile.role === 'teacher') {
        const teacherData = {
          user_id: userId,
          employee_id_number: `EMP-${userId.substring(0, 8)}`,
          hire_date: new Date().toISOString().split('T')[0]
        }

        const { error: teacherError } = await supabase
          .from('teachers')
          .insert(teacherData)

        if (teacherError) {
          logger.error('Failed to create teacher record:', teacherError)
        }
      }

      return createdProfile
    }

    // For other errors, log and return null
    logger.error('Profile fetch error:', fetchError)
    return null

  } catch (error) {
    logger.error('Network error fetching profile:', error)
    return null
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileFetchAttempted, setProfileFetchAttempted] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const { toast } = useToast()

  // Use refs to avoid dependency cycles in useCallback/useEffect
  const profileRef = useRef<UserProfile | null>(null)
  const profileFetchAttemptedRef = useRef(false)
  const isFetchingProfileRef = useRef(false)
  const initCompleteRef = useRef(false)
  const isSigningOutRef = useRef(false)

  // Keep refs in sync with state
  profileRef.current = profile
  profileFetchAttemptedRef.current = profileFetchAttempted
  isSigningOutRef.current = isSigningOut

  // Refresh profile function
  const refreshProfile = useCallback(async () => {
    const currentSession = session
    if (!currentSession?.user?.id) return

    const userProfile = await fetchUserProfile(currentSession.user.id)
    setProfile(userProfile)
    setCachedProfile(userProfile)
  }, [session])

  // Handle session changes - stable callback using refs
  const handleSessionChange = useCallback(async (newSession: Session | null) => {
    setSession(newSession)

    if (newSession?.user) {
      // Skip if already fetched for the SAME user, or currently fetching
      if (profileFetchAttemptedRef.current && profileRef.current && profileRef.current.id === newSession.user.id) {
        return
      }

      if (isFetchingProfileRef.current) {
        return
      }

      isFetchingProfileRef.current = true
      setProfileFetchAttempted(false)

      // Single attempt - no retries to keep login fast
      try {
        const userProfile = await fetchUserProfile(newSession.user.id)
        setProfile(userProfile)
        setCachedProfile(userProfile)
        // Set Sentry user context for error tracking
        if (userProfile) {
          Sentry.setUser({ id: userProfile.id, email: userProfile.email, username: `${userProfile.first_name} ${userProfile.last_name}`.trim() })
          // Track last seen (5-min debounce in DB)
          supabase.rpc('update_last_seen', { p_user_id: userProfile.id }).then(() => {}, () => {})
        }
      } catch (error) {
        logger.error('Failed to fetch profile in handleSessionChange:', error)
        setProfile(null)
      } finally {
        isFetchingProfileRef.current = false
        setProfileFetchAttempted(true)
      }
    } else {
      // Clear profile for unauthenticated state
      isFetchingProfileRef.current = false
      setProfile(null)
      setProfileFetchAttempted(false)
    }
  }, []) // No dependencies - uses refs for state checks

  // Initialize auth - runs only once
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        // STEP 1: Try cached profile for INSTANT render (no network needed)
        const cached = getCachedProfile()

        // STEP 2: Read session from localStorage directly (no network call)
        // supabase.auth.getSession() may trigger token refresh over network (slow!)
        // So we read the raw token from localStorage first for instant UI
        let initialSession: Session | null = null

        // Try raw localStorage read first (instant, no network)
        try {
          const storageKey = 'everest-auth-token'
          const raw = localStorage.getItem(storageKey)
          if (raw) {
            const parsed = JSON.parse(raw)
            // Supabase stores session under different structures
            const sessionData = parsed?.currentSession || parsed
            if (sessionData?.access_token && sessionData?.user?.id) {
              // We have a valid-looking session in storage
              initialSession = sessionData as Session
            }
          }
        } catch {
          // localStorage parse failed, fall through to getSession
        }

        // If localStorage had a session AND we have a cached profile, render INSTANTLY
        if (initialSession?.user && cached && cached.id === initialSession.user.id) {
          if (!mounted) return
          setSession(initialSession)
          setProfile(cached)
          setProfileFetchAttempted(true)

          // Track last seen on cached init
          supabase.rpc('update_last_seen', { p_user_id: cached.id }).then(() => {}, () => {})

          // Refresh both in background (non-blocking)
          supabase.auth.getSession().then(({ data }) => {
            if (data.session && mounted) {
              setSession(data.session)
              // Also refresh profile
              fetchUserProfile(data.session.user.id).then(fresh => {
                if (fresh && mounted) {
                  setProfile(fresh)
                  setCachedProfile(fresh)
                }
              }).catch(() => {})
            }
          }).catch(() => {})

          return // initializeAuth done — loading will be set false in finally
        }

        // No cache hit — fall back to getSession with timeout
        if (!initialSession) {
          try {
            const result = await Promise.race([
              supabase.auth.getSession(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Auth timeout')), 8000)
              )
            ])
            initialSession = result.data.session
          } catch {
            // Timeout — stop loading, let onAuthStateChange catch up
            if (mounted) {
              initCompleteRef.current = true
              setLoading(false)
            }
            return
          }
        }

        if (!mounted) return

        if (initialSession?.user) {
          setSession(initialSession)

          // Try cached profile (maybe different user?)
          if (cached && cached.id === initialSession.user.id) {
            setProfile(cached)
            setProfileFetchAttempted(true)
            fetchUserProfile(initialSession.user.id).then(fresh => {
              if (fresh && mounted) { setProfile(fresh); setCachedProfile(fresh) }
            }).catch(() => {})
          } else {
            // No cache — fetch profile
            handleSessionChange(initialSession).catch(err => {
              logger.error('Background profile fetch failed:', err)
            })
          }
        } else {
          setSession(null)
          setProfile(null)
          setProfileFetchAttempted(true)
        }

      } catch (error) {
        if (!mounted) return
        logger.error('Auth initialization failed:', error)
        setSession(null)
        setProfile(null)
      } finally {
        if (mounted) {
          initCompleteRef.current = true
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return

        // Only handle meaningful events
        if (event === 'TOKEN_REFRESHED') {
          if (newSession) {
            setSession(newSession)
          } else {
            // Token refresh failed — session was likely revoked (another device logged in)
            setSession(null)
            setProfile(null)
            setProfileFetchAttempted(false)
            isFetchingProfileRef.current = false
            toast({
              title: 'Sessão encerrada',
              description: 'Sua sessão foi encerrada porque outro dispositivo fez login na sua conta.',
              variant: 'destructive',
            })
          }
          return
        }

        if (event === 'SIGNED_OUT') {
          setSession(null)
          setProfile(null)
          setProfileFetchAttempted(false)
          isFetchingProfileRef.current = false
          // Show message if user didn't initiate the sign out
          if (!isSigningOutRef.current) {
            toast({
              title: 'Sessão encerrada',
              description: 'Você foi desconectado. Faça login novamente.',
              variant: 'destructive',
            })
          }
          return
        }

        if (event === 'SIGNED_IN') {
          // Limitar sessões simultâneas (max 2 dispositivos)
          if (newSession?.access_token) {
            fetch(
              `${import.meta.env.VITE_SUPABASE_URL || 'https://hnhzindsfuqnaxosujay.supabase.co'}/functions/v1/session-guard`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${newSession.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ maxSessions: 1 }),
              }
            ).then(async (res) => {
              if (res.ok) {
                const data = await res.json()
                if (data.removedSessions > 0) {
                  toast({
                    title: 'Sessão anterior encerrada',
                    description: 'O login anterior em outro dispositivo foi desconectado.',
                  })
                }
              }
            }).catch(() => {
              // Não bloqueia login se session-guard falhar
            })
          }

          // Token refresh handled by Supabase onAuthStateChange (TOKEN_REFRESHED)
        }

        await handleSessionChange(newSession)

        // If init hasn't completed yet but we got a valid session from the listener,
        // make sure loading is turned off so the UI isn't stuck
        if (!initCompleteRef.current && newSession) {
          initCompleteRef.current = true
          setLoading(false)
        }
      }
    )

    // When user comes back to this tab, check if session is still valid
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession()
        if (error || !currentSession) {
          // Session was revoked while tab was in background
          if (mounted && profileRef.current) {
            setSession(null)
            setProfile(null)
            setProfileFetchAttempted(false)
            toast({
              title: 'Sessão encerrada',
              description: 'Sua sessão foi encerrada porque outro dispositivo fez login na sua conta.',
              variant: 'destructive',
            })
          }
        } else if (profileRef.current) {
          // Update last_seen on tab focus (5-min debounce in DB)
          supabase.rpc('update_last_seen', { p_user_id: profileRef.current.id }).then(() => {}, () => {})
        }
      } catch {
        // Ignore network errors on visibility check
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [handleSessionChange, toast])

  // Auth methods
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      logger.error('Sign in error:', error)
    }

    return { error }
  }, [])

  const signInWithMagicLink = useCallback(async (email: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    })

    if (error) {
      logger.error('Magic link error:', error)
    }

    return { error }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      logger.error('Sign up error:', error)
    }

    return { error }
  }, [])

  const signOut = useCallback(async () => {
    if (isSigningOut) {
      return { error: null }
    }

    setIsSigningOut(true)

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        if (error.status !== 403) {
          logger.error('Sign out error:', error)
        }
      }

      setProfile(null)
      setProfileFetchAttempted(false)
      setCachedProfile(null)
      Sentry.setUser(null)

      return { error }
    } finally {
      setTimeout(() => setIsSigningOut(false), 2000)
    }
  }, [isSigningOut])

  const getRedirectPath = useCallback(() => {
    if (!profile) return '/login'

    switch (profile.role) {
      case 'administrator':
        return '/admin'
      case 'teacher':
        return '/admin'
      case 'student':
      default:
        return '/dashboard'
    }
  }, [profile])

  const user = session?.user ?? null

  const value = useMemo(() => ({
    user,
    session,
    profile,
    signIn,
    signInWithMagicLink,
    signUp,
    signOut,
    loading,
    profileFetchAttempted,
    refreshProfile,
    getRedirectPath,
  }), [user, session, profile, signIn, signInWithMagicLink, signUp, signOut, loading, profileFetchAttempted, refreshProfile, getRedirectPath])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
