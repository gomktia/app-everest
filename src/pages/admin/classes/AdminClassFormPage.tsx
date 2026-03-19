import { useEffect, useState, useCallback } from 'react'
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
import { ArrowLeft, GraduationCap, Save, ChevronDown, ChevronRight, PlayCircle, BookOpen, Shield, GripVertical } from 'lucide-react'
import { getModuleRulesForClass, saveAllModuleRules, checkCircularDependency, getLessonRulesForClass, upsertLessonRule, deleteLessonRule, type LessonRule } from '@/services/moduleRulesService'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { getAllContentAccessForClass, saveContentAccess } from '@/services/contentAccessService'
import { PageTabs } from '@/components/PageTabs'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const classSchema = z.object({
  name: z.string().min(1, 'O nome da turma é obrigatório'),
  description: z.string().optional(),
  start_date: z.string().min(1, 'A data de início é obrigatória'),
  end_date: z.string().min(1, 'A data de término é obrigatória'),
  status: z.enum(['active', 'inactive', 'archived']),
  class_type: z.enum(['standard', 'trial']).default('standard'),
  teacher_id: z.string().min(1, 'O professor é obrigatório'),
}).refine(
  (data) => !data.start_date || !data.end_date || data.end_date >= data.start_date,
  {
    message: 'A data de término deve ser igual ou posterior à data de início',
    path: ['end_date'],
  }
)

type ClassFormValues = z.infer<typeof classSchema>

import { getTeachers, Teacher } from '@/services/teacherService'

