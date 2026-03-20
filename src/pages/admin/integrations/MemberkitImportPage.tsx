import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  ArrowRight,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Link2,
  Upload,
  Users,
  BookOpen,
  ScrollText,
  ChevronRight,
  GraduationCap,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-provider'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import {
  buildPandaVideoMap,
  importMemberkitCourse,
  importMemberkitUsers,
  fetchMemberkitCourses,
  fetchMemberkitClassrooms,
  type ImportProgress,
  type PandaVideoInfo,
  type MKCourse,
  type MKClassroom,
  type ImportCourseResult,
  type ImportUsersResult,
} from '@/services/memberkitImportService'
import { cn } from '@/lib/utils'

interface LogEntry {
  id: number
  timestamp: Date
  type: 'info' | 'success' | 'error' | 'progress'
  message: string
}

let logIdCounter = 0

export default function MemberkitImportPage() {
  usePageTitle('Importar MemberKit')
  const { profile } = useAuth()
  const { toast } = useToast()

  // Step state: 1=config, 2=select course, 3=course detail (turmas + import)
  const [step, setStep] = useState(1)

  // Config state - pre-filled with known keys, service role key from localStorage
  const [memberkitApiKey, setMemberkitApiKey] = useState('3cG57cb4CAgAKMX7Fg59qY8f')
  const [pandaApiKey, setPandaApiKey] = useState('')
  const [serviceRoleKey, setServiceRoleKey] = useState(() => localStorage.getItem('admin-service-role-key') || '')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Data state
  const [courses, setCourses] = useState<MKCourse[]>([])
  const [classrooms, setClassrooms] = useState<MKClassroom[]>([])
  const [everestClasses, setEverestClasses] = useState<{ id: string; name: string }[]>([])
  const [pandaVideoMap, setPandaVideoMap] = useState<Map<string, PandaVideoInfo> | null>(null)

  // Selected course
  const [selectedCourse, setSelectedCourse] = useState<MKCourse | null>(null)

  // Filtered turmas for selected course (MemberKit links via course_name, not course_id)
  const filteredClassrooms = classrooms.filter(
    (c) => selectedCourse && c.course_name === selectedCourse.name
  )

  // Form state for user import
  const [selectedClassroomId, setSelectedClassroomId] = useState('')
  const [selectedEverestClassId, setSelectedEverestClassId] = useState('')
  const [defaultPassword, setDefaultPassword] = useState('Everest@2026')

  // Import state
  const [importingCourse, setImportingCourse] = useState(false)
  const [importingUsers, setImportingUsers] = useState(false)
  const [courseResult, setCourseResult] = useState<ImportCourseResult | null>(null)
  const [usersResult, setUsersResult] = useState<ImportUsersResult | null>(null)

  // Log state
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs((prev) => [
      ...prev,
      { id: ++logIdCounter, timestamp: new Date(), type, message },
    ])
  }, [])

  // Convert all spinning 'progress' logs to static 'info' when import finishes
  const finalizeProgressLogs = useCallback(() => {
    setLogs((prev) => prev.map((log) => log.type === 'progress' ? { ...log, type: 'info' as const } : log))
  }, [])

  const handleProgress = useCallback(
    (progress: ImportProgress) => {
      const detail = progress.detail ? ` - ${progress.detail}` : ''
      const counter =
        progress.total > 0
          ? ` (${progress.current}/${progress.total})`
          : progress.current > 0
            ? ` (${progress.current})`
            : ''
      addLog('progress', `${progress.step}${counter}${detail}`)
    },
    [addLog],
  )

  // Connect: validate keys and fetch courses/classrooms
  const handleConnect = async () => {
    if (!memberkitApiKey.trim()) {
      toast({
        title: 'Chave obrigatoria',
        description: 'Informe a MemberKit API Key.',
        variant: 'destructive',
      })
      return
    }

    setConnecting(true)
    setLogs([])
    setCourseResult(null)
    setUsersResult(null)

    try {
      addLog('info', 'Conectando ao MemberKit...')
      const [mkCourses, mkClassrooms] = await Promise.all([
        fetchMemberkitCourses(memberkitApiKey),
        fetchMemberkitClassrooms(memberkitApiKey),
      ])
      setCourses(mkCourses)
      setClassrooms(mkClassrooms)
      addLog(
        'success',
        `MemberKit conectado: ${mkCourses.length} cursos, ${mkClassrooms.length} turmas`,
      )

      // Fetch Everest classes
      addLog('info', 'Buscando turmas do Everest...')
      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('id, name')
        .order('name')

      if (classesError) {
        addLog('error', `Erro ao buscar turmas Everest: ${classesError.message}`)
      } else {
        setEverestClasses(classes || [])
        addLog('success', `${(classes || []).length} turmas Everest encontradas`)
      }

      // Build Panda Video map if key provided
      if (pandaApiKey.trim()) {
        addLog('info', 'Carregando videos do Panda Video...')
        const map = await buildPandaVideoMap(pandaApiKey, handleProgress)
        setPandaVideoMap(map)
        addLog('success', `Panda Video: ${map.size} videos carregados`)
      } else {
        setPandaVideoMap(new Map())
        addLog('info', 'Panda Video API Key nao informada - videos serao ignorados')
      }

      setConnected(true)
      setStep(2)
      addLog('success', 'Conexao estabelecida com sucesso!')
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      addLog('error', `Erro ao conectar: ${msg}`)
      toast({
        title: 'Erro ao conectar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setConnecting(false)
    }
  }

  // Select a course and go to step 3
  const handleSelectCourse = (course: MKCourse) => {
    setSelectedCourse(course)
    setSelectedClassroomId('')
    setCourseResult(null)
    setUsersResult(null)
    setStep(3)
  }

  // Import course
  const handleImportCourse = async () => {
    if (!selectedCourse || !pandaVideoMap || !profile) return

    setImportingCourse(true)
    setCourseResult(null)

    try {
      addLog('info', `Iniciando importacao do curso "${selectedCourse.name}"...`)
      const result = await importMemberkitCourse(
        memberkitApiKey,
        selectedCourse.id,
        pandaVideoMap,
        profile.id,
        handleProgress,
      )
      setCourseResult(result)

      if (result.errors.length > 0) {
        for (const err of result.errors) {
          addLog('error', err)
        }
      }

      addLog(
        'success',
        `Curso "${result.courseName}" importado: ${result.modulesCreated} modulos, ${result.lessonsCreated} aulas, ${result.attachmentsCreated} anexos`,
      )

      toast({
        title: 'Curso importado!',
        description: `${result.modulesCreated} modulos e ${result.lessonsCreated} aulas criados.`,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      addLog('error', `Erro na importacao do curso: ${msg}`)
      toast({
        title: 'Erro na importacao',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setImportingCourse(false)
      finalizeProgressLogs()
    }
  }

  // Import users
  const handleImportUsers = async () => {
    if (!selectedClassroomId || !selectedEverestClassId) return

    setImportingUsers(true)
    setUsersResult(null)

    try {
      const classroom = filteredClassrooms.find((c) => String(c.id) === selectedClassroomId)
      addLog(
        'info',
        `Iniciando importacao de alunos da turma "${classroom?.name || selectedClassroomId}"...`,
      )
      const result = await importMemberkitUsers(
        memberkitApiKey,
        Number(selectedClassroomId),
        selectedEverestClassId,
        defaultPassword,
        handleProgress,
        serviceRoleKey || undefined,
      )
      setUsersResult(result)

      if (result.errors.length > 0) {
        for (const err of result.errors) {
          addLog('error', err)
        }
      }

      addLog(
        'success',
        `Alunos importados: ${result.usersCreated} criados, ${result.usersAlreadyExisted} ja existiam, ${result.enrollmentsCreated} matriculas`,
      )

      toast({
        title: 'Alunos importados!',
        description: `${result.usersCreated} criados, ${result.enrollmentsCreated} matriculados.`,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      addLog('error', `Erro na importacao de alunos: ${msg}`)
      toast({
        title: 'Erro na importacao',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setImportingUsers(false)
      finalizeProgressLogs()
    }
  }

  const handleDisconnect = () => {
    setConnected(false)
    setCourses([])
    setClassrooms([])
    setPandaVideoMap(null)
    setCourseResult(null)
    setUsersResult(null)
    setSelectedCourse(null)
    setStep(1)
  }

  const isImporting = importingCourse || importingUsers || connecting

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/admin/integrations"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Integracoes
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Importacao MemberKit</h1>
        <p className="text-muted-foreground mt-1">
          Selecione um curso, escolha a turma e importe alunos
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => step > 1 && !isImporting && setStep(1)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors',
            step === 1
              ? 'bg-primary text-primary-foreground font-medium'
              : step > 1
                ? 'bg-green-100 dark:bg-green-950/50 text-green-600 hover:bg-green-500/20 cursor-pointer'
                : 'bg-muted text-muted-foreground'
          )}
        >
          {step > 1 ? <CheckCircle className="h-3.5 w-3.5" /> : <span className="font-bold">1</span>}
          Conexao
        </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <button
          onClick={() => step > 2 && !isImporting && setStep(2)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors',
            step === 2
              ? 'bg-primary text-primary-foreground font-medium'
              : step > 2
                ? 'bg-green-100 dark:bg-green-950/50 text-green-600 hover:bg-green-500/20 cursor-pointer'
                : 'bg-muted text-muted-foreground'
          )}
        >
          {step > 2 ? <CheckCircle className="h-3.5 w-3.5" /> : <span className="font-bold">2</span>}
          Curso
        </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
            step === 3
              ? 'bg-primary text-primary-foreground font-medium'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <span className="font-bold">3</span>
          Importar
        </div>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* ── Step 1: Configuration ── */}
        {step === 1 && (
          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <Link2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Configuracao</h2>
                    <p className="text-xs text-muted-foreground">Informe as chaves de API para conectar</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="mk-key">MemberKit API Key *</Label>
                    <Input
                      id="mk-key"
                      type="password"
                      placeholder="Sua chave da MemberKit"
                      value={memberkitApiKey}
                      onChange={(e) => setMemberkitApiKey(e.target.value)}
                      disabled={connected || isImporting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="panda-key">Panda Video API Key</Label>
                    <Input
                      id="panda-key"
                      type="password"
                      placeholder="Para vincular videos (opcional)"
                      value={pandaApiKey}
                      onChange={(e) => setPandaApiKey(e.target.value)}
                      disabled={connected || isImporting}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="service-key">
                      Supabase Service Role Key{' '}
                      <span className="text-xs text-muted-foreground">
                        (necessaria para criar usuarios - salva no navegador)
                      </span>
                    </Label>
                    <Input
                      id="service-key"
                      type="password"
                      placeholder="Chave service_role do Supabase"
                      value={serviceRoleKey}
                      onChange={(e) => {
                        setServiceRoleKey(e.target.value)
                        if (e.target.value) {
                          localStorage.setItem('admin-service-role-key', e.target.value)
                        } else {
                          localStorage.removeItem('admin-service-role-key')
                        }
                      }}
                      disabled={connected || isImporting}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {!connected ? (
                    <Button
                      onClick={handleConnect}
                      disabled={connecting || !memberkitApiKey.trim()}
                    >
                      {connecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Conectando...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="mr-2 h-4 w-4" />
                          Conectar e Continuar
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Conectado</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDisconnect}
                        disabled={isImporting}
                      >
                        Desconectar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Select Course ── */}
        {step === 2 && (
          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/50">
                      <BookOpen className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Selecionar Curso</h2>
                      <p className="text-xs text-muted-foreground">
                        {courses.length} cursos encontrados no MemberKit
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{courses.length} cursos</Badge>
                </div>

                {courses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Nenhum curso encontrado no MemberKit</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {courses.map((course) => {
                      const turmasCount = classrooms.filter(
                        (c) => c.course_name === course.name
                      ).length
                      const totalUsers = classrooms
                        .filter((c) => c.course_name === course.name)
                        .reduce((sum, c) => sum + c.users_count, 0)

                      return (
                        <button
                          key={course.id}
                          onClick={() => handleSelectCourse(course)}
                          className={cn(
                            'flex items-start gap-3 p-4 rounded-xl border border-border',
                            'text-left transition-all hover:border-primary/50 hover:shadow-md',
                            'hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/20'
                          )}
                        >
                          {(course.image_url || course.image) ? (
                            <img
                              src={(course.image_url || course.image)}
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                              <BookOpen className="h-6 w-6 text-blue-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground text-sm leading-tight">
                              {course.name}
                            </h3>
                            {course.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {course.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <GraduationCap className="h-3 w-3" />
                                {turmasCount} turma{turmasCount !== 1 ? 's' : ''}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {totalUsers} aluno{totalUsers !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Course Detail + Import ── */}
        {step === 3 && selectedCourse && (
          <>
            {/* Course header */}
            <Card className="border-border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  {(selectedCourse.image_url || selectedCourse.image) ? (
                    <img
                      src={(selectedCourse.image_url || selectedCourse.image)}
                      alt=""
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
                      <BookOpen className="h-8 w-8 text-blue-500" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-foreground">
                      {selectedCourse.name}
                    </h2>
                    {selectedCourse.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {selectedCourse.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <Badge variant="outline">
                        <GraduationCap className="h-3 w-3 mr-1" />
                        {filteredClassrooms.length} turma{filteredClassrooms.length !== 1 ? 's' : ''}
                      </Badge>
                      <Badge variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        {filteredClassrooms.reduce((sum, c) => sum + c.users_count, 0)} alunos
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setStep(2); setSelectedCourse(null) }}
                    disabled={isImporting}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Trocar Curso
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Import Course Content */}
            <Card className="border-border shadow-sm">
              <CardContent className="p-5">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/50">
                      <Upload className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Importar Conteudo do Curso</h3>
                      <p className="text-xs text-muted-foreground">
                        Importa modulos, aulas e anexos para o Everest
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={handleImportCourse}
                    disabled={importingCourse || !pandaVideoMap}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {importingCourse ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importando Curso...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Importar Conteudo
                      </>
                    )}
                  </Button>

                  {/* Course Result */}
                  {courseResult && (
                    <div className="rounded-xl border border-border p-4 space-y-3">
                      <div className="flex items-center gap-2 text-green-500 font-medium">
                        <CheckCircle className="h-5 w-5" />
                        Curso &quot;{courseResult.courseName}&quot; importado
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="text-center p-3 rounded-lg bg-blue-100 dark:bg-blue-950/50">
                          <div className="text-lg font-bold text-blue-500">
                            {courseResult.modulesCreated}
                          </div>
                          <div className="text-muted-foreground">Modulos</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-green-100 dark:bg-green-950/50">
                          <div className="text-lg font-bold text-green-500">
                            {courseResult.lessonsCreated}
                          </div>
                          <div className="text-muted-foreground">Aulas</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-purple-100 dark:bg-purple-950/50">
                          <div className="text-lg font-bold text-purple-500">
                            {courseResult.attachmentsCreated}
                          </div>
                          <div className="text-muted-foreground">Anexos</div>
                        </div>
                      </div>
                      {courseResult.errors.length > 0 && (
                        <div className="text-sm text-yellow-500">
                          <AlertCircle className="h-4 w-4 inline mr-1" />
                          {courseResult.errors.length} avisos durante a importacao
                        </div>
                      )}
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/admin/courses">
                          <BookOpen className="mr-2 h-4 w-4" />
                          Ver Cursos
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Import Users from Turma */}
            <Card className="border-border shadow-sm">
              <CardContent className="p-5">
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/50">
                      <Users className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Importar Alunos da Turma</h3>
                      <p className="text-xs text-muted-foreground">
                        Selecione uma turma deste curso e importe os alunos para o Everest
                      </p>
                    </div>
                  </div>

                  {filteredClassrooms.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Este curso nao possui turmas no MemberKit</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Turma list */}
                      <div className="space-y-2">
                        <Label>Turma MemberKit</Label>
                        <div className="grid gap-2">
                          {filteredClassrooms.map((classroom) => (
                            <button
                              key={classroom.id}
                              onClick={() => setSelectedClassroomId(String(classroom.id))}
                              disabled={importingUsers}
                              className={cn(
                                'flex items-center justify-between p-3 rounded-lg border text-left transition-all',
                                selectedClassroomId === String(classroom.id)
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                  : 'border-border hover:border-primary/30 hover:bg-muted/50'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <GraduationCap className={cn(
                                  'h-4 w-4',
                                  selectedClassroomId === String(classroom.id)
                                    ? 'text-primary'
                                    : 'text-muted-foreground'
                                )} />
                                <span className="font-medium text-sm text-foreground">
                                  {classroom.name}
                                </span>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {classroom.users_count} membro{classroom.users_count !== 1 ? 's' : ''}
                              </Badge>
                            </button>
                          ))}
                        </div>
                      </div>

                      {selectedClassroomId && (
                        <>
                          <Separator />

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Turma Everest (destino)</Label>
                              <Select
                                value={selectedEverestClassId}
                                onValueChange={setSelectedEverestClassId}
                                disabled={importingUsers}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione uma turma Everest..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {everestClasses.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="default-password">Senha padrao</Label>
                              <Input
                                id="default-password"
                                type="text"
                                value={defaultPassword}
                                onChange={(e) => setDefaultPassword(e.target.value)}
                                disabled={importingUsers}
                              />
                            </div>
                          </div>

                          <Button
                            onClick={handleImportUsers}
                            disabled={
                              !selectedClassroomId ||
                              !selectedEverestClassId ||
                              importingUsers
                            }
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {importingUsers ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Importando Alunos...
                              </>
                            ) : (
                              <>
                                <Download className="mr-2 h-4 w-4" />
                                Importar Alunos
                              </>
                            )}
                          </Button>
                        </>
                      )}

                      {/* Users Result */}
                      {usersResult && (
                        <div className="rounded-xl border border-border p-4 space-y-3">
                          <div className="flex items-center gap-2 text-green-500 font-medium">
                            <CheckCircle className="h-5 w-5" />
                            Importacao de alunos concluida
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <div className="text-center p-3 rounded-lg bg-green-100 dark:bg-green-950/50">
                              <div className="text-lg font-bold text-green-500">
                                {usersResult.usersCreated}
                              </div>
                              <div className="text-muted-foreground">Criados</div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-yellow-100 dark:bg-yellow-950/50">
                              <div className="text-lg font-bold text-yellow-500">
                                {usersResult.usersAlreadyExisted}
                              </div>
                              <div className="text-muted-foreground">Ja existiam</div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-blue-100 dark:bg-blue-950/50">
                              <div className="text-lg font-bold text-blue-500">
                                {usersResult.enrollmentsCreated}
                              </div>
                              <div className="text-muted-foreground">Matriculados</div>
                            </div>
                          </div>
                          {usersResult.errors.length > 0 && (
                            <div className="text-sm text-yellow-500">
                              <AlertCircle className="h-4 w-4 inline mr-1" />
                              {usersResult.errors.length} erros durante a importacao
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Progress Log Card */}
        {logs.length > 0 && (
          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950/50">
                    <ScrollText className="h-5 w-5 text-orange-500" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">Log de Progresso</h2>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {logs.length} entradas
                  </span>
                </div>

                <div
                  ref={logContainerRef}
                  className="max-h-80 overflow-y-auto rounded-xl border border-border bg-muted/50 p-3 space-y-1 font-mono text-xs"
                >
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2">
                      <span className="text-muted-foreground shrink-0">
                        {log.timestamp.toLocaleTimeString('pt-BR')}
                      </span>
                      {log.type === 'success' && (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      )}
                      {log.type === 'error' && (
                        <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                      )}
                      {log.type === 'info' && (
                        <AlertCircle className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                      )}
                      {log.type === 'progress' && (
                        <Loader2 className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5 animate-spin" />
                      )}
                      <span
                        className={
                          log.type === 'error'
                            ? 'text-red-400'
                            : log.type === 'success'
                              ? 'text-green-400'
                              : 'text-foreground/80'
                        }
                      >
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
