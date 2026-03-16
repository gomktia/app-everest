import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { createInvite, generateSlug } from '@/services/inviteService'
import { saveContentAccess } from '@/services/contentAccessService'
import { saveAllModuleRules, type ModuleRule } from '@/services/moduleRulesService'
import { updateClassFeaturePermissions, FEATURE_KEYS, type FeatureKey } from '@/services/classPermissionsService'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BookOpen,
  GraduationCap,
  Layers,
  Shield,
  FileText,
  Link as LinkIcon,
  Check,
  ChevronRight,
  ChevronLeft,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Copy,
  ArrowLeft,
  Sparkles,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WizardState {
  // Step 1
  classType: 'trial' | 'standard'
  classId: string | null
  className: string
  classDescription: string
  startDate: string
  endDate: string
  accessDays: string
  // Step 2
  courseId: string | null
  courseName: string
  courseThumbnail: string | null
  // Step 3
  moduleRules: Record<string, { ruleType: string; ruleValue: string }>
  lessonOverrides: Record<string, boolean>
  // Step 4
  featurePermissions: Record<string, boolean>
  // Step 5
  contentAccess: {
    flashcards: { restricted: boolean; ids: string[] }
    quizzes: { restricted: boolean; ids: string[] }
    acervo: { restricted: boolean; categories: string[]; concursos: string[] }
    simulados: { restricted: boolean; ids: string[] }
    redacoes: { restricted: boolean; maxSubmissions: string }
    comunidade: { readOnly: boolean }
  }
  // Step 6
  inviteId: string | null
  inviteTitle: string
  inviteSlug: string
  maxSlots: string
  // Step 7
  completed: boolean
}

interface Course {
  id: string
  name: string
  thumbnail_url: string | null
}

interface Module {
  id: string
  name: string
  sort_order: number
  lessons: Lesson[]
}

interface Lesson {
  id: string
  title: string
  sort_order: number
}

interface SubjectWithTopics {
  id: string
  name: string
  topics: { id: string; name: string }[]
}

interface Simulation {
  id: string
  title: string
}

const STEPS = [
  { label: 'Dados Basicos', icon: BookOpen },
  { label: 'Curso', icon: GraduationCap },
  { label: 'Modulos e Aulas', icon: Layers },
  { label: 'Permissoes', icon: Shield },
  { label: 'Conteudo', icon: FileText },
  { label: 'Convite', icon: LinkIcon },
  { label: 'Revisao', icon: Check },
]

const ALL_FEATURE_KEYS: { key: FeatureKey; label: string }[] = [
  { key: FEATURE_KEYS.VIDEO_LESSONS, label: 'Videoaulas' },
  { key: FEATURE_KEYS.FLASHCARDS, label: 'Flashcards' },
  { key: FEATURE_KEYS.QUIZ, label: 'Quizzes' },
  { key: FEATURE_KEYS.ESSAYS, label: 'Redacoes' },
  { key: FEATURE_KEYS.EVERCAST, label: 'Evercast' },
  { key: FEATURE_KEYS.LIVE_EVENTS, label: 'Eventos ao vivo' },
]

const ACERVO_CATEGORIES = [
  { id: 'prova', label: 'Prova' },
  { id: 'livro', label: 'Livro' },
  { id: 'apostila', label: 'Apostila' },
  { id: 'material_apoio', label: 'Material de apoio' },
  { id: 'legislacao', label: 'Legislacao' },
  { id: 'outro', label: 'Outro' },
]

const ACERVO_CONCURSOS = [
  { id: 'EAOF', label: 'EAOF' },
  { id: 'EAOP', label: 'EAOP' },
  { id: 'EAGS', label: 'EAGS' },
  { id: 'CFS', label: 'CFS' },
  { id: 'EEAR', label: 'EEAR' },
  { id: 'AFA', label: 'AFA' },
  { id: 'EPCAR', label: 'EPCAR' },
  { id: 'EsPCEx', label: 'EsPCEx' },
  { id: 'EsSA', label: 'EsSA' },
  { id: 'CN', label: 'CN (Escola Naval)' },
  { id: 'ENEM', label: 'ENEM' },
]

const MODULE_RULE_OPTIONS = [
  { value: 'free', label: 'Livre' },
  { value: 'blocked', label: 'Bloqueado' },
  { value: 'hidden', label: 'Oculto' },
  { value: 'scheduled_date', label: 'Data programada' },
  { value: 'days_after_enrollment', label: 'Dias apos matricula' },
]

