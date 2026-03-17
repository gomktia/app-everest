import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Eye, Users, User, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase/client'
import { useViewMode } from '@/contexts/view-mode-context'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'

interface ClassOption {
  id: string
  name: string
  class_type: string
}

interface StudentOption {
  id: string
  first_name: string
  last_name: string
  email: string
}

export function ViewAsStudentPicker() {
  const navigate = useNavigate()
  const { viewingAsStudent, startImpersonating, toggleViewAsStudent, exitStudentView } = useViewMode()
  const [open, setOpen] = useState(false)
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)

  // Load classes when dialog opens
  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoadingClasses(true)
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('id, name, class_type')
          .order('name')
        if (error) throw error
        setClasses(data || [])
      } catch (err) {
        logger.error('Error loading classes:', err)
      } finally {
        setLoadingClasses(false)
      }
    }
    load()
  }, [open])

  // Load students when class is selected
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([])
      return
    }
    const load = async () => {
      setLoadingStudents(true)
      try {
        const { data, error } = await supabase
          .from('student_classes')
          .select('users!inner(id, first_name, last_name, email)')
          .eq('class_id', selectedClassId)
        if (error) throw error
        setStudents(
          (data || []).map((sc: any) => ({
            id: sc.users.id,
            first_name: sc.users.first_name || '',
            last_name: sc.users.last_name || '',
            email: sc.users.email || '',
          }))
        )
      } catch (err) {
        logger.error('Error loading students:', err)
      } finally {
        setLoadingStudents(false)
      }
    }
    load()
  }, [selectedClassId])

  const filteredStudents = search
    ? students.filter(s =>
        `${s.first_name} ${s.last_name} ${s.email}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : students

  const handleSelectStudent = (student: StudentOption) => {
    startImpersonating({
      id: student.id,
      name: `${student.first_name} ${student.last_name}`.trim() || student.email,
      email: student.email,
    })
    setOpen(false)
    setSelectedClassId('')
    setSearch('')
    navigate('/dashboard')
  }

  const handleGenericView = () => {
    toggleViewAsStudent()
    setOpen(false)
    setSelectedClassId('')
    setSearch('')
    navigate('/dashboard')
  }

  const handleClick = () => {
    if (viewingAsStudent) {
      exitStudentView()
      navigate('/admin')
    } else {
      setOpen(true)
    }
  }

  return (
    <>
      <Button
        variant={viewingAsStudent ? 'default' : 'ghost'}
        size="sm"
        className="flex gap-1.5 text-xs"
        onClick={handleClick}
      >
        <Eye className="h-3.5 w-3.5" />
        {viewingAsStudent ? 'Modo Aluno' : 'Ver como Aluno'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Ver como Aluno
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Generic view button */}
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleGenericView}
            >
              <Users className="h-4 w-4" />
              Visão genérica de aluno (sem dados específicos)
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou selecione um aluno</span>
              </div>
            </div>

            {/* Class selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Turma</label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingClasses ? 'Carregando...' : 'Selecione uma turma'} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.class_type === 'trial' && (
                        <span className="text-muted-foreground ml-1">(degustação)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Student list */}
            {selectedClassId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Aluno ({students.length})</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto rounded-lg border divide-y">
                  {loadingStudents ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {search ? 'Nenhum aluno encontrado' : 'Nenhum aluno nesta turma'}
                    </div>
                  ) : (
                    filteredStudents.map(student => (
                      <button
                        key={student.id}
                        onClick={() => handleSelectStudent(student)}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {student.first_name} {student.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {student.email}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
