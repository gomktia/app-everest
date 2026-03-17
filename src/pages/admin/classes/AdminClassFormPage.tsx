import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { usePageTitle } from '@/hooks/usePageTitle'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionLoader } from '@/components/SectionLoader'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, GraduationCap, Save, ChevronDown, ChevronRight, PlayCircle } from 'lucide-react'
import { getModuleRulesForClass, saveAllModuleRules, checkCircularDependency, getLessonRulesForClass, upsertLessonRule, deleteLessonRule, type LessonRule } from '@/services/moduleRulesService'
import { Badge } from '@/components/ui/badge'
import { getAllContentAccessForClass, saveContentAccess } from '@/services/contentAccessService'

const classSchema = z.object({
  name: z.string().min(1, 'O nome da turma é obrigatório'),
  description: z.string().optional(),
  start_date: z.string().min(1, 'A data de início é obrigatória'),
  end_date: z.string().min(1, 'A data de término é obrigatória'),
  status: z.enum(['active', 'inactive', 'archived']),
  class_type: z.enum(['standard', 'trial']).default('standard'),
  teacher_id: z.string().min(1, 'O professor é obrigatório'),
})

type ClassFormValues = z.infer<typeof classSchema>

import { getTeachers, Teacher } from '@/services/teacherService'