function initialState(): WizardState {
  return {
    classType: 'standard',
    classId: null,
    className: '',
    classDescription: '',
    startDate: '',
    endDate: '',
    accessDays: '',
    courseId: null,
    courseName: '',
    courseThumbnail: null,
    moduleRules: {},
    lessonOverrides: {},
    featurePermissions: Object.fromEntries(ALL_FEATURE_KEYS.map(f => [f.key, true])),
    contentAccess: {
      flashcards: { restricted: false, ids: [] },
      quizzes: { restricted: false, ids: [] },
      acervo: { restricted: false, categories: [], concursos: [] },
      simulados: { restricted: false, ids: [] },
      redacoes: { restricted: false, maxSubmissions: '' },
      comunidade: { readOnly: false },
    },
    inviteId: null,
    inviteTitle: '',
    inviteSlug: '',
    maxSlots: '',
    completed: false,
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function TrialClassWizard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(0)
  const [state, setState] = useState<WizardState>(initialState())
  const [saving, setSaving] = useState(false)

  // Data for dropdowns
  const [courses, setCourses] = useState<Course[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [flashcardSubjects, setFlashcardSubjects] = useState<SubjectWithTopics[]>([])
  const [quizSubjects, setQuizSubjects] = useState<SubjectWithTopics[]>([])
  const [simulations, setSimulations] = useState<Simulation[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [expandedModule, setExpandedModule] = useState<string | null>(null)

  // Helper to patch state
  const patch = useCallback((partial: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])

  // -------------------------------------------------------------------------
  // Data loaders
  // -------------------------------------------------------------------------

  useEffect(() => {
    loadCourses()
  }, [])

  useEffect(() => {
    if (state.courseId) {
      loadModules(state.courseId)
    }
  }, [state.courseId])

  useEffect(() => {
    if (currentStep === 4) {
      loadContentData()
    }
  }, [currentStep])

  async function loadCourses() {
    try {
      const { data } = await (supabase as any)
        .from('video_courses')
        .select('id, name, thumbnail_url')
        .order('name')
      setCourses(data || [])
    } catch (err) {
      logger.error('Erro ao carregar cursos:', err)
    }
  }

  async function loadModules(courseId: string) {
    setLoadingData(true)
    try {
      const { data: mods } = await (supabase as any)
        .from('video_modules')
        .select('id, name, sort_order')
        .eq('course_id', courseId)
        .order('sort_order')

      if (!mods) {
        setModules([])
        setLoadingData(false)
        return
      }

      const moduleIds = mods.map((m: any) => m.id)
      const { data: lessons } = await (supabase as any)
        .from('video_lessons')
        .select('id, title, sort_order, module_id')
        .in('module_id', moduleIds)
        .order('sort_order')

      const modulesWithLessons: Module[] = mods.map((m: any) => ({
        id: m.id,
        name: m.name,
        sort_order: m.sort_order,
        lessons: (lessons || [])
          .filter((l: any) => l.module_id === m.id)
          .map((l: any) => ({ id: l.id, title: l.title, sort_order: l.sort_order })),
      }))

      setModules(modulesWithLessons)
    } catch (err) {
      logger.error('Erro ao carregar modulos:', err)
    } finally {
      setLoadingData(false)
    }
  }

  async function loadContentData() {
    setLoadingData(true)
    try {
      const [subjectsRes, topicsRes, simRes] = await Promise.all([
        supabase.from('subjects').select('id, name').order('name'),
        supabase.from('topics').select('id, name, subject_id').order('name'),
        supabase.from('quizzes').select('id, name').eq('type', 'simulation').eq('status', 'published').order('name'),
      ])

      const subjects = subjectsRes.data || []
      const topics = topicsRes.data || []

      const subjectsWithTopics = subjects.map((s: any) => ({
        id: s.id,
        name: s.name,
        topics: topics.filter((t: any) => t.subject_id === s.id).map((t: any) => ({ id: t.id, name: t.name })),
      })).filter((s: any) => s.topics.length > 0)

      // Flashcards and quizzes share the same subjects/topics
      setFlashcardSubjects(subjectsWithTopics)
      setQuizSubjects(subjectsWithTopics)

      setSimulations((simRes.data || []).map((s: any) => ({ id: s.id, title: s.name })))
    } catch (err) {
      logger.error('Erro ao carregar dados de conteudo:', err)
    } finally {
      setLoadingData(false)
    }
  }

  // -------------------------------------------------------------------------
  // Step save handlers
  // -------------------------------------------------------------------------

  async function saveStep0() {
    if (!state.className.trim()) {
      toast({ title: 'Nome da turma e obrigatorio', variant: 'destructive' })
      return false
    }
    setSaving(true)
    try {
      if (state.classId) {
        const { error } = await (supabase as any)
          .from('classes')
          .update({
            name: state.className.trim(),
            description: state.classDescription.trim() || null,
            start_date: state.startDate || null,
            end_date: state.endDate || null,
            access_duration_days: state.accessDays ? Number(state.accessDays) : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', state.classId)
        if (error) throw error
      } else {
        const { data, error } = await (supabase as any)
          .from('classes')
          .insert({
            name: state.className.trim(),
            description: state.classDescription.trim() || null,
            start_date: state.startDate || null,
            end_date: state.endDate || null,
            access_duration_days: state.accessDays ? Number(state.accessDays) : null,
            class_type: state.classType,
            status: 'active',
            created_by: profile?.id || null,
          })
          .select('id')
          .single()
        if (error) throw error
        patch({ classId: data.id })
      }
      return true
    } catch (err: any) {
      logger.error('Erro ao salvar turma:', err)
      toast({ title: 'Erro ao salvar turma', description: err.message, variant: 'destructive' })
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveStep1() {
    if (!state.courseId) {
      toast({ title: 'Selecione um curso', variant: 'destructive' })
      return false
    }
    if (!state.classId) return false
    setSaving(true)
    try {
      const { error } = await (supabase as any)
        .from('class_courses')
        .upsert(
          { class_id: state.classId, course_id: state.courseId },
          { onConflict: 'class_id,course_id' },
        )
      if (error) throw error
      return true
    } catch (err: any) {
      logger.error('Erro ao vincular curso:', err)
      toast({ title: 'Erro ao vincular curso', description: err.message, variant: 'destructive' })
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveStep2() {
    if (!state.classId) return false
    setSaving(true)
    try {
      const moduleRulesList: ModuleRule[] = modules.map(m => {
        const rule = state.moduleRules[m.id] || { ruleType: 'free', ruleValue: '' }
        return {
          class_id: state.classId!,
          module_id: m.id,
          rule_type: rule.ruleType as ModuleRule['rule_type'],
          rule_value: rule.ruleValue || null,
        }
      })

      await saveAllModuleRules(state.classId, moduleRulesList)

      // Save lesson overrides
      await (supabase as any)
        .from('class_lesson_rules')
        .delete()
        .eq('class_id', state.classId)

      const lessonRules = Object.entries(state.lessonOverrides)
        .filter(([, isFreed]) => isFreed)
        .map(([lessonId]) => ({
          class_id: state.classId!,
          lesson_id: lessonId,
          rule_type: 'free',
          rule_value: null,
        }))

      if (lessonRules.length > 0) {
        const { error } = await (supabase as any)
          .from('class_lesson_rules')
          .insert(lessonRules)
        if (error) throw error
      }

      return true
    } catch (err: any) {
      logger.error('Erro ao salvar regras de modulos:', err)
      toast({ title: 'Erro ao salvar regras', description: err.message, variant: 'destructive' })
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveStep3() {
    if (!state.classId) return false
    setSaving(true)
    try {
      const enabledKeys = Object.entries(state.featurePermissions)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key as FeatureKey)

      const result = await updateClassFeaturePermissions(state.classId, enabledKeys)
      if (!result.success) throw new Error(result.error)
      return true
    } catch (err: any) {
      logger.error('Erro ao salvar permissoes:', err)
      toast({ title: 'Erro ao salvar permissoes', description: err.message, variant: 'destructive' })
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveStep4() {
    if (!state.classId) return false
    setSaving(true)
    try {
      const ca = state.contentAccess

      // Flashcards (content_type must match useContentAccess('flashcard_topic'))
      await saveContentAccess(
        state.classId,
        'flashcard_topic',
        ca.flashcards.restricted ? ca.flashcards.ids : [],
      )

      // Quizzes (content_type must match useContentAccess('quiz_topic'))
      await saveContentAccess(
        state.classId,
        'quiz_topic',
        ca.quizzes.restricted ? ca.quizzes.ids : [],
      )

      // Acervo - categories
      await saveContentAccess(
        state.classId,
        'acervo_category',
        ca.acervo.restricted ? ca.acervo.categories : [],
      )

      // Acervo - concursos
      await saveContentAccess(
        state.classId,
        'acervo_concurso',
        ca.acervo.restricted ? ca.acervo.concursos : [],
      )

      // Simulados
      await saveContentAccess(
        state.classId,
        'simulation',
        ca.simulados.restricted ? ca.simulados.ids : [],
      )

      // Redacoes
      await saveContentAccess(
        state.classId,
        'essay_limit',
        ca.redacoes.restricted && ca.redacoes.maxSubmissions
          ? [ca.redacoes.maxSubmissions]
          : [],
      )

      // Comunidade
      await saveContentAccess(
        state.classId,
        'community_readonly',
        ca.comunidade.readOnly ? ['true'] : [],
      )

      return true
    } catch (err: any) {
      logger.error('Erro ao salvar acesso a conteudo:', err)
      toast({ title: 'Erro ao salvar acesso', description: err.message, variant: 'destructive' })
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveStep5() {
    if (!state.classId) return false
    // Skip invite creation if standard class and no title provided
    if (!state.inviteTitle.trim()) {
      if (state.classType === 'standard') return true
      toast({ title: 'Titulo do convite e obrigatorio', variant: 'destructive' })
      return false
    }
    setSaving(true)
    try {
      const slug = state.inviteSlug.trim() || generateSlug(state.inviteTitle)

      if (state.inviteId) {
        const { error } = await (supabase as any)
          .from('invites')
          .update({
            title: state.inviteTitle.trim(),
            slug,
            max_slots: state.maxSlots ? Number(state.maxSlots) : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', state.inviteId)
        if (error) throw error
        patch({ inviteSlug: slug })
      } else {
        const invite = await createInvite({
          title: state.inviteTitle.trim(),
          slug,
          class_id: state.classId,
          course_id: state.courseId,
          access_duration_days: state.accessDays ? Number(state.accessDays) : null,
          max_slots: state.maxSlots ? Number(state.maxSlots) : null,
          status: 'active',
          created_by_user_id: profile?.id,
        })
        patch({ inviteId: invite.id, inviteSlug: slug })
      }

      return true
    } catch (err: any) {
      logger.error('Erro ao salvar convite:', err)
      toast({ title: 'Erro ao salvar convite', description: err.message, variant: 'destructive' })
      return false
    } finally {
      setSaving(false)
    }
  }

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  const stepSavers = [saveStep0, saveStep1, saveStep2, saveStep3, saveStep4, saveStep5]

  async function handleNext() {
    if (currentStep < 6) {
      const saver = stepSavers[currentStep]
      if (saver) {
        const ok = await saver()
        if (!ok) return
      }
    }
    if (currentStep < 6) {
      setCurrentStep(prev => prev + 1)
      // Auto-fill invite title on step 5 (convite)
      if (currentStep === 4) {
        if (!state.inviteTitle) {
          const title = state.classType === 'trial'
            ? `${state.className} - Degustacao`
            : state.className
          patch({ inviteTitle: title, inviteSlug: generateSlug(title) })
        }
      }
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  async function handleFinish() {
    patch({ completed: true })
    toast({ title: 'Turma de degustacao criada com sucesso!' })
  }

  function getInviteUrl() {
    const base = window.location.origin
    return `${base}/invite/${state.inviteSlug}`
  }

  async function copyInviteUrl() {
    try {
      await navigator.clipboard.writeText(getInviteUrl())
      toast({ title: 'Link copiado!' })
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' })
    }
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  function renderStepper() {
    return (
      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          const isActive = i === currentStep
          const isCompleted = i < currentStep
          return (
            <div key={i} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isCompleted
                      ? 'bg-green-600 text-white'
                      : isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span
                  className={`text-xs mt-1 whitespace-nowrap ${
                    isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 md:w-16 h-0.5 mx-1 md:mx-2 ${
                    i < currentStep ? 'bg-green-600' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ---- STEP 0: Dados Basicos ----
  function renderStep0() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Dados Basicos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tipo de turma */}
          <div>
            <Label>Tipo de turma *</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                type="button"
                onClick={() => patch({ classType: 'standard' })}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  state.classType === 'standard'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <GraduationCap className="w-6 h-6" />
                <span className="font-semibold text-sm">Turma Padrao</span>
                <span className="text-xs text-muted-foreground text-center">Acesso completo, alunos matriculados</span>
              </button>
              <button
                type="button"
                onClick={() => patch({ classType: 'trial' })}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  state.classType === 'trial'
                    ? 'border-orange-500 bg-orange-500/5 text-orange-600'
                    : 'border-border hover:border-orange-500/30'
                }`}
              >
                <Sparkles className="w-6 h-6" />
                <span className="font-semibold text-sm">Degustacao / Trial</span>
                <span className="text-xs text-muted-foreground text-center">Acesso limitado, link de convite</span>
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="className">Nome da turma *</Label>
            <Input
              id="className"
              placeholder={state.classType === 'trial' ? 'Ex: Degustacao EAOF 2026' : 'Ex: Turma A - EAOF 2027'}
              value={state.className}
              onChange={e => patch({ className: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="classDesc">Descricao (opcional)</Label>
            <Textarea
              id="classDesc"
              placeholder={state.classType === 'trial' ? 'Descricao da turma de degustacao...' : 'Descricao da turma...'}
              value={state.classDescription}
              onChange={e => patch({ classDescription: e.target.value })}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Data de inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={state.startDate}
                onChange={e => patch({ startDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data da prova / fim</Label>
              <Input
                id="endDate"
                type="date"
                value={state.endDate}
                onChange={e => patch({ endDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="accessDays">Prazo de acesso em dias (vazio = ilimitado)</Label>
            <Input
              id="accessDays"
              type="number"
              min={1}
              placeholder="Ex: 7"
              value={state.accessDays}
              onChange={e => patch({ accessDays: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <Sparkles className="w-4 h-4" />
            <span>Tipo: <strong>trial</strong> | Status: <strong>active</strong> (automatico)</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ---- STEP 1: Curso ----
  function renderStep1() {
    const selectedCourse = courses.find(c => c.id === state.courseId)
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Selecionar Curso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Curso</Label>
            <Select
              value={state.courseId || ''}
              onValueChange={val => {
                const course = courses.find(c => c.id === val)
                patch({
                  courseId: val,
                  courseName: course?.name || '',
                  courseThumbnail: course?.thumbnail_url || null,
                  moduleRules: {},
                  lessonOverrides: {},
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um curso..." />
              </SelectTrigger>
              <SelectContent>
                {courses.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCourse && (
            <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
              {selectedCourse.thumbnail_url ? (
                <img
                  src={selectedCourse.thumbnail_url}
                  alt={selectedCourse.name}
                  className="w-24 h-16 rounded object-cover"
                />
              ) : (
                <div className="w-24 h-16 rounded bg-muted flex items-center justify-center">
                  <GraduationCap className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-semibold">{selectedCourse.name}</p>
                <p className="text-sm text-muted-foreground">Curso selecionado</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // ---- STEP 2: Modulos e Aulas ----
  function renderStep2() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Modulos e Aulas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingData && <p className="text-muted-foreground">Carregando modulos...</p>}
          {!loadingData && modules.length === 0 && (
            <p className="text-muted-foreground">Nenhum modulo encontrado para este curso.</p>
          )}
          {modules.map(mod => {
            const rule = state.moduleRules[mod.id] || { ruleType: 'free', ruleValue: '' }
            const isExpanded = expandedModule === mod.id
            const isBlocked = rule.ruleType === 'blocked' || rule.ruleType === 'hidden'

            return (
              <div key={mod.id} className="border rounded-lg">
                <div className="p-3 flex flex-col md:flex-row md:items-center gap-3">
                  <button
                    type="button"
                    className="flex items-center gap-2 flex-1 text-left hover:text-primary transition-colors"
                    onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                  >
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                    <span className="font-medium">{mod.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({mod.lessons.length} aulas)
                    </span>
                  </button>

                  <div className="flex items-center gap-2">
                    <Select
                      value={rule.ruleType}
                      onValueChange={val => {
                        patch({
                          moduleRules: {
                            ...state.moduleRules,
                            [mod.id]: { ruleType: val, ruleValue: '' },
                          },
                        })
                      }}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODULE_RULE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {rule.ruleType === 'scheduled_date' && (
                      <Input
                        type="date"
                        className="w-44"
                        value={rule.ruleValue}
                        onChange={e =>
                          patch({
                            moduleRules: {
                              ...state.moduleRules,
                              [mod.id]: { ...rule, ruleValue: e.target.value },
                            },
                          })
                        }
                      />
                    )}

                    {rule.ruleType === 'days_after_enrollment' && (
                      <Input
                        type="number"
                        min={1}
                        placeholder="Dias"
                        className="w-24"
                        value={rule.ruleValue}
                        onChange={e =>
                          patch({
                            moduleRules: {
                              ...state.moduleRules,
                              [mod.id]: { ...rule, ruleValue: e.target.value },
                            },
                          })
                        }
                      />
                    )}
                  </div>
                </div>

                {isExpanded && isBlocked && mod.lessons.length > 0 && (
                  <div className="border-t px-4 py-3 space-y-2 bg-muted/20">
                    <p className="text-sm text-muted-foreground mb-2">
                      Liberar aulas individualmente dentro deste modulo bloqueado:
                    </p>
                    {mod.lessons.map(lesson => {
                      const isFreed = state.lessonOverrides[lesson.id] || false
                      return (
                        <div
                          key={lesson.id}
                          className="flex items-center justify-between py-1"
                        >
                          <span className="text-sm">{lesson.title}</span>
                          <div className="flex items-center gap-2">
                            {isFreed ? (
                              <Unlock className="w-4 h-4 text-green-500" />
                            ) : (
                              <Lock className="w-4 h-4 text-muted-foreground" />
                            )}
                            <Switch
                              checked={isFreed}
                              onCheckedChange={checked =>
                                patch({
                                  lessonOverrides: {
                                    ...state.lessonOverrides,
                                    [lesson.id]: checked,
                                  },
                                })
                              }
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {isExpanded && !isBlocked && mod.lessons.length > 0 && (
                  <div className="border-t px-4 py-3 bg-muted/20">
                    <p className="text-sm text-muted-foreground">
                      Modulo livre - todas as {mod.lessons.length} aulas estao acessiveis.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    )
  }

  // ---- STEP 3: Permissoes de Recursos ----
  function renderStep3() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Permissoes de Recursos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Recursos habilitados para os alunos desta turma. Desmarque para bloquear.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ALL_FEATURE_KEYS.map(f => {
              const enabled = state.featurePermissions[f.key] ?? true
              return (
                <div
                  key={f.key}
                  className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                    enabled ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {enabled ? (
                      <Eye className="w-5 h-5 text-green-500" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span className="font-medium">{f.label}</span>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={checked =>
                      patch({
                        featurePermissions: {
                          ...state.featurePermissions,
                          [f.key]: checked,
                        },
                      })
                    }
                  />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ---- STEP 4: Acesso ao Conteudo ----
  function renderStep4() {
    const ca = state.contentAccess

    function patchContent(key: keyof typeof ca, value: any) {
      patch({
        contentAccess: {
          ...state.contentAccess,
          [key]: { ...state.contentAccess[key], ...value },
        },
      })
    }

    function toggleTopicId(section: 'flashcards' | 'quizzes', topicId: string) {
      const current = ca[section].ids
      const next = current.includes(topicId)
        ? current.filter(id => id !== topicId)
        : [...current, topicId]
      patchContent(section, { ids: next })
    }

    function toggleAcervoCategory(catId: string) {
      const current = ca.acervo.categories
      const next = current.includes(catId)
        ? current.filter(id => id !== catId)
        : [...current, catId]
      patchContent('acervo', { categories: next })
    }

    function toggleAcervoConcurso(concursoId: string) {
      const current = ca.acervo.concursos
      const next = current.includes(concursoId)
        ? current.filter(id => id !== concursoId)
        : [...current, concursoId]
      patchContent('acervo', { concursos: next })
    }

    function toggleSimulado(simId: string) {
      const current = ca.simulados.ids
      const next = current.includes(simId)
        ? current.filter(id => id !== simId)
        : [...current, simId]
      patchContent('simulados', { ids: next })
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Acesso ao Conteudo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingData && <p className="text-muted-foreground">Carregando dados...</p>}

          {/* Flashcards */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Flashcards</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {ca.flashcards.restricted ? 'Restringir' : 'Liberar tudo'}
                </span>
                <Switch
                  checked={ca.flashcards.restricted}
                  onCheckedChange={checked => patchContent('flashcards', { restricted: checked })}
                />
              </div>
            </div>
            {ca.flashcards.restricted && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {flashcardSubjects.map(subj => (
                  <div key={subj.id}>
                    <p className="text-sm font-medium text-muted-foreground">{subj.name}</p>
                    <div className="ml-4 space-y-1">
                      {subj.topics.map(t => (
                        <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={ca.flashcards.ids.includes(t.id)}
                            onCheckedChange={() => toggleTopicId('flashcards', t.id)}
                          />
                          {t.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quizzes */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Quizzes</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {ca.quizzes.restricted ? 'Restringir' : 'Liberar tudo'}
                </span>
                <Switch
                  checked={ca.quizzes.restricted}
                  onCheckedChange={checked => patchContent('quizzes', { restricted: checked })}
                />
              </div>
            </div>
            {ca.quizzes.restricted && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {quizSubjects.map(subj => (
                  <div key={subj.id}>
                    <p className="text-sm font-medium text-muted-foreground">{subj.name}</p>
                    <div className="ml-4 space-y-1">
                      {subj.topics.map(t => (
                        <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={ca.quizzes.ids.includes(t.id)}
                            onCheckedChange={() => toggleTopicId('quizzes', t.id)}
                          />
                          {t.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Acervo Digital */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Acervo Digital</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {ca.acervo.restricted ? 'Restringir' : 'Liberar tudo'}
                </span>
                <Switch
                  checked={ca.acervo.restricted}
                  onCheckedChange={checked => patchContent('acervo', { restricted: checked })}
                />
              </div>
            </div>
            {ca.acervo.restricted && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Categorias</p>
                  <div className="flex flex-wrap gap-3">
                    {ACERVO_CATEGORIES.map(cat => (
                      <label key={cat.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={ca.acervo.categories.includes(cat.id)}
                          onCheckedChange={() => toggleAcervoCategory(cat.id)}
                        />
                        {cat.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Concursos</p>
                  <div className="flex flex-wrap gap-3">
                    {ACERVO_CONCURSOS.map(c => (
                      <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={ca.acervo.concursos.includes(c.id)}
                          onCheckedChange={() => toggleAcervoConcurso(c.id)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Simulados */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Simulados</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {ca.simulados.restricted ? 'Restringir' : 'Liberar tudo'}
                </span>
                <Switch
                  checked={ca.simulados.restricted}
                  onCheckedChange={checked => patchContent('simulados', { restricted: checked })}
                />
              </div>
            </div>
            {ca.simulados.restricted && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {simulations.map(sim => (
                  <label key={sim.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={ca.simulados.ids.includes(sim.id)}
                      onCheckedChange={() => toggleSimulado(sim.id)}
                    />
                    {sim.title}
                  </label>
                ))}
                {simulations.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum simulado cadastrado.</p>
                )}
              </div>
            )}
          </div>

          {/* Redacoes */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Redacoes</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {ca.redacoes.restricted ? 'Restringir' : 'Liberar tudo'}
                </span>
                <Switch
                  checked={ca.redacoes.restricted}
                  onCheckedChange={checked => patchContent('redacoes', { restricted: checked })}
                />
              </div>
            </div>
            {ca.redacoes.restricted && (
              <div>
                <Label htmlFor="maxSubmissions">Maximo de envios</Label>
                <Input
                  id="maxSubmissions"
                  type="number"
                  min={1}
                  placeholder="Ex: 3"
                  className="w-32"
                  value={ca.redacoes.maxSubmissions}
                  onChange={e =>
                    patchContent('redacoes', { maxSubmissions: e.target.value })
                  }
                />
              </div>
            )}
          </div>

          {/* Comunidade */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Comunidade</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {ca.comunidade.readOnly ? 'Somente leitura' : 'Acesso completo'}
                </span>
                <Switch
                  checked={ca.comunidade.readOnly}
                  onCheckedChange={checked => patchContent('comunidade', { readOnly: checked })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ---- STEP 5: Link de Convite ----
  function renderStep5() {
    const [skipInvite, setSkipInvite] = useState(false)

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            Link de Convite
            {state.classType === 'standard' && (
              <span className="text-xs font-normal text-muted-foreground ml-2">(opcional)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.classType === 'standard' && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <Switch
                checked={!skipInvite}
                onCheckedChange={checked => setSkipInvite(!checked)}
              />
              <div>
                <p className="text-sm font-medium">Criar link de convite</p>
                <p className="text-xs text-muted-foreground">Para turmas padrao, o convite e opcional. Alunos podem ser matriculados manualmente ou via Kiwify.</p>
              </div>
            </div>
          )}
          {(state.classType === 'trial' || !skipInvite) && (<>
          <div>
            <Label htmlFor="inviteTitle">Titulo do convite *</Label>
            <Input
              id="inviteTitle"
              placeholder="Ex: Degustacao EAOF 2026"
              value={state.inviteTitle}
              onChange={e => {
                const title = e.target.value
                patch({
                  inviteTitle: title,
                  inviteSlug: generateSlug(title),
                })
              }}
            />
          </div>
          <div>
            <Label htmlFor="inviteSlug">Slug (URL)</Label>
            <Input
              id="inviteSlug"
              placeholder="degustacao-eaof-2026"
              value={state.inviteSlug}
              onChange={e => patch({ inviteSlug: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="maxSlots">Vagas maximas (vazio = ilimitado)</Label>
            <Input
              id="maxSlots"
              type="number"
              min={1}
              placeholder="Ex: 50"
              value={state.maxSlots}
              onChange={e => patch({ maxSlots: e.target.value })}
            />
          </div>
          {state.inviteSlug && (
            <div className="p-4 border rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground mb-1">Preview do link:</p>
              <p className="font-mono text-sm break-all">
                {window.location.origin}/invite/{state.inviteSlug}
              </p>
            </div>
          )}
          </>)}
        </CardContent>
      </Card>
    )
  }

  // ---- STEP 6: Revisao ----
  function renderStep6() {
    const enabledFeatures = ALL_FEATURE_KEYS.filter(f => state.featurePermissions[f.key])
    const disabledFeatures = ALL_FEATURE_KEYS.filter(f => !state.featurePermissions[f.key])
    const ca = state.contentAccess

    if (state.completed) {
      return (
        <Card>
          <CardContent className="py-12 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <Sparkles className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold">Turma Criada com Sucesso!</h2>
            <p className="text-muted-foreground">
              {state.inviteId
                ? 'Tudo configurado. Compartilhe o link abaixo com os alunos.'
                : 'Turma criada e configurada. Alunos podem ser matriculados manualmente ou via Kiwify.'}
            </p>
            {state.inviteId && (
              <div className="flex items-center justify-center gap-2 p-4 border rounded-lg bg-muted/30 max-w-lg mx-auto">
                <p className="font-mono text-sm break-all">{getInviteUrl()}</p>
                <Button variant="outline" size="icon" onClick={copyInviteUrl}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate('/admin/classes')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para Turmas
              </Button>
              <Button
                onClick={() => {
                  setState(initialState())
                  setCurrentStep(0)
                }}
              >
                Criar Outra Turma
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {/* Dados Basicos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Dados Basicos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><strong>Nome:</strong> {state.className}</p>
            {state.classDescription && <p><strong>Descricao:</strong> {state.classDescription}</p>}
            {state.startDate && <p><strong>Inicio:</strong> {state.startDate}</p>}
            {state.endDate && <p><strong>Fim:</strong> {state.endDate}</p>}
            <p><strong>Acesso:</strong> {state.accessDays ? `${state.accessDays} dias` : 'Ilimitado'}</p>
            <p><strong>Tipo:</strong> {state.classType === 'trial' ? 'Degustacao' : 'Padrao'} | <strong>Status:</strong> active</p>
          </CardContent>
        </Card>

        {/* Curso */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="w-4 h-4" /> Curso
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{state.courseName || 'Nenhum selecionado'}</p>
          </CardContent>
        </Card>

        {/* Modulos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4" /> Modulos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {modules.map(m => {
              const rule = state.moduleRules[m.id]
              const ruleLabel =
                MODULE_RULE_OPTIONS.find(o => o.value === rule?.ruleType)?.label || 'Livre'
              const freedLessons = m.lessons.filter(l => state.lessonOverrides[l.id])
              return (
                <div key={m.id}>
                  <p>
                    <strong>{m.name}:</strong> {ruleLabel}
                    {rule?.ruleValue ? ` (${rule.ruleValue})` : ''}
                  </p>
                  {freedLessons.length > 0 && (
                    <p className="ml-4 text-muted-foreground">
                      Aulas liberadas: {freedLessons.map(l => l.title).join(', ')}
                    </p>
                  )}
                </div>
              )
            })}
            {modules.length === 0 && <p className="text-muted-foreground">Nenhum modulo.</p>}
          </CardContent>
        </Card>

        {/* Permissoes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" /> Permissoes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {enabledFeatures.length > 0 && (
              <p className="text-green-600">
                Habilitados: {enabledFeatures.map(f => f.label).join(', ')}
              </p>
            )}
            {disabledFeatures.length > 0 && (
              <p className="text-red-500">
                Bloqueados: {disabledFeatures.map(f => f.label).join(', ')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Conteudo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" /> Acesso ao Conteudo
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>
              <strong>Flashcards:</strong>{' '}
              {ca.flashcards.restricted ? `${ca.flashcards.ids.length} topicos selecionados` : 'Liberado'}
            </p>
            <p>
              <strong>Quizzes:</strong>{' '}
              {ca.quizzes.restricted ? `${ca.quizzes.ids.length} topicos selecionados` : 'Liberado'}
            </p>
            <p>
              <strong>Acervo:</strong>{' '}
              {ca.acervo.restricted
                ? `${ca.acervo.categories.length} categorias, ${ca.acervo.concursos.length} concursos`
                : 'Liberado'}
            </p>
            <p>
              <strong>Simulados:</strong>{' '}
              {ca.simulados.restricted ? `${ca.simulados.ids.length} selecionados` : 'Liberado'}
            </p>
            <p>
              <strong>Redacoes:</strong>{' '}
              {ca.redacoes.restricted
                ? `Max ${ca.redacoes.maxSubmissions || '?'} envios`
                : 'Liberado'}
            </p>
            <p>
              <strong>Comunidade:</strong>{' '}
              {ca.comunidade.readOnly ? 'Somente leitura' : 'Acesso completo'}
            </p>
          </CardContent>
        </Card>

        {/* Convite */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="w-4 h-4" /> Convite
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><strong>Titulo:</strong> {state.inviteTitle}</p>
            <p><strong>Slug:</strong> {state.inviteSlug}</p>
            <p><strong>Vagas:</strong> {state.maxSlots || 'Ilimitadas'}</p>
            <p className="font-mono text-xs break-all mt-2">{getInviteUrl()}</p>
          </CardContent>
        </Card>

        <Button
          size="lg"
          className="w-full"
          onClick={handleFinish}
          disabled={saving}
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Criar Turma
        </Button>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  const stepRenderers = [
    renderStep0,
    renderStep1,
    renderStep2,
    renderStep3,
    renderStep4,
    renderStep5,
    renderStep6,
  ]

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/invites')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nova Turma</h1>
          <p className="text-sm text-muted-foreground">
            Wizard completo: 7 passos para criar e configurar uma turma trial
          </p>
        </div>
      </div>

      {renderStepper()}

      {stepRenderers[currentStep]()}

      {/* Navigation buttons */}
      {!state.completed && (
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0 || saving}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          {currentStep < 6 && (
            <Button onClick={handleNext} disabled={saving}>
              {saving ? 'Salvando...' : 'Proximo'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
