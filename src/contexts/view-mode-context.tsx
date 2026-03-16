import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface ImpersonatedStudent {
  id: string
  name: string
  email: string
}

interface ViewModeContextType {
  viewingAsStudent: boolean
  impersonatedStudent: ImpersonatedStudent | null
  toggleViewAsStudent: () => void
  startImpersonating: (student: ImpersonatedStudent) => void
  exitStudentView: () => void
}

const STORAGE_KEY = 'everest-view-as-student'
const IMPERSONATE_KEY = 'everest-impersonate-student'

const ViewModeContext = createContext<ViewModeContextType>({
  viewingAsStudent: false,
  impersonatedStudent: null,
  toggleViewAsStudent: () => {},
  startImpersonating: () => {},
  exitStudentView: () => {},
})

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewingAsStudent, setViewingAsStudent] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const [impersonatedStudent, setImpersonatedStudent] = useState<ImpersonatedStudent | null>(() => {
    try {
      const stored = sessionStorage.getItem(IMPERSONATE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const toggleViewAsStudent = useCallback(() => {
    setViewingAsStudent(prev => {
      const next = !prev
      try { sessionStorage.setItem(STORAGE_KEY, String(next)) } catch {}
      if (!next) {
        // Exiting student view - also clear impersonation
        setImpersonatedStudent(null)
        try { sessionStorage.removeItem(IMPERSONATE_KEY) } catch {}
      }
      return next
    })
  }, [])

  const startImpersonating = useCallback((student: ImpersonatedStudent) => {
    setImpersonatedStudent(student)
    setViewingAsStudent(true)
    try {
      sessionStorage.setItem(STORAGE_KEY, 'true')
      sessionStorage.setItem(IMPERSONATE_KEY, JSON.stringify(student))
    } catch {}
  }, [])

  const exitStudentView = useCallback(() => {
    setViewingAsStudent(false)
    setImpersonatedStudent(null)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
      sessionStorage.removeItem(IMPERSONATE_KEY)
    } catch {}
  }, [])

  return (
    <ViewModeContext.Provider value={{ viewingAsStudent, impersonatedStudent, toggleViewAsStudent, startImpersonating, exitStudentView }}>
      {children}
    </ViewModeContext.Provider>
  )
}

export const useViewMode = () => useContext(ViewModeContext)
