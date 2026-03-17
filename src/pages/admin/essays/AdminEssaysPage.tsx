import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { logger } from '@/lib/logger'
import { usePageTitle } from '@/hooks/usePageTitle'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Settings,
  ListChecks,
  Clock,
  CheckCircle,
  PenLine,
  GraduationCap,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { SectionLoader } from '@/components/SectionLoader'

interface ClassEssayStats {
  classId: string
  className: string
  total: number
  submitted: number
  correcting: number
  corrected: number
}

export default function AdminEssaysPage() {
  usePageTitle('Redações')
  const [classStats, setClassStats] = useState<ClassEssayStats[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    loadClassEssayStats()
  }, [profile])

  const loadClassEssayStats = async () => {
    if (!profile) return

    try {
      setLoading(true)

      // Fetch classes - for admin all classes, for teacher only their classes
      let classesQuery = supabase
        .from('classes')
        .select('id, name')
        .order('name')

      if (!isAdmin && profile.role === 'teacher') {
        // Get teacher record to find teacher_id
        const { data: teacher } = await supabase
          .from('teachers')
          .select('id')
          .eq('user_id', profile.id)
          .single()

        if (teacher) {
          classesQuery = classesQuery.eq('teacher_id', teacher.id)
        }
      }

      const { data: classes, error: classesError } = await classesQuery

      if (classesError) {
        logger.error('Error fetching classes:', classesError)
        toast({ title: 'Erro ao carregar turmas', variant: 'destructive' })
        return
      }

      if (!classes || classes.length === 0) {
        setClassStats([])
        return
      }

      // Fetch student_classes scoped to loaded classes
      const classIdList = classes.map(c => c.id)
      const { data: studentClasses, error: scError } = await supabase
        .from('student_classes')
        .select('user_id, class_id')
        .in('class_id', classIdList)

      if (scError) {
        logger.error('Error fetching student_classes:', scError)
        toast({ title: 'Erro ao carregar dados', variant: 'destructive' })
        return
      }

      // Fetch essays scoped to students in these classes
      const studentIdList = [...new Set((studentClasses || []).map(sc => sc.user_id))]
      let essaysQuery = supabase.from('essays').select('id, student_id, status')
      if (studentIdList.length > 0) {
        essaysQuery = essaysQuery.in('student_id', studentIdList)
      } else {
        // No students, no essays to fetch
        setClassStats(classes.map(c => ({ classId: c.id, className: c.name, totalStudents: 0, submitted: 0, correcting: 0, corrected: 0, total: 0 })))
        return
      }
      const { data: essays, error: essaysError } = await essaysQuery

      if (essaysError) {
        logger.error('Error fetching essays:', essaysError)
        toast({ title: 'Erro ao carregar redações', variant: 'destructive' })
        return
      }

      // Build student -> class mapping (a student can be in multiple classes)
      const studentToClasses = new Map<string, string[]>()
      for (const sc of studentClasses || []) {
        const existing = studentToClasses.get(sc.user_id) || []
        existing.push(sc.class_id)
        studentToClasses.set(sc.user_id, existing)
      }

      // Group essays by class
      const classEssayMap = new Map<string, { total: number; submitted: number; correcting: number; corrected: number }>()

      // Initialize all classes
      for (const cls of classes) {
        classEssayMap.set(cls.id, { total: 0, submitted: 0, correcting: 0, corrected: 0 })
      }

      // Count essays per class
      for (const essay of essays || []) {
        const classIds = studentToClasses.get(essay.student_id) || []
        for (const classId of classIds) {
          const stats = classEssayMap.get(classId)
          if (stats) {
            stats.total++
            if (essay.status === 'submitted') stats.submitted++
            else if (essay.status === 'correcting') stats.correcting++
            else if (essay.status === 'corrected') stats.corrected++
          }
        }
      }

      // Build final stats array
      const result: ClassEssayStats[] = classes.map((cls) => {
        const stats = classEssayMap.get(cls.id) || { total: 0, submitted: 0, correcting: 0, corrected: 0 }
        return {
          classId: cls.id,
          className: cls.name,
          ...stats,
        }
      })

      setClassStats(result)
    } catch (error) {
      logger.error('Error loading class essay stats:', error)
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <SectionLoader />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Redações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as redações dos alunos por turma
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/admin/essays/prompts">
                <ListChecks className="h-4 w-4" />
                Gerenciar Temas
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/admin/essays/settings">
                <Settings className="h-4 w-4" />
                Configurações
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Class Cards Grid */}
      {classStats.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="p-0">
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Nenhuma turma encontrada</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Não há turmas disponíveis para exibir redações.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classStats.map((cls) => (
            <Card
              key={cls.classId}
              className="border-border shadow-sm cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200"
              onClick={() => navigate(`/admin/essays/turma/${cls.classId}`)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="truncate">{cls.className}</span>
                  {cls.submitted > 0 && (
                    <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30 ml-2 shrink-0" variant="outline">
                      {cls.submitted} pendente{cls.submitted !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">{cls.total}</div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">{cls.submitted}</div>
                      <div className="text-xs text-muted-foreground">Pendentes</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-yellow-500 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">{cls.correcting}</div>
                      <div className="text-xs text-muted-foreground">Em Correção</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">{cls.corrected}</div>
                      <div className="text-xs text-muted-foreground">Corrigidas</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