function SortableModuleRow({
  mod,
  rule,
  isExpanded,
  lessons,
  lessonRules,
  modules,
  classId,
  onToggleExpand,
  onRuleChange,
  onLessonRuleChange,
  onCircularCheck,
}: {
  mod: any
  rule: { rule_type: string; rule_value: string }
  isExpanded: boolean
  lessons: { id: string; title: string; order_index: number }[]
  lessonRules: Record<string, { rule_type: string; rule_value: string }>
  modules: any[]
  classId: string
  onToggleExpand: () => void
  onRuleChange: (ruleType: string, ruleValue: string) => void
  onLessonRuleChange: (lessonId: string, ruleType: string, ruleValue: string) => void
  onCircularCheck: (targetModuleId: string) => boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: mod.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  const lessonOverrideCount = lessons.filter(l => lessonRules[l.id] && lessonRules[l.id].rule_type !== 'inherit').length

  return (
    <div ref={setNodeRef} style={style}>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-4 items-center py-2 border-b border-border/50">
        <button type="button" className="cursor-grab active:cursor-grabbing touch-none p-1 text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
        <div
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={onToggleExpand}
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
            onChange={e => onRuleChange(e.target.value, '')}
          >
            <option value="free">Acesso Livre</option>
            <option value="scheduled_date">Data programada</option>
            <option value="days_after_enrollment">Dias apos compra</option>
            <option value="hidden">Oculto</option>
            <option value="blocked">Bloqueado</option>
            <option value="module_completed">Modulo concluido</option>
          </select>
          {rule.rule_type === 'scheduled_date' && (
            <Input type="date" value={rule.rule_value} onChange={e => onRuleChange(rule.rule_type, e.target.value)} className="w-40" />
          )}
          {rule.rule_type === 'days_after_enrollment' && (
            <Input type="number" value={rule.rule_value} onChange={e => onRuleChange(rule.rule_type, e.target.value)} placeholder="dias" className="w-24" />
          )}
          {rule.rule_type === 'module_completed' && (
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={rule.rule_value}
              onChange={e => {
                if (onCircularCheck(e.target.value)) {
                  onRuleChange(rule.rule_type, e.target.value)
                }
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
        <div className="ml-10 border-l-2 border-border/50">
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
                    onChange={e => onLessonRuleChange(lesson.id, e.target.value, '')}
                  >
                    <option value="inherit">Herdar do modulo</option>
                    <option value="free">Acesso Livre</option>
                    <option value="scheduled_date">Data programada</option>
                    <option value="days_after_enrollment">Dias apos compra</option>
                    <option value="hidden">Oculto</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                  {lr.rule_type === 'scheduled_date' && (
                    <Input type="date" value={lr.rule_value} onChange={e => onLessonRuleChange(lesson.id, lr.rule_type, e.target.value)} className="w-40 h-8 text-xs" />
                  )}
                  {lr.rule_type === 'days_after_enrollment' && (
                    <Input type="number" value={lr.rule_value} onChange={e => onLessonRuleChange(lesson.id, lr.rule_type, e.target.value)} placeholder="dias" className="w-24 h-8 text-xs" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function AdminClassFormPage() {
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()
  usePageTitle('Configurar Turma')
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [accessDuration, setAccessDuration] = useState<number | ''>('')
  const [isDefault, setIsDefault] = useState(false)
  const [moduleRules, setModuleRules] = useState<Record<string, { rule_type: string; rule_value: string }>>({})
  const [modules, setModules] = useState<any[]>([])
  const [contentAccess, setContentAccess] = useState<Record<string, string[]>>({})
  const [accessTab, setAccessTab] = useState('flashcards')
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
  const [activeTab, setActiveTab] = useState('info')

  const isEditing = !!classId
  const [moduleOrderDirty, setModuleOrderDirty] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleModuleReorder = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setModules(prev => {
      const oldIndex = prev.findIndex(m => m.id === active.id)
      const newIndex = prev.findIndex(m => m.id === over.id)
      return arrayMove(prev, oldIndex, newIndex).map((m, i) => ({ ...m, order_index: i }))
    })
    setModuleOrderDirty(true)
  }, [])

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

      // Set toggles based on existing data (before filtering markers)
      const hasSimulationRestriction = !!access.simulation?.length
      setContentToggles({
        flashcard_topic: !access.flashcard_topic?.length,
        quiz_topic: !access.quiz_topic?.length,
        acervo: !access.acervo_category?.length && !access.acervo_concurso?.length,
        simulation: !hasSimulationRestriction,
        essay_limit: !access.essay_limit?.length,
        community_readonly: !access.community_readonly?.length,
        community_space: !access.community_space?.length,
      })
      // Filter out __none__ markers after toggle calculation
      if (access.simulation?.includes('__none__')) {
        access.simulation = []
      }
      setContentAccess(access)
      if (access.essay_limit?.length) setEssayLimit(access.essay_limit[0])
    } catch (error) {
      logger.error('Erro ao carregar módulos e regras:', error)
      toast({
        title: 'Erro ao carregar módulos',
        description: 'Não foi possível carregar os módulos e regras de acesso. Tente recarregar a página.',
        variant: 'destructive',
      })
    }
  }

  const onSubmit = async (values: ClassFormValues) => {
    if (isSaving) return
    setIsSaving(true)
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

        // Save module order if changed
        if (moduleOrderDirty) {
          await Promise.all(
            modules.map((mod, i) =>
              supabase.from('video_modules').update({ order_index: i }).eq('id', mod.id)
            )
          )
        }

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

        // Save lesson rules (parallel for speed)
        const allLessonIds = Object.values(moduleLessons).flat().map(l => l.id)
        await Promise.all(allLessonIds.map(lessonId => {
          const lr = lessonRules[lessonId]
          if (lr && lr.rule_type !== 'inherit') {
            return upsertLessonRule({ class_id: classId!, lesson_id: lessonId, rule_type: lr.rule_type as any, rule_value: lr.rule_value || null })
          }
          return deleteLessonRule(classId!, lessonId)
        }))

        // Save content access (parallel for speed)
        await Promise.all([
          saveContentAccess(classId!, 'flashcard_topic', contentToggles.flashcard_topic ? [] : contentAccess.flashcard_topic || []),
          saveContentAccess(classId!, 'quiz_topic', contentToggles.quiz_topic ? [] : contentAccess.quiz_topic || []),
          saveContentAccess(classId!, 'acervo_category', contentToggles.acervo ? [] : contentAccess.acervo_category || []),
          saveContentAccess(classId!, 'acervo_concurso', contentToggles.acervo ? [] : contentAccess.acervo_concurso || []),
          saveContentAccess(classId!, 'simulation', contentToggles.simulation ? [] : (contentAccess.simulation?.length ? contentAccess.simulation : ['__none__'])),
          saveContentAccess(classId!, 'essay_limit', contentToggles.essay_limit ? [] : [essayLimit]),
          saveContentAccess(classId!, 'community_readonly', contentToggles.community_readonly ? [] : ['true']),
          saveContentAccess(classId!, 'community_space', contentToggles.community_space ? [] : contentAccess.community_space || []),
        ])

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

          // Save content access (parallel for speed)
          const newClassId = insertedData.id
          try {
            await Promise.all([
              saveContentAccess(newClassId, 'flashcard_topic', contentToggles.flashcard_topic ? [] : contentAccess.flashcard_topic || []),
              saveContentAccess(newClassId, 'quiz_topic', contentToggles.quiz_topic ? [] : contentAccess.quiz_topic || []),
              saveContentAccess(newClassId, 'acervo_category', contentToggles.acervo ? [] : contentAccess.acervo_category || []),
              saveContentAccess(newClassId, 'acervo_concurso', contentToggles.acervo ? [] : contentAccess.acervo_concurso || []),
              saveContentAccess(newClassId, 'simulation', contentToggles.simulation ? [] : (contentAccess.simulation?.length ? contentAccess.simulation : ['__none__'])),
              saveContentAccess(newClassId, 'essay_limit', contentToggles.essay_limit ? [] : [essayLimit]),
              saveContentAccess(newClassId, 'community_readonly', contentToggles.community_readonly ? [] : ['true']),
              saveContentAccess(newClassId, 'community_space', contentToggles.community_space ? [] : contentAccess.community_space || []),
            ])
          } catch (contentError) {
            logger.error('Erro ao salvar acesso de conteúdo da nova turma:', contentError)
            toast({
              title: 'Turma criada, mas houve erro ao salvar acesso de conteúdo',
              description: 'Edite a turma para configurar o acesso ao conteúdo.',
              variant: 'destructive',
            })
            setIsSaving(false)
            return // Stay on page so admin can retry content access
          }
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
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return <SectionLoader />
  }

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
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
              <PageTabs
                value={activeTab}
                onChange={setActiveTab}
                layout="full"
                tabs={[
                  {
                    value: 'info',
                    label: 'Informações',
                    icon: <GraduationCap className="h-4 w-4" />,
                    content: (
                      <div className="space-y-6">
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
                      min="0"
                      value={accessDuration}
                      onChange={e => setAccessDuration(e.target.value ? Math.max(0, parseInt(e.target.value)) : '')}
                      placeholder="Ilimitado"
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">dias</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                    <label className="text-sm">Turma padrão — Ingressar membros com acesso ilimitado nesta turma</label>
                  </div>
                </CardContent>
              </Card>
                      </div>
                    ),
                  },
                  {
                    value: 'modules',
                    label: 'Módulos e Aulas',
                    icon: <BookOpen className="h-4 w-4" />,
                    content: (
                      <div className="space-y-6">
              {modules.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Regras de Liberacao de Modulos e Aulas</CardTitle>
                    <CardDescription>Defina quando cada modulo sera liberado. Clique no modulo para configurar aulas individuais.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="grid grid-cols-[auto_1fr_1fr] gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                        <span className="w-6" />
                        <span>NOME DO MODULO / AULA</span>
                        <span>REGRA DE ACESSO</span>
                      </div>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleReorder}>
                        <SortableContext items={modules.map(m => m.id)} strategy={verticalListSortingStrategy}>
                          {modules.map(mod => (
                            <SortableModuleRow
                              key={mod.id}
                              mod={mod}
                              rule={moduleRules[mod.id] || { rule_type: 'free', rule_value: '' }}
                              isExpanded={expandedModules.has(mod.id)}
                              lessons={moduleLessons[mod.id] || []}
                              lessonRules={lessonRules}
                              modules={modules}
                              classId={classId!}
                              onToggleExpand={() => {
                                setExpandedModules(prev => {
                                  const next = new Set(prev)
                                  if (next.has(mod.id)) next.delete(mod.id)
                                  else next.add(mod.id)
                                  return next
                                })
                              }}
                              onRuleChange={(ruleType, ruleValue) => {
                                setModuleRules(prev => ({
                                  ...prev,
                                  [mod.id]: { rule_type: ruleType, rule_value: ruleValue }
                                }))
                              }}
                              onLessonRuleChange={(lessonId, ruleType, ruleValue) => {
                                setLessonRules(prev => ({
                                  ...prev,
                                  [lessonId]: { rule_type: ruleType, rule_value: ruleValue }
                                }))
                              }}
                              onCircularCheck={(targetModuleId) => {
                                const allRules = Object.entries(moduleRules).map(([mid, r]) => ({ module_id: mid, class_id: classId!, rule_type: r.rule_type as any, rule_value: r.rule_value }))
                                if (checkCircularDependency(allRules, mod.id, targetModuleId)) {
                                  toast({ title: 'Dependencia circular detectada!', variant: 'destructive' })
                                  return false
                                }
                                return true
                              }}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    </div>
                  </CardContent>
                </Card>
              )}
              {modules.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum módulo encontrado para esta turma. Adicione cursos e módulos primeiro.</p>
              )}
                      </div>
                    ),
                  },
                  {
                    value: 'access',
                    label: 'Acesso ao Conteúdo',
                    icon: <Shield className="h-4 w-4" />,
                    content: (
                      <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Acesso ao Conteúdo</CardTitle>
                  <CardDescription>Defina quais conteúdos os alunos desta turma podem acessar. Por padrão, tudo é liberado.</CardDescription>
                </CardHeader>
                <CardContent>
                  <PageTabs
                    tabs={[
                      {
                        value: 'flashcards', label: 'Flashcards',
                        content: (
                          <div className="space-y-3 pt-4">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-sm">
                                <Switch checked={contentToggles.flashcard_topic} onCheckedChange={checked => {
                                  setContentToggles(p => ({...p, flashcard_topic: checked}))
                                  if (checked) setContentAccess(p => { const n = {...p}; delete n.flashcard_topic; return n })
                                }} />
                                Todos os tópicos
                              </label>
                            </div>
                            {!contentToggles.flashcard_topic && (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {allSubjects.map(subject => (
                                  <div key={subject.id}>
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">{subject.name}</p>
                                    {allTopics.filter(t => t.subject_id === subject.id).map(topic => (
                                      <label key={topic.id} className="flex items-center gap-2 text-sm py-0.5">
                                        <Switch checked={contentAccess.flashcard_topic?.includes(topic.id) || false} onCheckedChange={checked => {
                                          setContentAccess(prev => {
                                            const current = prev.flashcard_topic || []
                                            return { ...prev, flashcard_topic: checked ? [...current, topic.id] : current.filter(id => id !== topic.id) }
                                          })
                                        }} />
                                        {topic.name}
                                      </label>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ),
                      },
                      {
                        value: 'quizzes', label: 'Quizzes',
                        content: (
                          <div className="space-y-3 pt-4">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-sm">
                                <Switch checked={contentToggles.quiz_topic} onCheckedChange={checked => {
                                  setContentToggles(p => ({...p, quiz_topic: checked}))
                                  if (checked) setContentAccess(p => { const n = {...p}; delete n.quiz_topic; return n })
                                }} />
                                Todos os tópicos
                              </label>
                            </div>
                            {!contentToggles.quiz_topic && (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {allSubjects.map(subject => (
                                  <div key={subject.id}>
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">{subject.name}</p>
                                    {allTopics.filter(t => t.subject_id === subject.id).map(topic => (
                                      <label key={topic.id} className="flex items-center gap-2 text-sm py-0.5">
                                        <Switch checked={contentAccess.quiz_topic?.includes(topic.id) || false} onCheckedChange={checked => {
                                          setContentAccess(prev => {
                                            const current = prev.quiz_topic || []
                                            return { ...prev, quiz_topic: checked ? [...current, topic.id] : current.filter(id => id !== topic.id) }
                                          })
                                        }} />
                                        {topic.name}
                                      </label>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ),
                      },
                      {
                        value: 'acervo', label: 'Acervo',
                        content: (
                          <div className="space-y-3 pt-4">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-sm">
                                <Switch checked={contentToggles.acervo} onCheckedChange={checked => {
                                  setContentToggles(p => ({...p, acervo: checked}))
                                  if (checked) setContentAccess(p => { const n = {...p}; delete n.acervo_category; delete n.acervo_concurso; return n })
                                }} />
                                Todo o acervo
                              </label>
                            </div>
                            {!contentToggles.acervo && (
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">Categorias</p>
                                  <div className="flex flex-wrap gap-3">
                                    {['prova', 'livro', 'apostila', 'exercicio', 'regulamento', 'mapa_mental'].map(cat => (
                                      <label key={cat} className="flex items-center gap-2 text-sm">
                                        <Switch checked={contentAccess.acervo_category?.includes(cat) || false} onCheckedChange={checked => {
                                          setContentAccess(prev => {
                                            const current = prev.acervo_category || []
                                            return { ...prev, acervo_category: checked ? [...current, cat] : current.filter(id => id !== cat) }
                                          })
                                        }} />
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
                                        <Switch checked={contentAccess.acervo_concurso?.includes(conc) || false} onCheckedChange={checked => {
                                          setContentAccess(prev => {
                                            const current = prev.acervo_concurso || []
                                            return { ...prev, acervo_concurso: checked ? [...current, conc] : current.filter(id => id !== conc) }
                                          })
                                        }} />
                                        {conc}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ),
                      },
                      {
                        value: 'simulados', label: 'Simulados',
                        content: (
                          <div className="space-y-3 pt-4">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-sm">
                                <Switch checked={contentToggles.simulation} onCheckedChange={checked => {
                                  setContentToggles(p => ({...p, simulation: checked}))
                                  if (checked) setContentAccess(p => { const n = {...p}; delete n.simulation; return n })
                                }} />
                                Todos os simulados
                              </label>
                            </div>
                            {!contentToggles.simulation && allSimulations.length > 0 && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {allSimulations.map(sim => (
                                  <label key={sim.id} className="flex items-center gap-2 text-sm">
                                    <Switch checked={contentAccess.simulation?.includes(sim.id) || false} onCheckedChange={checked => {
                                      setContentAccess(prev => {
                                        const current = prev.simulation || []
                                        return { ...prev, simulation: checked ? [...current, sim.id] : current.filter(id => id !== sim.id) }
                                      })
                                    }} />
                                    {sim.title}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ),
                      },
                      {
                        value: 'redacao', label: 'Redação',
                        content: (
                          <div className="space-y-3 pt-4">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-sm">
                                <Switch checked={contentToggles.essay_limit} onCheckedChange={checked => {
                                  setContentToggles(p => ({...p, essay_limit: checked}))
                                  if (checked) setContentAccess(p => { const n = {...p}; delete n.essay_limit; return n })
                                }} />
                                Ilimitado
                              </label>
                            </div>
                            {!contentToggles.essay_limit && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm">Máximo de envios:</span>
                                <Input type="number" min="1" value={essayLimit} onChange={e => setEssayLimit(e.target.value)} className="w-20" />
                              </div>
                            )}
                          </div>
                        ),
                      },
                      {
                        value: 'comunidade', label: 'Comunidade',
                        content: (
                          <div className="space-y-6 pt-4">
                            <div className="space-y-3">
                              <h4 className="text-sm font-medium">Permissão</h4>
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-sm">
                                  <Switch checked={contentToggles.community_readonly} onCheckedChange={checked => {
                                    setContentToggles(p => ({...p, community_readonly: checked}))
                                    if (checked) setContentAccess(p => { const n = {...p}; delete n.community_readonly; return n })
                                  }} />
                                  Acesso completo
                                </label>
                              </div>
                              {!contentToggles.community_readonly && (
                                <p className="text-sm text-muted-foreground">Somente leitura — aluno pode ver posts mas não pode criar ou comentar</p>
                              )}
                            </div>
                            <div className="border-t border-border" />
                            <div className="space-y-3">
                              <h4 className="text-sm font-medium">Espaços Visíveis</h4>
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-sm">
                                  <Switch checked={contentToggles.community_space} onCheckedChange={checked => {
                                    setContentToggles(p => ({...p, community_space: checked}))
                                    if (checked) setContentAccess(p => { const n = {...p}; delete n.community_space; return n })
                                  }} />
                                  Todos os espaços
                                </label>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                "Geral" e o espaço da turma estão sempre visíveis. Aqui você controla os espaços temáticos.
                              </p>
                              {!contentToggles.community_space && allCommunitySpaces.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {allCommunitySpaces.map(space => (
                                    <label key={space.id} className="flex items-center gap-2 text-sm py-0.5">
                                      <Switch checked={contentAccess.community_space?.includes(space.id) || false} onCheckedChange={checked => {
                                        setContentAccess(prev => {
                                          const current = prev.community_space || []
                                          return { ...prev, community_space: checked ? [...current, space.id] : current.filter(id => id !== space.id) }
                                        })
                                      }} />
                                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: space.color }} />
                                      {space.name}
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ),
                      },
                    ]}
                    value={accessTab}
                    onChange={setAccessTab}
                  />
                </CardContent>
              </Card>
                      </div>
                    ),
                  },
                ]}
              />

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
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Turma'}
                </Button>
              </div>
            </form>
          </Form>
      </div>
    </div>
  )
}
