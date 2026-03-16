import { Eye, X, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useViewMode } from '@/contexts/view-mode-context'
import { useAuth } from '@/hooks/use-auth'

export function ViewAsStudentBanner() {
  const { viewingAsStudent, impersonatedStudent, exitStudentView } = useViewMode()
  const { realRole } = useAuth()
  const navigate = useNavigate()

  if (!viewingAsStudent) return null

  const handleExit = () => {
    exitStudentView()
    if (realRole === 'administrator' || realRole === 'teacher') {
      navigate('/admin')
    }
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-primary px-4 py-2 text-primary-foreground text-sm">
      <Eye className="h-4 w-4" />
      {impersonatedStudent ? (
        <span className="font-medium flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          Visualizando como <strong>{impersonatedStudent.name}</strong>
          <span className="opacity-70">({impersonatedStudent.email})</span>
        </span>
      ) : (
        <span className="font-medium">Visualizando como aluno</span>
      )}
      <Button
        size="sm"
        variant="secondary"
        className="h-7 px-3 text-xs"
        onClick={handleExit}
      >
        <X className="h-3 w-3 mr-1" />
        Voltar ao painel
      </Button>
    </div>
  )
}