export default function AdminClassFormPage() {
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()
  usePageTitle('Configurar Turma')
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [accessDuration, setAccessDuration] = useState<number | ''>('')
  const [isDefault, setIsDefault] = useState(false)
  const [moduleRules, setModuleRules] = useState<Record<string, { rule_type: string; rule_value: string }>>({})
  const [modules, setModules] = useState<any[]>([])
  const [contentAccess, setContentAccess] = useState<Record<string, string[]>>({})
  const [allTopics, setAllTopics] = useState<any[]>([])
  const [allSubjects, setAllSubjects] = useState<any[]>([])
  const [allSimulations, setAllSimulations] = useState<any[]>([])
  const [allCommunitySpaces, setAllCommunitySpaces] = useState<any[]>([])
  const [lessonRules, setLessonRules] = useState<Record<string, { rule_type: string; rule_value: string }>>({})
  const [moduleLessons, setModuleLessons] = useState<Record<string, { id: string; title: string; order_index: number }[]>>({})
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [contentToggles, setContentToggles] = useState({
    flashcard_topic: true,
    quiz_topic: true,
    acervo: true,
    simulation: true,
    essay_limit: true,
    community_readonly: true,
    community_space: true,
  })
  const [essayLimit, setEssayLimit] = useState('1')

  const isEditing = !!classId

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: '',
      description: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'active',
      class_type: 'standard',
      teacher_id: '',
    },
  })

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadTeachers()
      if (isEditing) {
        await loadClass()
        await loadModulesAndRules()
      }
      setLoading(false)
    }
    init()
  }, [classId])

  const loadTeachers = async () => {
    try {
      const data = await getTeachers()
      setTeachers(data)

      // If not editing, try to find current user in teachers list to set as default
      if (!isEditing) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const currentTeacher = data.find(t => t.user_id === user.id)
          if (currentTeacher) {
            form.setValue('teacher_id', currentTeacher.id)
          }
        }
      }
    } catch (error) {
      logger.error('Erro ao carregar professores:', error)
    }
  }

  const loadClass = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single()

      if (error) throw error

      const classData = data as any
      if (classData) {
        form.reset({
          name: classData.name,
          description: classData.description || '',
          start_date: classData.start_date,
          end_date: classData.end_date,
          status: classData.status || 'active',
          class_type: classData.class_type || 'standard',
          teacher_id: classData.teacher_id || '',
        })
        setAccessDuration(classData.access_duration_days ?? '')
        setIsDefault(classData.is_default ?? false)
      }
    } catch (error) {
      logger.error('Erro ao carregar turma:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados da turma',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadModulesAndRules = async () => {
    try {
      // Fetch modules from courses linked to this class
      const { data: linkedCourses } = await supabase
        .from('class_courses')
        .select('video_courses(id, name, video_modules(id, name, order_index, video_lessons(id, title, order_index)))')
        .eq('class_id', classId)

      const allModules = (linkedCourses || []).flatMap((lc: any) =>
        lc.video_courses?.video_modules?.map((m: any) => ({
          ...m,
          courseName: lc.video_courses.name
        })) || []
      ).sort((a: any, b: any) => a.order_index - b.order_index)

      setModules(allModules)

      // Build lessons map per module
      const lessonsMap: Record<string, { id: string; title: string; order_index: number }[]> = {}
      allModules.forEach((mod: any) => {
        if (mod.video_lessons) {
          lessonsMap[mod.id] = [...mod.video_lessons].sort((a: any, b: any) => a.order_index - b.order_index)
        }
      })
      setModuleLessons(lessonsMap)

      // Fetch existing module rules
      const rules = await getModuleRulesForClass(classId!)
      const rulesMap: Record<string, any> = {}
      rules.forEach(r => { rulesMap[r.module_id] = { rule_type: r.rule_type, rule_value: r.rule_value || '' } })
      setModuleRules(rulesMap)

      // Fetch existing lesson rules
      const lRules = await getLessonRulesForClass(classId!)
      const lRulesMap: Record<string, any> = {}
      lRules.forEach(r => { lRulesMap[r.lesson_id] = { rule_type: r.rule_type, rule_value: r.rule_value || '' } })
      setLessonRules(lRulesMap)

      // Load topics for flashcards/quizzes
      const { data: subjects } = await supabase.from('subjects').select('id, name')
      const { data: topics } = await supabase.from('topics').select('id, name, subject_id')
      setAllSubjects(subjects || [])
      setAllTopics(topics || [])

      // Load simulations
      const { data: sims } = await supabase.from('quizzes').select('id, title').eq('type', 'simulation')
      setAllSimulations(sims || [])

      // Load community spaces (only general ones, excluding 'geral' which is always visible)
      const { data: spaces } = await supabase
        .from('community_spaces')
        .select('id, name, slug, icon, color, space_type')
        .eq('is_archived', false)
        .neq('slug', 'geral')
        .eq('space_type', 'general')
        .order('order', { ascending: true })
      setAllCommunitySpaces(spaces || [])

      // Load existing content access
      const access = await getAllContentAccessForClass(classId!)
      setContentAccess(access)

      // Set toggles based on existing data
      setContentToggles({
        flashcard_topic: !access.flashcard_topic?.length,
        quiz_topic: !access.quiz_topic?.length,
        acervo: !access.acervo_category?.length && !access.acervo_concurso?.length,
        simulation: !access.simulation?.length,
        essay_limit: !access.essay_limit?.length,
        community_readonly: !access.community_readonly?.length,
        community_space: !access.community_space?.length,
      })
      if (access.essay_limit?.length) setEssayLimit(access.essay_limit[0])
    } catch (error) {
      logger.error('Erro ao carregar módulos e regras:', error)
    }
  }

  const onSubmit = async (values: ClassFormValues) => {
    try {
      const classPayload = {
        name: values.name,
        description: values.description,
        start_date: values.start_date,
        end_date: values.end_date,
        status: values.status,
        class_type: values.class_type,
        teacher_id: values.teacher_id,
        access_duration_days: accessDuration === '' ? null : accessDuration,
        is_default: isDefault,
      }

      if (isEditing) {
        const { error } = await (supabase as any)
          .from('classes')
          .update(classPayload)
          .eq('id', classId)

        if (error) throw error

        // Save module rules
        const rulesToSave = Object.entries(moduleRules)
          .filter(([_, r]) => r.rule_type !== 'free')
          .map(([moduleId, r]) => ({
            class_id: classId!,
            module_id: moduleId,
            rule_type: r.rule_type as any,
            rule_value: r.rule_value || null
          }))
        await saveAllModuleRules(classId!, rulesToSave)

        // Save lesson rules
        // First delete all existing lesson rules, then insert non-free ones
        const allLessonIds = Object.values(moduleLessons).flat().map(l => l.id)
        for (const lessonId of allLessonIds) {
          const lr = lessonRules[lessonId]
          if (lr && lr.rule_type !== 'inherit') {
            await upsertLessonRule({ class_id: classId!, lesson_id: lessonId, rule_type: lr.rule_type as any, rule_value: lr.rule_value || null })
          } else {
            await deleteLessonRule(classId!, lessonId)
          }
        }

        // Save content access
        if (!contentToggles.flashcard_topic) await saveContentAccess(classId!, 'flashcard_topic', contentAccess.flashcard_topic || [])
        else await saveContentAccess(classId!, 'flashcard_topic', [])

        if (!contentToggles.quiz_topic) await saveContentAccess(classId!, 'quiz_topic', contentAccess.quiz_topic || [])
        else await saveContentAccess(classId!, 'quiz_topic', [])

        if (!contentToggles.acervo) {
          await saveContentAccess(classId!, 'acervo_category', contentAccess.acervo_category || [])
          await saveContentAccess(classId!, 'acervo_concurso', contentAccess.acervo_concurso || [])
        } else {
          await saveContentAccess(classId!, 'acervo_category', [])
          await saveContentAccess(classId!, 'acervo_concurso', [])
        }

        if (!contentToggles.simulation) await saveContentAccess(classId!, 'simulation', contentAccess.simulation || [])
        else await saveContentAccess(classId!, 'simulation', [])

        if (!contentToggles.essay_limit) await saveContentAccess(classId!, 'essay_limit', [essayLimit])
        else await saveContentAccess(classId!, 'essay_limit', [])

        if (!contentToggles.community_readonly) await saveContentAccess(classId!, 'community_readonly', ['true'])
        else await saveContentAccess(classId!, 'community_readonly', [])

        if (!contentToggles.community_space) await saveContentAccess(classId!, 'community_space', contentAccess.community_space || [])
        else await saveContentAccess(classId!, 'community_space', [])

        toast({
          title: 'Sucesso',
          description: 'Turma atualizada com sucesso',
        })
      } else {
        const { data: insertedData, error } = await (supabase as any)
          .from('classes')
          .insert(classPayload)
          .select('id')
          .single()

        if (error) throw error

        // Save module rules if we have a new class ID
        if (insertedData?.id) {
          const rulesToSave = Object.entries(moduleRules)
            .filter(([_, r]) => r.rule_type !== 'free')
            .map(([moduleId, r]) => ({
              class_id: insertedData.id,
              module_id: moduleId,
              rule_type: r.rule_type as any,
              rule_value: r.rule_value || null
            }))
          await saveAllModuleRules(insertedData.id, rulesToSave)

          // Save lesson rules
          for (const [lessonId, lr] of Object.entries(lessonRules)) {
            if (lr.rule_type !== 'inherit') {
              await upsertLessonRule({ class_id: insertedData.id, lesson_id: lessonId, rule_type: lr.rule_type as any, rule_value: lr.rule_value || null })
            }
          }

          // Save content access
          const newClassId = insertedData.id
          if (!contentToggles.flashcard_topic) await saveContentAccess(newClassId, 'flashcard_topic', contentAccess.flashcard_topic || [])
          else await saveContentAccess(newClassId, 'flashcard_topic', [])

          if (!contentToggles.quiz_topic) await saveContentAccess(newClassId, 'quiz_topic', contentAccess.quiz_topic || [])
          else await saveContentAccess(newClassId, 'quiz_topic', [])

          if (!contentToggles.acervo) {
            await saveContentAccess(newClassId, 'acervo_category', contentAccess.acervo_category || [])
            await saveContentAccess(newClassId, 'acervo_concurso', contentAccess.acervo_concurso || [])
          } else {
            await saveContentAccess(newClassId, 'acervo_category', [])
            await saveContentAccess(newClassId, 'acervo_concurso', [])
          }

          if (!contentToggles.simulation) await saveContentAccess(newClassId, 'simulation', contentAccess.simulation || [])
          else await saveContentAccess(newClassId, 'simulation', [])

          if (!contentToggles.essay_limit) await saveContentAccess(newClassId, 'essay_limit', [essayLimit])
          else await saveContentAccess(newClassId, 'essay_limit', [])

          if (!contentToggles.community_readonly) await saveContentAccess(newClassId, 'community_readonly', ['true'])
          else await saveContentAccess(newClassId, 'community_readonly', [])

          if (!contentToggles.community_space) await saveContentAccess(newClassId, 'community_space', contentAccess.community_space || [])
          else await saveContentAccess(newClassId, 'community_space', [])
        }

        toast({
          title: 'Sucesso',
          description: 'Turma criada com sucesso',
        })
      }

      navigate('/admin/classes')
    } catch (error) {
      logger.error('Erro ao salvar turma:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a turma',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return <SectionLoader />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{isEditing ? 'Editar Turma' : 'Nova Turma'}</h1>
        <p className="text-sm text-muted-foreground">{isEditing ? 'Edite as informações da turma' : 'Crie uma nova turma no sistema'}</p>
      </div>
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin/classes')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-muted/50">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {isEditing ? 'Editar Turma' : 'Nova Turma'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Preencha as informações da turma
                </p>
              </div>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Nome da Turma *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Turma 2025.1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descrição da turma (opcional)"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Início *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data da Prova (fim do acesso) *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormDescription>
                        Os alunos perdem acesso à plataforma após esta data
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="class_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Turma *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="standard">Padrão</SelectItem>
                          <SelectItem value="trial">Trial (Teste)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Turmas trial têm acesso limitado
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="teacher_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Professor Responsável *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um professor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {teachers.length === 0 ? (
                            <SelectItem value="none" disabled>Nenhum professor encontrado</SelectItem>
                          ) : (
                            teachers.map((teacher) => (
                              <SelectItem key={teacher.id} value={teacher.id}>
                                {teacher.first_name} {teacher.last_name} ({teacher.email})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Ativa</SelectItem>
                          <SelectItem value="inactive">Inativa</SelectItem>
                          <SelectItem value="archived">Arquivada</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Turmas ativas aparecem para os alunos
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Prazo de Acesso</CardTitle>
                  <CardDescription>Ao matricular um aluno, o acesso expira apos esse prazo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={accessDuration}
                      onChange={e => setAccessDuration(e.target.value ? parseInt(e.target.value) : '')}
                      placeholder="Ilimitado"
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">dias</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
                    <label className="text-sm">Turma padrao - Ingressar membros com acesso ilimitado nesta turma</label>
                  </div>
                </CardContent>
              </Card>

              {modules.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Regras de Liberacao de Modulos e Aulas</CardTitle>
                    <CardDescription>Defina quando cada modulo sera liberado. Clique no modulo para configurar aulas individuais.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="grid grid-cols-[1fr_1fr] gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                        <span>NOME DO MODULO / AULA</span>
                        <span>REGRA DE ACESSO</span>
                      </div>
                      {modules.map(mod => {
                        const rule = moduleRules[mod.id] || { rule_type: 'free', rule_value: '' }
                        const isExpanded = expandedModules.has(mod.id)
                        const lessons = moduleLessons[mod.id] || []
                        const lessonOverrideCount = lessons.filter(l => lessonRules[l.id] && lessonRules[l.id].rule_type !== 'inherit').length
                        return (
                          <div key={mod.id}>
                            <div className="grid grid-cols-[1fr_1fr] gap-4 items-center py-2 border-b border-border/50">
                              <div
                                className="flex items-center gap-2 cursor-pointer select-none"
                                onClick={() => {
                                  setExpandedModules(prev => {
                                    const next = new Set(prev)
                                    if (next.has(mod.id)) next.delete(mod.id)
                                    else next.add(mod.id)
                                    return next
                                  })
                                }}
                              >
                                {lessons.length > 0 ? (
                                  isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                ) : <span className="w-4" />}
                                <div>
                                  <p className="text-sm font-medium">{mod.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {mod.courseName}
                                    {lessons.length > 0 && <span> &middot; {lessons.length} aulas</span>}
                                    {lessonOverrideCount > 0 && (
                                      <Badge variant="outline" className="ml-2 text-xs py-0 px-1.5 bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-700">
                                        {lessonOverrideCount} com regra propria
                                      </Badge>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <select
                                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                  value={rule.rule_type}
                                  onChange={e => {
                                    setModuleRules(prev => ({
                                      ...prev,
                                      [mod.id]: { ...prev[mod.id], rule_type: e.target.value, rule_value: '' }
                                    }))
                                  }}
                                >
                                  <option value="free">Acesso Livre</option>
                                  <option value="scheduled_date">Data programada</option>
                                  <option value="days_after_enrollment">Dias apos compra</option>
                                  <option value="hidden">Oculto</option>
                                  <option value="blocked">Bloqueado</option>
                                  <option value="module_completed">Modulo concluido</option>
                                </select>
                                {rule.rule_type === 'scheduled_date' && (
                                  <Input type="date" value={rule.rule_value} onChange={e => setModuleRules(prev => ({...prev, [mod.id]: {...prev[mod.id], rule_value: e.target.value}}))} className="w-40" />
                                )}
                                {rule.rule_type === 'days_after_enrollment' && (
                                  <Input type="number" value={rule.rule_value} onChange={e => setModuleRules(prev => ({...prev, [mod.id]: {...prev[mod.id], rule_value: e.target.value}}))} placeholder="dias" className="w-24" />
                                )}
                                {rule.rule_type === 'module_completed' && (
                                  <select
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                    value={rule.rule_value}
                                    onChange={e => {
                                      const allRules = Object.entries(moduleRules).map(([mid, r]) => ({ module_id: mid, class_id: classId!, rule_type: r.rule_type as any, rule_value: r.rule_value }))
                                      if (checkCircularDependency(allRules, mod.id, e.target.value)) {
                                        toast({ title: 'Dependencia circular detectada!', variant: 'destructive' })
                                        return
                                      }
                                      setModuleRules(prev => ({...prev, [mod.id]: {...prev[mod.id], rule_value: e.target.value}}))
                                    }}
                                  >
                                    <option value="">Selecione...</option>
                                    {modules.filter(m => m.id !== mod.id).map(m => (
                                      <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>
                            {/* Expanded lessons */}
                            {isExpanded && lessons.length > 0 && (
                              <div className="ml-6 border-l-2 border-border/50">
                                {lessons.map(lesson => {
                                  const lr = lessonRules[lesson.id] || { rule_type: 'inherit', rule_value: '' }
                                  return (
                                    <div key={lesson.id} className="grid grid-cols-[1fr_1fr] gap-4 items-center py-1.5 pl-4 border-b border-border/30">
                                      <div className="flex items-center gap-2">
                                        <PlayCircle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                        <p className="text-sm text-muted-foreground">{lesson.title}</p>
                                      </div>
                                      <div className="flex gap-2">
                                        <select
                                          className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                                          value={lr.rule_type}
                                          onChange={e => {
                                            setLessonRules(prev => ({
                                              ...prev,
                                              [lesson.id]: { rule_type: e.target.value, rule_value: '' }
                                            }))
                                          }}
                                        >
                                          <option value="inherit">Herdar do modulo</option>
                                          <option value="free">Acesso Livre</option>
                                          <option value="scheduled_date">Data programada</option>
                                          <option value="days_after_enrollment">Dias apos compra</option>
                                          <option value="hidden">Oculto</option>
                                          <option value="blocked">Bloqueado</option>
                                        </select>
                                        {lr.rule_type === 'scheduled_date' && (
                                          <Input type="date" value={lr.rule_value} onChange={e => setLessonRules(prev => ({...prev, [lesson.id]: {...prev[lesson.id], rule_value: e.target.value}}))} className="w-40 h-8 text-xs" />
                                        )}
                                        {lr.rule_type === 'days_after_enrollment' && (
                                          <Input type="number" value={lr.rule_value} onChange={e => setLessonRules(prev => ({...prev, [lesson.id]: {...prev[lesson.id], rule_value: e.target.value}}))} placeholder="dias" className="w-24 h-8 text-xs" />
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Acesso ao Conteúdo</CardTitle>
                  <CardDescription>Defina quais conteúdos os alunos desta turma podem acessar. Por padrão, tudo é liberado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                  {/* Flashcards */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">Flashcards</h4>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={contentToggles.flashcard_topic} onChange={e => {
                          setContentToggles(p => ({...p, flashcard_topic: e.target.checked}))
                          if (e.target.checked) setContentAccess(p => { const n = {...p}; delete n.flashcard_topic; return n })
                        }} />
                        Todos os tópicos
                      </label>
                    </div>
                    {!contentToggles.flashcard_topic && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-4">
                        {allSubjects.map(subject => (
                          <div key={subject.id}>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">{subject.name}</p>
                            {allTopics.filter(t => t.subject_id === subject.id).map(topic => (
                              <label key={topic.id} className="flex items-center gap-2 text-sm py-0.5">
                                <input type="checkbox"
                                  checked={contentAccess.flashcard_topic?.includes(topic.id) || false}
                                  onChange={e => {
                                    setContentAccess(prev => {
                                      const current = prev.flashcard_topic || []
                                      return { ...prev, flashcard_topic: e.target.checked
                                        ? [...current, topic.id]
                                        : current.filter(id => id !== topic.id) }
                                    })
                                  }}
                                />
                                {topic.name}
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border" />

                  {/* Quizzes */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">Quizzes</h4>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={contentToggles.quiz_topic} onChange={e => {
                          setContentToggles(p => ({...p, quiz_topic: e.target.checked}))
                          if (e.target.checked) setContentAccess(p => { const n = {...p}; delete n.quiz_topic; return n })
                        }} />
                        Todos os tópicos
                      </label>
                    </div>
                    {!contentToggles.quiz_topic && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-4">
                        {allSubjects.map(subject => (
                          <div key={subject.id}>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">{subject.name}</p>
                            {allTopics.filter(t => t.subject_id === subject.id).map(topic => (
                              <label key={topic.id} className="flex items-center gap-2 text-sm py-0.5">
                                <input type="checkbox"
                                  checked={contentAccess.quiz_topic?.includes(topic.id) || false}
                                  onChange={e => {
                                    setContentAccess(prev => {
                                      const current = prev.quiz_topic || []
                                      return { ...prev, quiz_topic: e.target.checked
                                        ? [...current, topic.id]
                                        : current.filter(id => id !== topic.id) }
                                    })
                                  }}
                                />
                                {topic.name}
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border" />

                  {/* Acervo Digital */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">Acervo Digital</h4>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={contentToggles.acervo} onChange={e => {
                          setContentToggles(p => ({...p, acervo: e.target.checked}))
                          if (e.target.checked) setContentAccess(p => { const n = {...p}; delete n.acervo_category; delete n.acervo_concurso; return n })
                        }} />
                        Todo o acervo
                      </label>
                    </div>
                    {!contentToggles.acervo && (
                      <div className="pl-4 space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Categorias</p>
                          <div className="flex flex-wrap gap-3">
                            {['prova', 'livro', 'apostila', 'exercicio', 'regulamento', 'mapa_mental'].map(cat => (
                              <label key={cat} className="flex items-center gap-2 text-sm">
                                <input type="checkbox"
                                  checked={contentAccess.acervo_category?.includes(cat) || false}
                                  onChange={e => {
                                    setContentAccess(prev => {
                                      const current = prev.acervo_category || []
                                      return { ...prev, acervo_category: e.target.checked ? [...current, cat] : current.filter(id => id !== cat) }
                                    })
                                  }}
                                />
                                {cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Concursos</p>
                          <div className="flex flex-wrap gap-3">
                            {['EAOF', 'EAOP', 'CAMAR', 'CADAR', 'CAFAR', 'CFOE'].map(conc => (
                              <label key={conc} className="flex items-center gap-2 text-sm">
                                <input type="checkbox"
                                  checked={contentAccess.acervo_concurso?.includes(conc) || false}
                                  onChange={e => {
                                    setContentAccess(prev => {
                                      const current = prev.acervo_concurso || []
                                      return { ...prev, acervo_concurso: e.target.checked ? [...current, conc] : current.filter(id => id !== conc) }
                                    })
                                  }}
                                />
                                {conc}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border" />

                  {/* Simulados */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">Simulados</h4>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={contentToggles.simulation} onChange={e => {
                          setContentToggles(p => ({...p, simulation: e.target.checked}))
                          if (e.target.checked) setContentAccess(p => { const n = {...p}; delete n.simulation; return n })
                        }} />
                        Todos os simulados
                      </label>
                    </div>
                    {!contentToggles.simulation && allSimulations.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                        {allSimulations.map(sim => (
                          <label key={sim.id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox"
                              checked={contentAccess.simulation?.includes(sim.id) || false}
                              onChange={e => {
                                setContentAccess(prev => {
                                  const current = prev.simulation || []
                                  return { ...prev, simulation: e.target.checked ? [...current, sim.id] : current.filter(id => id !== sim.id) }
                                })
                              }}
                            />
                            {sim.title}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border" />

                  {/* Redação */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">Redação</h4>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={contentToggles.essay_limit} onChange={e => {
                          setContentToggles(p => ({...p, essay_limit: e.target.checked}))
                          if (e.target.checked) setContentAccess(p => { const n = {...p}; delete n.essay_limit; return n })
                        }} />
                        Ilimitado
                      </label>
                    </div>
                    {!contentToggles.essay_limit && (
                      <div className="flex items-center gap-2 pl-4">
                        <span className="text-sm">Máximo de envios:</span>
                        <Input type="number" min="1" value={essayLimit} onChange={e => setEssayLimit(e.target.value)} className="w-20" />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border" />

                  {/* Comunidade - Permissão de escrita */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">Comunidade — Permissão</h4>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={contentToggles.community_readonly} onChange={e => {
                          setContentToggles(p => ({...p, community_readonly: e.target.checked}))
                          if (e.target.checked) setContentAccess(p => { const n = {...p}; delete n.community_readonly; return n })
                        }} />
                        Acesso completo
                      </label>
                    </div>
                    {!contentToggles.community_readonly && (
                      <p className="text-sm text-muted-foreground pl-4">Somente leitura — aluno pode ver posts mas não pode criar ou comentar</p>
                    )}
                  </div>

                  <div className="border-t border-border" />

                  {/* Comunidade - Espaços visíveis */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">Comunidade — Espaços Visíveis</h4>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={contentToggles.community_space} onChange={e => {
                          setContentToggles(p => ({...p, community_space: e.target.checked}))
                          if (e.target.checked) setContentAccess(p => { const n = {...p}; delete n.community_space; return n })
                        }} />
                        Todos os espaços
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-4">
                      "Geral" e o espaço da turma estão sempre visíveis. Aqui você controla os espaços temáticos (EAOF, CADAR, etc).
                    </p>
                    {!contentToggles.community_space && allCommunitySpaces.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                        {allCommunitySpaces.map(space => (
                          <label key={space.id} className="flex items-center gap-2 text-sm py-0.5">
                            <input type="checkbox"
                              checked={contentAccess.community_space?.includes(space.id) || false}
                              onChange={e => {
                                setContentAccess(prev => {
                                  const current = prev.community_space || []
                                  return { ...prev, community_space: e.target.checked
                                    ? [...current, space.id]
                                    : current.filter(id => id !== space.id) }
                                })
                              }}
                            />
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: space.color }}
                            />
                            {space.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                </CardContent>
              </Card>

              <div className="flex items-center gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/admin/classes')}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? 'Salvar Alterações' : 'Criar Turma'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
        </Card>
      </div>
    </div>
  )
}
