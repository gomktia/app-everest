import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { SectionLoader } from '@/components/SectionLoader'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { aiAssistantService } from '@/services/ai/aiAssistantService'
import { extractTextFromPDFWithLimit } from '@/lib/pdfTextExtractor'
import { createQuiz, saveQuizQuestions } from '@/services/adminQuizService'
import { PandaVideoPickerModal } from '@/components/admin/courses/PandaVideoPickerModal'
import { type PandaVideo } from '@/services/pandaVideo'
import { cn } from '@/lib/utils'
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
import { logger } from '@/lib/logger'
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Video,
  Upload,
  FileText,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Star,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Edit,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface AttachmentData {
  id: string
  file_url: string
  file_name: string
  file_type: string | null
  isNew?: boolean
}

interface LessonData {
  id: string
  title: string
  description: string
  video_source_type: string | null
  video_source_id: string | null
  duration_seconds: number | null
  is_active: boolean
  is_preview: boolean
  order_index: number
  attachments: AttachmentData[]
  accompanying_pdf_attachment_id: string | null
  topic_id: string | null
  quiz_id: string | null
  quiz_required: boolean
  quiz_min_percentage: number
  isNew?: boolean
  isModified?: boolean
}

interface ModuleData {
  id: string
  name: string
  is_active: boolean
  order_index: number
  parent_module_id: string | null
  lessons: LessonData[]
  children: ModuleData[]
  isNew?: boolean
  isModified?: boolean
}

interface CourseDetails {
  id: string
  name: string
  description: string
  thumbnail_url: string | null
  is_active: boolean
  evercast_enabled: boolean
  sales_url: string | null
  kiwify_product_id: string | null
  show_in_storefront: boolean
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function generateTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/* Sortable Module Item                                                 */
/* ------------------------------------------------------------------ */

interface SortableModuleItemProps {
  module: ModuleData
  moduleIndex: number
  isExpanded: boolean
  isSubmodule?: boolean
  expandedModules: Set<string>
  onToggle: () => void
  onToggleChild: (id: string) => void
  onUpdate: (field: string, value: any) => void
  onDelete: () => void
  onAddLesson: () => void
  onUpdateLesson: (lessonIndex: number, field: string, value: any) => void
  onDeleteLesson: (lessonIndex: number) => void
  onReorderLessons: (event: DragEndEvent) => void
  onUploadAttachment: (lessonIndex: number, file: File) => void
  onDeleteAttachment: (lessonIndex: number, attId: string) => void
  onSetAccompanyingPdf: (lessonIndex: number, attId: string | null) => void
  onOpenVideoPicker: (lessonIndex: number) => void
  onAddSubmodule?: () => void
  onPromoteToModule?: () => void
  // Child module handlers (for parent modules)
  onUpdateChild?: (childIndex: number, field: string, value: any) => void
  onDeleteChild?: (childIndex: number) => void
  onAddChildLesson?: (childIndex: number) => void
  onUpdateChildLesson?: (childIndex: number, lessonIndex: number, field: string, value: any) => void
  onDeleteChildLesson?: (childIndex: number, lessonIndex: number) => void
  onReorderChildLessons?: (childIndex: number, event: DragEndEvent) => void
  onUploadChildAttachment?: (childIndex: number, lessonIndex: number, file: File) => void
  onDeleteChildAttachment?: (childIndex: number, lessonIndex: number, attId: string) => void
  onSetChildAccompanyingPdf?: (childIndex: number, lessonIndex: number, attId: string | null) => void
  onOpenChildVideoPicker?: (childIndex: number, lessonIndex: number) => void
  onPromoteChild?: (childIndex: number) => void
  onReorderChildren?: (event: DragEndEvent) => void
  allSubjects: { id: string; name: string }[]
  allTopics: { id: string; name: string; subject_id: string }[]
  allQuizzes: { id: string; title: string; topic_id: string }[]
}

function SortableModuleItem(props: SortableModuleItemProps) {
  const {
    module, moduleIndex, isExpanded, isSubmodule, expandedModules,
    onToggle, onToggleChild, onUpdate, onDelete, onAddLesson,
    onUpdateLesson, onDeleteLesson, onReorderLessons,
    onUploadAttachment, onDeleteAttachment, onSetAccompanyingPdf,
    onOpenVideoPicker, onAddSubmodule, onPromoteToModule,
    onUpdateChild, onDeleteChild, onAddChildLesson,
    onUpdateChildLesson, onDeleteChildLesson, onReorderChildLessons,
    onUploadChildAttachment, onDeleteChildAttachment,
    onSetChildAccompanyingPdf, onOpenChildVideoPicker,
    onPromoteChild, onReorderChildren,
    allSubjects, allTopics, allQuizzes,
  } = props

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const totalLessonsCount = module.lessons.length + module.children.reduce((sum, c) => sum + c.lessons.length, 0)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border rounded-xl bg-card overflow-hidden transition-shadow',
        isSubmodule ? 'border-primary/20 bg-primary/[0.02]' : 'border-border',
        isDragging ? 'shadow-2xl shadow-primary/10 opacity-90 z-50' : 'shadow-sm',
      )}
    >
      {/* Module header */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
          isExpanded ? 'bg-primary/5 border-b border-border' : 'hover:bg-muted/30',
        )}
        onClick={onToggle}
      >
        <button
          className="touch-none cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground/50 hover:text-muted-foreground"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
          isSubmodule ? 'bg-primary/20' : 'bg-primary',
        )}>
          <span className={cn('text-[11px] font-bold', isSubmodule ? 'text-primary' : 'text-primary-foreground')}>
            {moduleIndex + 1}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <input
            value={module.name}
            onChange={(e) => onUpdate('name', e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder={isSubmodule ? 'Nome do submódulo...' : 'Nome do módulo...'}
            className="w-full bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isSubmodule && (
            <Badge variant="outline" className="text-[10px] font-medium text-primary border-primary/30">
              Sub
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] font-medium">
            {isSubmodule ? module.lessons.length : totalLessonsCount} {(isSubmodule ? module.lessons.length : totalLessonsCount) === 1 ? 'aula' : 'aulas'}
          </Badge>
          {!isSubmodule && module.children.length > 0 && (
            <Badge variant="outline" className="text-[10px] font-medium text-blue-600 border-blue-300 dark:border-blue-800">
              {module.children.length} sub
            </Badge>
          )}
          {module.is_active ? (
            <Badge className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 border-emerald-300 dark:border-emerald-800">Ativo</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">Inativo</Badge>
          )}
          {isSubmodule && onPromoteToModule && (
            <button
              onClick={(e) => { e.stopPropagation(); onPromoteToModule() }}
              className="p-1.5 rounded-md text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
              title="Promover a módulo"
            >
              <ArrowLeft className="h-3.5 w-3.5 rotate-90" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title={isSubmodule ? 'Excluir submódulo' : 'Excluir módulo'}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Module content (expanded) */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {/* Module settings row */}
          <div className="flex items-center gap-4 px-2 py-2 bg-muted/20 rounded-lg">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Switch
                checked={module.is_active}
                onCheckedChange={(v) => onUpdate('is_active', v)}
              />
              {isSubmodule ? 'Submódulo ativo' : 'Módulo ativo'}
            </label>
          </div>

          {/* Lessons */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onReorderLessons}>
            <SortableContext items={module.lessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
              {module.lessons.map((lesson, lessonIndex) => (
                <SortableLessonItem
                  key={lesson.id}
                  lesson={lesson}
                  lessonIndex={lessonIndex}
                  onUpdate={(field, value) => onUpdateLesson(lessonIndex, field, value)}
                  onDelete={() => onDeleteLesson(lessonIndex)}
                  onUploadAttachment={(file) => onUploadAttachment(lessonIndex, file)}
                  onDeleteAttachment={(attId) => onDeleteAttachment(lessonIndex, attId)}
                  onSetAccompanyingPdf={(attId) => onSetAccompanyingPdf(lessonIndex, attId)}
                  onOpenVideoPicker={() => onOpenVideoPicker(lessonIndex)}
                  allSubjects={allSubjects}
                  allTopics={allTopics}
                  allQuizzes={allQuizzes}
                />
              ))}
            </SortableContext>
          </DndContext>

          {module.lessons.length === 0 && module.children.length === 0 && (
            <div className="text-center py-6 border-2 border-dashed border-border/50 rounded-xl">
              <Video className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma aula neste {isSubmodule ? 'submódulo' : 'módulo'}</p>
            </div>
          )}

          {/* Add lesson button */}
          <button
            onClick={onAddLesson}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-border/50 rounded-xl text-xs text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar aula
          </button>

          {/* Submodules (only for root modules) */}
          {!isSubmodule && (
            <>
              {module.children.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Submódulos</h4>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onReorderChildren!}>
                    <SortableContext items={module.children.map(c => c.id)} strategy={verticalListSortingStrategy}>
                      {module.children.map((child, childIndex) => (
                        <div key={child.id} className="ml-4 border-l-2 border-primary/20 pl-3">
                          <SortableModuleItem
                            module={child}
                            moduleIndex={childIndex}
                            isExpanded={expandedModules.has(child.id)}
                            isSubmodule
                            expandedModules={expandedModules}
                            onToggle={() => onToggleChild(child.id)}
                            onToggleChild={onToggleChild}
                            onUpdate={(field, value) => onUpdateChild?.(childIndex, field, value)}
                            onDelete={() => onDeleteChild?.(childIndex)}
                            onAddLesson={() => onAddChildLesson?.(childIndex)}
                            onUpdateLesson={(li, field, value) => onUpdateChildLesson?.(childIndex, li, field, value)}
                            onDeleteLesson={(li) => onDeleteChildLesson?.(childIndex, li)}
                            onReorderLessons={(event) => onReorderChildLessons?.(childIndex, event)}
                            onUploadAttachment={(li, file) => onUploadChildAttachment?.(childIndex, li, file)}
                            onDeleteAttachment={(li, attId) => onDeleteChildAttachment?.(childIndex, li, attId)}
                            onSetAccompanyingPdf={(li, attId) => onSetChildAccompanyingPdf?.(childIndex, li, attId)}
                            onOpenVideoPicker={(li) => onOpenChildVideoPicker?.(childIndex, li)}
                            onPromoteToModule={() => onPromoteChild?.(childIndex)}
                            allSubjects={allSubjects}
                            allTopics={allTopics}
                            allQuizzes={allQuizzes}
                          />
                        </div>
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              )}

              {/* Add submodule button */}
              <button
                onClick={onAddSubmodule}
                className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-primary/20 rounded-xl text-xs text-primary/60 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar submódulo
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sortable Lesson Item                                                 */
/* ------------------------------------------------------------------ */

function SortableLessonItem({
  lesson,
  lessonIndex,
  onUpdate,
  onDelete,
  onUploadAttachment,
  onDeleteAttachment,
  onSetAccompanyingPdf,
  onOpenVideoPicker,
  allSubjects,
  allTopics,
  allQuizzes,
}: {
  lesson: LessonData
  lessonIndex: number
  onUpdate: (field: string, value: any) => void
  onDelete: () => void
  onUploadAttachment: (file: File) => void
  onDeleteAttachment: (attId: string) => void
  onSetAccompanyingPdf: (attId: string | null) => void
  onOpenVideoPicker: () => void
  allSubjects: { id: string; name: string }[]
  allTopics: { id: string; name: string; subject_id: string }[]
  allQuizzes: { id: string; title: string; topic_id: string }[]
}) {
  const [expanded, setExpanded] = useState(lesson.isNew || false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Local subject state for cascade (subject is not stored in DB, derived from topic)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    if (lesson.quiz_id) {
      const q = allQuizzes.find(q => q.id === lesson.quiz_id)
      if (q) return allTopics.find(t => t.id === q.topic_id)?.subject_id || ''
    }
    if (lesson.topic_id) {
      return allTopics.find(t => t.id === lesson.topic_id)?.subject_id || ''
    }
    return ''
  })

  // AI Quiz Generation state
  const [isQuizGenOpen, setIsQuizGenOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSavingQuiz, setIsSavingQuiz] = useState(false)
  const [numQuestions, setNumQuestions] = useState('5')
  const [difficulty, setDifficulty] = useState('medium')
  const [questionType, setQuestionType] = useState('multiple_choice')
  const [generatedQuestions, setGeneratedQuestions] = useState<Array<{
    question_text: string; question_type: string; options: string[]
    correct_answer: string; explanation: string; difficulty: number; tags: string[]
    edited?: boolean
  }>>([])
  const [editingQIdx, setEditingQIdx] = useState<number | null>(null)

  const pdfAttachments = lesson.attachments.filter(
    (a) => a.file_type?.includes('pdf') || a.file_name.endsWith('.pdf')
  )

  const handleGenerateQuiz = async () => {
    const firstPdf = pdfAttachments[0]
    if (!firstPdf?.file_url) return

    setIsGenerating(true)
    setGeneratedQuestions([])
    try {
      const text = await extractTextFromPDFWithLimit(firstPdf.file_url)
      if (!text.trim()) {
        toast({ title: 'PDF sem texto', description: 'Não foi possível extrair texto do PDF. Pode ser uma imagem escaneada.', variant: 'destructive' })
        return
      }
      const result = await aiAssistantService.generateQuiz({
        content_text: text,
        num_questions: parseInt(numQuestions),
        difficulty: difficulty as any,
        gen_question_type: questionType as any,
      })
      setGeneratedQuestions(result.questions)
    } catch (err) {
      logger.error('Erro ao gerar quiz:', err)
      toast({ title: 'Erro ao gerar quiz', description: err instanceof Error ? err.message : 'Tente novamente.', variant: 'destructive' })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveGeneratedQuestions = async () => {
    if (generatedQuestions.length === 0) return
    setIsSavingQuiz(true)
    try {
      let quizId = lesson.quiz_id

      // If lesson has no quiz, create one (requires topic_id)
      if (!quizId) {
        if (!lesson.topic_id) {
          toast({ title: 'Selecione um conteudo primeiro', description: 'A aula precisa ter Materia e Conteudo selecionados para criar o quiz.', variant: 'destructive' })
          setIsSavingQuiz(false)
          return
        }
        const newQuiz = await createQuiz({
          title: `Quiz - ${lesson.title || 'Aula'}`,
          topic_id: lesson.topic_id,
          description: `Quiz gerado por IA a partir do PDF da aula "${lesson.title}"`,
          status: 'active',
          shuffle_questions: true,
          shuffle_options: true,
          show_results_immediately: true,
          allow_review: true,
        })
        if (!newQuiz) throw new Error('Falha ao criar quiz')
        quizId = newQuiz.id
        // Link quiz to lesson (state + persist directly to DB)
        onUpdate('quiz_id', quizId)
        if (!lesson.isNew && lesson.id) {
          await supabase.from('video_lessons').update({ quiz_id: quizId }).eq('id', lesson.id)
        }
      }

      // Use saveQuizQuestions which auto-generates flashcards
      const sourceExam = `IA - ${lesson.title || 'Aula'}`
      const questions = generatedQuestions.map((q) => ({
        quiz_id: quizId!,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options as any,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        points: 1,
        difficulty: q.difficulty,
        tags: q.tags as any,
        source_type: 'ai_generated',
        source_exam: sourceExam,
      }))

      await saveQuizQuestions(quizId!, questions)

      toast({ title: 'Quiz salvo com sucesso!', description: `${questions.length} questao(oes) salvas no Quiz + Banco de Questoes. Flashcards gerados automaticamente.` })
      setIsQuizGenOpen(false)
      setGeneratedQuestions([])
    } catch (err) {
      logger.error('Erro ao salvar questões:', err)
      toast({ title: 'Erro ao salvar', description: err instanceof Error ? err.message : 'Tente novamente.', variant: 'destructive' })
    } finally {
      setIsSavingQuiz(false)
    }
  }

  const updateGenQuestion = (idx: number, field: string, value: string | string[]) => {
    setGeneratedQuestions((prev) => prev.map((q, i) => i === idx ? { ...q, [field]: value, edited: true } : q))
  }

  const { toast } = useToast()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border border-border/60 rounded-lg bg-background overflow-hidden transition-shadow',
        isDragging ? 'shadow-lg opacity-90 z-50' : '',
      )}
    >
      {/* Lesson header */}
      <div
        className={cn(
          'flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors',
          expanded ? 'border-b border-border/50 bg-muted/10' : 'hover:bg-muted/20',
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <button
          className="touch-none cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/40 hover:text-muted-foreground"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <span className="text-[11px] font-medium text-muted-foreground/60 tabular-nums w-5 text-center shrink-0">
          {lessonIndex + 1}
        </span>

        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-foreground truncate block">
            {lesson.title || 'Aula sem título'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {lesson.video_source_id && (
            <Video className="h-3 w-3 text-primary" />
          )}
          {lesson.attachments.length > 0 && (
            <FileText className="h-3 w-3 text-blue-400" />
          )}
          {lesson.is_active ? (
            <Eye className="h-3 w-3 text-emerald-500" />
          ) : (
            <EyeOff className="h-3 w-3 text-muted-foreground/40" />
          )}
          {lesson.duration_seconds && lesson.duration_seconds > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {formatDuration(lesson.duration_seconds)}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1 rounded text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground/50" /> : <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
        </div>
      </div>

      {/* Lesson expanded content */}
      {expanded && (
        <div className="p-3 space-y-3">
          {/* Title */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Titulo</label>
            <Input
              value={lesson.title}
              onChange={(e) => onUpdate('title', e.target.value)}
              placeholder="Titulo da aula"
              className="h-8 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Descricao</label>
            <Textarea
              value={lesson.description}
              onChange={(e) => onUpdate('description', e.target.value)}
              placeholder="Descricao da aula (opcional)"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Video + Toggles row */}
          <div className="flex items-start gap-4 flex-wrap">
            {/* Video picker */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Video</label>
              <button
                onClick={onOpenVideoPicker}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 border rounded-lg text-xs transition-colors',
                  lesson.video_source_id
                    ? 'border-primary/30 bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                )}
              >
                <Video className="h-3.5 w-3.5" />
                {lesson.video_source_id ? (
                  <span className="truncate flex-1 text-left">
                    {lesson.video_source_id.slice(0, 20)}...
                    {lesson.duration_seconds ? ` (${formatDuration(lesson.duration_seconds)})` : ''}
                  </span>
                ) : (
                  'Selecionar video'
                )}
              </button>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-4 pt-5">
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                <Switch
                  checked={lesson.is_active}
                  onCheckedChange={(v) => onUpdate('is_active', v)}
                />
                Ativa
              </label>
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                <Switch
                  checked={lesson.is_preview}
                  onCheckedChange={(v) => onUpdate('is_preview', v)}
                />
                Preview
              </label>
            </div>
          </div>

          {/* Quiz & Flashcard association: Matéria → Conteúdo → Quiz */}
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Quiz da Aula</label>
            {(() => {
              const currentTopicId = lesson.topic_id || ''
              const filteredTopics = selectedSubjectId ? allTopics.filter(t => t.subject_id === selectedSubjectId) : []
              const filteredQuizzes = currentTopicId ? allQuizzes.filter(q => q.topic_id === currentTopicId) : []

              return (
                <div className="grid grid-cols-3 gap-2">
                  {/* Matéria */}
                  <select
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                    value={selectedSubjectId}
                    onChange={(e) => {
                      setSelectedSubjectId(e.target.value)
                      onUpdate('topic_id', null)
                      onUpdate('quiz_id', null)
                    }}
                  >
                    <option value="">Matéria...</option>
                    {allSubjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>

                  {/* Conteúdo (Topic) */}
                  <select
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                    value={currentTopicId}
                    onChange={(e) => {
                      onUpdate('topic_id', e.target.value || null)
                      onUpdate('quiz_id', null)
                    }}
                    disabled={!selectedSubjectId}
                  >
                    <option value="">Conteúdo...</option>
                    {filteredTopics.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  {/* Quiz */}
                  <select
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                    value={lesson.quiz_id || ''}
                    onChange={(e) => {
                      const qId = e.target.value || null
                      onUpdate('quiz_id', qId)
                      if (qId) {
                        const q = allQuizzes.find(quiz => quiz.id === qId)
                        if (q) onUpdate('topic_id', q.topic_id)
                      }
                    }}
                    disabled={!currentTopicId}
                  >
                    <option value="">Quiz...</option>
                    {filteredQuizzes.map(q => (
                      <option key={q.id} value={q.id}>{q.title}</option>
                    ))}
                  </select>
                </div>
              )
            })()}
            <p className="text-[10px] text-muted-foreground">Selecione matéria → conteúdo → quiz. Flashcards são gerados automaticamente.</p>
            {lesson.quiz_id && (
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                  <Switch
                    checked={lesson.quiz_required}
                    onCheckedChange={(v) => onUpdate('quiz_required', v)}
                  />
                  Quiz obrigatório
                </label>
                {lesson.quiz_required && (
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] text-muted-foreground">Mínimo de acertos:</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={lesson.quiz_min_percentage}
                      onChange={(e) => { const v = parseInt(e.target.value, 10); onUpdate('quiz_min_percentage', isNaN(v) ? 70 : v) }}
                      className="h-7 w-16 text-xs"
                    />
                    <span className="text-[11px] text-muted-foreground">%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Materiais</label>
            {lesson.attachments.length > 0 && (
              <div className="space-y-1 mb-2">
                {lesson.attachments.map((att) => {
                  const isPdf = att.file_type?.includes('pdf') || att.file_name.endsWith('.pdf')
                  const isAccompanying = att.id === lesson.accompanying_pdf_attachment_id
                  return (
                    <div key={att.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/20 rounded-md group text-xs">
                      <FileText className={cn('h-3.5 w-3.5 shrink-0', isPdf ? 'text-red-400' : 'text-muted-foreground')} />
                      <span className="flex-1 truncate text-foreground/80">{att.file_name}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {isPdf && (
                          <button
                            onClick={() => onSetAccompanyingPdf(isAccompanying ? null : att.id)}
                            className="p-1 rounded hover:bg-muted/50 transition-colors"
                            title={isAccompanying ? 'Remover como PDF principal' : 'Definir como PDF principal'}
                          >
                            <Star className={cn('h-3 w-3', isAccompanying ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/40')} />
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteAttachment(att.id)}
                          className="p-1 rounded hover:bg-red-500/10 hover:text-red-500 text-muted-foreground/40 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onUploadAttachment(file)
                e.target.value = ''
              }}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-border rounded-md text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                <Upload className="h-3 w-3" />
                Adicionar arquivo
              </button>
              {pdfAttachments.length > 0 && (
                <button
                  onClick={() => { setGeneratedQuestions([]); setIsQuizGenOpen(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-purple-300 dark:border-purple-800 rounded-md text-[11px] text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:text-purple-700 transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  Gerar Quiz com IA
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Quiz Generation Dialog */}
      <Dialog open={isQuizGenOpen} onOpenChange={setIsQuizGenOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Gerar Quiz com IA
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {pdfAttachments[0] && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
                <FileText className="h-4 w-4 text-red-400" />
                <span className="font-medium text-muted-foreground">PDF:</span>
                <span className="truncate">{pdfAttachments[0].file_name}</span>
                {pdfAttachments.length > 1 && (
                  <Badge variant="secondary" className="text-[10px]">+{pdfAttachments.length - 1}</Badge>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Questões</Label>
                <Select value={numQuestions} onValueChange={setNumQuestions}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Dificuldade</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Facil</SelectItem>
                    <SelectItem value="medium">Medio</SelectItem>
                    <SelectItem value="hard">Dificil</SelectItem>
                    <SelectItem value="mixed">Misto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={questionType} onValueChange={setQuestionType}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multipla escolha</SelectItem>
                    <SelectItem value="true_false">Certo-Errado</SelectItem>
                    <SelectItem value="mixed">Misto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="button" onClick={handleGenerateQuiz} disabled={isGenerating} className="w-full">
              {isGenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extraindo PDF e gerando questoes...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" />Gerar</>
              )}
            </Button>

            {generatedQuestions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">{generatedQuestions.length} questao(oes) gerada(s)</span>
                </div>

                {generatedQuestions.map((q, idx) => (
                  <Card key={idx} className={q.edited ? 'border-blue-400' : ''}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">
                            {q.question_type === 'multiple_choice' ? 'Multipla escolha' : 'Certo-Errado'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {q.difficulty === 1 ? 'Facil' : q.difficulty === 3 ? 'Dificil' : 'Medio'}
                          </Badge>
                          {q.edited && <Badge variant="outline" className="text-[10px] text-blue-500 border-blue-400">Editada</Badge>}
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setEditingQIdx(editingQIdx === idx ? null : idx)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {editingQIdx === idx ? (
                        <div className="space-y-2">
                          <Textarea value={q.question_text} onChange={(e) => updateGenQuestion(idx, 'question_text', e.target.value)} rows={3} className="text-sm" />
                          <Label className="text-xs text-muted-foreground">Clique na alternativa correta para marcar o gabarito:</Label>
                          {q.options.map((opt, optIdx) => {
                            const isCorrect = opt === q.correct_answer
                            return (
                              <div key={optIdx} className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateGenQuestion(idx, 'correct_answer', opt)}
                                  className={cn(
                                    'shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all',
                                    isCorrect
                                      ? 'border-green-500 bg-green-500 text-white'
                                      : 'border-muted-foreground/30 text-muted-foreground hover:border-green-400'
                                  )}
                                >
                                  {String.fromCharCode(65 + optIdx)}
                                </button>
                                <Input
                                  value={opt}
                                  onChange={(e) => {
                                    const wasCorrect = opt === q.correct_answer
                                    const o = [...q.options]; o[optIdx] = e.target.value; updateGenQuestion(idx, 'options', o)
                                    if (wasCorrect) updateGenQuestion(idx, 'correct_answer', e.target.value)
                                  }}
                                  className={cn('text-sm h-8 flex-1', isCorrect && 'border-green-400 bg-green-50 dark:bg-green-950/20')}
                                />
                              </div>
                            )
                          })}
                          <div className="space-y-1">
                            <Label className="text-xs">Explicacao</Label>
                            <Textarea value={q.explanation} onChange={(e) => updateGenQuestion(idx, 'explanation', e.target.value)} rows={2} className="text-sm" />
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm">{q.question_text}</p>
                          {q.options.length > 0 && (
                            <ul className="space-y-1">
                              {q.options.map((opt, optIdx) => (
                                <li key={optIdx} className={`text-xs flex items-center gap-1.5 ${opt === q.correct_answer ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                                  <span className={cn(
                                    'inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold shrink-0',
                                    opt === q.correct_answer ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                                  )}>
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <span>{opt}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {q.explanation && <p className="text-xs text-muted-foreground italic border-t pt-1">{q.explanation}</p>}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setIsQuizGenOpen(false)}>Cancelar</Button>
            {generatedQuestions.length > 0 && (
              <Button type="button" onClick={handleSaveGeneratedQuestions} disabled={isSavingQuiz}>
                {isSavingQuiz ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><CheckCircle className="mr-2 h-4 w-4" />Salvar no Banco de Questoes</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main Page Component                                                  */
/* ------------------------------------------------------------------ */

export default function AdminCourseEditorPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  usePageTitle('Editor de Curso')
  const { user } = useAuth()
  const { toast } = useToast()
  const isNewCourse = !courseId || courseId === 'new'

  const [loading, setLoading] = useState(!isNewCourse)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Course details
  const [course, setCourse] = useState<CourseDetails>({
    id: '',
    name: '',
    description: '',
    thumbnail_url: null,
    is_active: false,
    evercast_enabled: false,
    sales_url: null,
    kiwify_product_id: null,
    show_in_storefront: false,
  })

  // Modules & lessons
  const [modules, setModules] = useState<ModuleData[]>([])
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [deletedModuleIds, setDeletedModuleIds] = useState<string[]>([])
  const [deletedLessonIds, setDeletedLessonIds] = useState<string[]>([])
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<string[]>([])

  // Thumbnail upload
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)

  // Video picker
  const [videoPickerOpen, setVideoPickerOpen] = useState(false)
  const [videoPickerTarget, setVideoPickerTarget] = useState<{ moduleIndex: number; lessonIndex: number } | null>(null)

  // Topics & quizzes for lesson association
  const [allSubjects, setAllSubjects] = useState<{ id: string; name: string }[]>([])
  const [allTopics, setAllTopics] = useState<{ id: string; name: string; subject_id: string }[]>([])
  const [allQuizzes, setAllQuizzes] = useState<{ id: string; title: string; topic_id: string }[]>([])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /* ---- Load subjects, topics & quizzes (needed for all courses, new or existing) ---- */
  useEffect(() => {
    Promise.all([
      supabase.from('subjects').select('id, name').order('name'),
      supabase.from('topics').select('id, name, subject_id').order('name'),
      supabase.from('quizzes').select('id, title, topic_id').or('type.eq.quiz,type.is.null').order('title'),
    ]).then(([{ data: s }, { data: t }, { data: q }]) => {
      setAllSubjects(s || [])
      setAllTopics(t || [])
      setAllQuizzes(q || [])
    })
  }, [])

  /* ---- Load course data ---- */
  useEffect(() => {
    if (isNewCourse) return

    async function load() {
      setLoading(true)
      try {
        // Fetch course
        const { data: courseData, error: courseError } = await supabase
          .from('video_courses')
          .select('id, name, description, thumbnail_url, is_active, evercast_enabled, sales_url, show_in_storefront')
          .eq('id', courseId!)
          .single()

        if (courseError) throw courseError
        setCourse({ ...courseData, evercast_enabled: courseData.evercast_enabled ?? false, sales_url: courseData.sales_url || null, kiwify_product_id: null, show_in_storefront: courseData.show_in_storefront ?? false })

        // Fetch Kiwify product mapping
        if (courseId) {
          const { data: kiwifyData } = await supabase
            .from('kiwify_products')
            .select('kiwify_product_id')
            .eq('class_id', courseId)
            .maybeSingle()
          // Try finding by class linked to this course
          if (!kiwifyData) {
            const { data: classLink } = await supabase
              .from('class_courses')
              .select('class_id')
              .eq('course_id', courseId)
              .limit(1)
              .maybeSingle()
            if (classLink) {
              const { data: kiwifyByClass } = await supabase
                .from('kiwify_products')
                .select('kiwify_product_id')
                .eq('class_id', classLink.class_id)
                .maybeSingle()
              if (kiwifyByClass) {
                setCourse(prev => ({ ...prev, kiwify_product_id: kiwifyByClass.kiwify_product_id }))
              }
            }
          } else {
            setCourse(prev => ({ ...prev, kiwify_product_id: kiwifyData.kiwify_product_id }))
          }
        }

        // Fetch modules with lessons and attachments in ONE nested query
        const { data: modulesData, error: modulesError } = await supabase
          .from('video_modules')
          .select(`
            id, name, is_active, order_index, parent_module_id,
            video_lessons (
              id, title, description, video_source_type, video_source_id,
              duration_seconds, is_active, is_preview, order_index,
              accompanying_pdf_attachment_id, topic_id, quiz_id,
              quiz_required, quiz_min_percentage,
              lesson_attachments!lesson_attachments_lesson_id_fkey ( id, file_url, file_name, file_type )
            )
          `)
          .eq('course_id', courseId!)
          .order('order_index')

        if (modulesError) throw modulesError

        const allModulesFlat: ModuleData[] = (modulesData || []).map((mod: any) => {
          const lessons: LessonData[] = ((mod.video_lessons || []) as any[])
            .sort((a: any, b: any) => a.order_index - b.order_index)
            .map((lesson: any) => ({
              ...lesson,
              description: lesson.description || '',
              attachments: (lesson.lesson_attachments || []) as AttachmentData[],
              lesson_attachments: undefined,
            }))

          return {
            ...mod,
            video_lessons: undefined,
            parent_module_id: mod.parent_module_id || null,
            lessons,
            children: [],
          }
        })

        // Build tree: root modules with children
        const rootModules = allModulesFlat.filter(m => !m.parent_module_id)
        const childMap = new Map<string, ModuleData[]>()
        for (const mod of allModulesFlat) {
          if (mod.parent_module_id) {
            const arr = childMap.get(mod.parent_module_id) || []
            arr.push(mod)
            childMap.set(mod.parent_module_id, arr)
          }
        }
        for (const root of rootModules) {
          root.children = (childMap.get(root.id) || []).sort((a, b) => a.order_index - b.order_index)
        }

        setModules(rootModules)
      } catch (err) {
        logger.error('Error loading course:', err)
        toast({ title: 'Erro ao carregar curso', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [courseId, isNewCourse, toast])

  /* ---- Mark changes ---- */
  const markChanged = useCallback(() => setHasChanges(true), [])

  /* ---- Course details handlers ---- */
  const updateCourseField = useCallback((field: keyof CourseDetails, value: any) => {
    setCourse(prev => ({ ...prev, [field]: value }))
    markChanged()
  }, [markChanged])

  const handleThumbnailUpload = useCallback(async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande', description: 'Maximo 5MB.', variant: 'destructive' })
      return
    }
    setUploadingThumbnail(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `thumbnails/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
      const { error } = await supabase.storage.from('course_materials').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('course_materials').getPublicUrl(path)
      updateCourseField('thumbnail_url', publicUrl)
      toast({ title: 'Capa enviada!' })
    } catch (err) {
      logger.error(err)
      toast({ title: 'Erro ao enviar imagem', variant: 'destructive' })
    } finally {
      setUploadingThumbnail(false)
    }
  }, [toast, updateCourseField])

  /* ---- Module handlers ---- */
  const addModule = useCallback(() => {
    const newModule: ModuleData = {
      id: generateTempId(),
      name: '',
      is_active: true,
      order_index: modules.length,
      parent_module_id: null,
      lessons: [],
      children: [],
      isNew: true,
    }
    setModules(prev => [...prev, newModule])
    setExpandedModules(prev => new Set([...prev, newModule.id]))
    markChanged()
  }, [modules.length, markChanged])

  const addSubmodule = useCallback((parentIndex: number) => {
    const newSub: ModuleData = {
      id: generateTempId(),
      name: '',
      is_active: true,
      order_index: 0,
      parent_module_id: modules[parentIndex]?.id || null,
      lessons: [],
      children: [],
      isNew: true,
    }
    setModules(prev => prev.map((m, i) => {
      if (i !== parentIndex) return m
      const children = [...m.children, { ...newSub, order_index: m.children.length }]
      return { ...m, children, isModified: !m.isNew }
    }))
    setExpandedModules(prev => new Set([...prev, modules[parentIndex]?.id, newSub.id]))
    markChanged()
  }, [modules, markChanged])

  const updateChildModule = useCallback((parentIndex: number, childIndex: number, field: string, value: any) => {
    setModules(prev => prev.map((m, i) => {
      if (i !== parentIndex) return m
      const children = m.children.map((c, ci) => ci === childIndex ? { ...c, [field]: value, isModified: !c.isNew } : c)
      return { ...m, children, isModified: !m.isNew }
    }))
    markChanged()
  }, [markChanged])

  const deleteChildModule = useCallback((parentIndex: number, childIndex: number) => {
    const child = modules[parentIndex]?.children[childIndex]
    if (!child) return
    if (!child.isNew && !confirm(`Excluir submódulo "${child.name || 'sem nome'}" e todas as suas aulas?`)) return

    if (!child.isNew) {
      setDeletedModuleIds(prev => [...prev, child.id])
      child.lessons.forEach(l => {
        if (!l.isNew) setDeletedLessonIds(prev => [...prev, l.id])
      })
    }
    setModules(prev => prev.map((m, i) => {
      if (i !== parentIndex) return m
      return { ...m, children: m.children.filter((_, ci) => ci !== childIndex), isModified: !m.isNew }
    }))
    markChanged()
  }, [modules, markChanged])

  const promoteChildToModule = useCallback((parentIndex: number, childIndex: number) => {
    setModules(prev => {
      const parent = prev[parentIndex]
      if (!parent) return prev
      const child = parent.children[childIndex]
      if (!child) return prev
      const promoted: ModuleData = { ...child, parent_module_id: null, order_index: prev.length, isModified: !child.isNew }
      const updatedParent = { ...parent, children: parent.children.filter((_, ci) => ci !== childIndex), isModified: !parent.isNew }
      return [...prev.map((m, i) => i === parentIndex ? updatedParent : m), promoted]
    })
    markChanged()
  }, [markChanged])

  const addChildLesson = useCallback((parentIndex: number, childIndex: number) => {
    setModules(prev => prev.map((m, pi) => {
      if (pi !== parentIndex) return m
      return {
        ...m,
        children: m.children.map((c, ci) => {
          if (ci !== childIndex) return c
          const newLesson: LessonData = {
            id: generateTempId(), title: '', description: '',
            video_source_type: null, video_source_id: null, duration_seconds: null,
            is_active: true, is_preview: false, order_index: c.lessons.length,
            attachments: [], accompanying_pdf_attachment_id: null,
            topic_id: null, quiz_id: null, quiz_required: false, quiz_min_percentage: 70,
            isNew: true,
          }
          return { ...c, lessons: [...c.lessons, newLesson] }
        }),
      }
    }))
    markChanged()
  }, [markChanged])

  const updateChildLesson = useCallback((parentIndex: number, childIndex: number, lessonIndex: number, field: string, value: any) => {
    setModules(prev => prev.map((m, pi) => {
      if (pi !== parentIndex) return m
      return {
        ...m,
        children: m.children.map((c, ci) => {
          if (ci !== childIndex) return c
          return {
            ...c,
            lessons: c.lessons.map((l, li) => li === lessonIndex ? { ...l, [field]: value, isModified: !l.isNew } : l),
          }
        }),
      }
    }))
    markChanged()
  }, [markChanged])

  const deleteChildLesson = useCallback((parentIndex: number, childIndex: number, lessonIndex: number) => {
    const lesson = modules[parentIndex]?.children[childIndex]?.lessons[lessonIndex]
    if (!lesson) return
    if (!lesson.isNew && !confirm(`Excluir aula "${lesson.title || 'sem título'}"?`)) return
    if (!lesson.isNew) setDeletedLessonIds(prev => [...prev, lesson.id])

    setModules(prev => prev.map((m, pi) => {
      if (pi !== parentIndex) return m
      return {
        ...m,
        children: m.children.map((c, ci) => {
          if (ci !== childIndex) return c
          return { ...c, lessons: c.lessons.filter((_, li) => li !== lessonIndex) }
        }),
      }
    }))
    markChanged()
  }, [modules, markChanged])

  const handleChildLessonReorder = useCallback((parentIndex: number, childIndex: number, event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setModules(prev => prev.map((m, pi) => {
      if (pi !== parentIndex) return m
      return {
        ...m,
        children: m.children.map((c, ci) => {
          if (ci !== childIndex) return c
          const oldIdx = c.lessons.findIndex(l => l.id === active.id)
          const newIdx = c.lessons.findIndex(l => l.id === over.id)
          return { ...c, lessons: arrayMove(c.lessons, oldIdx, newIdx).map((l, i) => ({ ...l, order_index: i, isModified: !l.isNew })) }
        }),
      }
    }))
    markChanged()
  }, [markChanged])

  const handleChildReorder = useCallback((parentIndex: number, event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setModules(prev => prev.map((m, pi) => {
      if (pi !== parentIndex) return m
      const oldIdx = m.children.findIndex(c => c.id === active.id)
      const newIdx = m.children.findIndex(c => c.id === over.id)
      return { ...m, children: arrayMove(m.children, oldIdx, newIdx).map((c, i) => ({ ...c, order_index: i, isModified: !c.isNew })) }
    }))
    markChanged()
  }, [markChanged])

  const updateModule = useCallback((moduleIndex: number, field: string, value: any) => {
    setModules(prev => prev.map((m, i) => i === moduleIndex ? { ...m, [field]: value, isModified: !m.isNew } : m))
    markChanged()
  }, [markChanged])

  const deleteModule = useCallback((moduleIndex: number) => {
    const mod = modules[moduleIndex]
    if (!mod.isNew && !confirm(`Excluir módulo "${mod.name || 'sem nome'}" e todas as suas aulas?`)) return

    if (!mod.isNew) {
      setDeletedModuleIds(prev => [...prev, mod.id])
      // Also track lesson IDs for cleanup
      mod.lessons.forEach(l => {
        if (!l.isNew) setDeletedLessonIds(prev => [...prev, l.id])
      })
    }
    setModules(prev => prev.filter((_, i) => i !== moduleIndex))
    markChanged()
  }, [modules, markChanged])

  const handleModuleReorder = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setModules(prev => {
      const oldIndex = prev.findIndex(m => m.id === active.id)
      const newIndex = prev.findIndex(m => m.id === over.id)
      return arrayMove(prev, oldIndex, newIndex).map((m, i) => ({ ...m, order_index: i, isModified: !m.isNew }))
    })
    markChanged()
  }, [markChanged])

  /* ---- Lesson handlers ---- */
  const addLesson = useCallback((moduleIndex: number) => {
    setModules(prev => prev.map((m, i) => {
      if (i !== moduleIndex) return m
      const newLesson: LessonData = {
        id: generateTempId(),
        title: '',
        description: '',
        video_source_type: null,
        video_source_id: null,
        duration_seconds: null,
        is_active: true,
        is_preview: false,
        order_index: m.lessons.length,
        attachments: [],
        accompanying_pdf_attachment_id: null,
        topic_id: null,
        quiz_id: null,
        quiz_required: false,
        quiz_min_percentage: 70,
        isNew: true,
      }
      return { ...m, lessons: [...m.lessons, newLesson] }
    }))
    markChanged()
  }, [markChanged])

  const updateLesson = useCallback((moduleIndex: number, lessonIndex: number, field: string, value: any) => {
    setModules(prev => prev.map((m, mi) => {
      if (mi !== moduleIndex) return m
      return {
        ...m,
        lessons: m.lessons.map((l, li) => li === lessonIndex ? { ...l, [field]: value, isModified: !l.isNew } : l),
      }
    }))
    markChanged()
  }, [markChanged])

  const deleteLesson = useCallback((moduleIndex: number, lessonIndex: number) => {
    const lesson = modules[moduleIndex]?.lessons[lessonIndex]
    if (!lesson) return
    if (!lesson.isNew && !confirm(`Excluir aula "${lesson.title || 'sem título'}"?`)) return

    if (!lesson.isNew) {
      setDeletedLessonIds(prev => [...prev, lesson.id])
    }
    setModules(prev => prev.map((m, mi) => {
      if (mi !== moduleIndex) return m
      return { ...m, lessons: m.lessons.filter((_, li) => li !== lessonIndex) }
    }))
    markChanged()
  }, [modules, markChanged])

  const handleLessonReorder = useCallback((moduleIndex: number, event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setModules(prev => prev.map((m, mi) => {
      if (mi !== moduleIndex) return m
      const oldIndex = m.lessons.findIndex(l => l.id === active.id)
      const newIndex = m.lessons.findIndex(l => l.id === over.id)
      return {
        ...m,
        lessons: arrayMove(m.lessons, oldIndex, newIndex).map((l, i) => ({ ...l, order_index: i, isModified: !l.isNew })),
      }
    }))
    markChanged()
  }, [markChanged])

  /* ---- Attachment handlers ---- */
  // Generic helper to add attachment to any lesson in the tree by moduleId
  const addAttachmentToLesson = useCallback((moduleId: string, lessonIndex: number, newAtt: AttachmentData) => {
    setModules(prev => prev.map(m => {
      // Check root module
      if (m.id === moduleId) {
        return { ...m, lessons: m.lessons.map((l, li) => li === lessonIndex ? { ...l, attachments: [...l.attachments, newAtt] } : l) }
      }
      // Check children
      const childIdx = m.children.findIndex(c => c.id === moduleId)
      if (childIdx >= 0) {
        return {
          ...m,
          children: m.children.map(c => {
            if (c.id !== moduleId) return c
            return { ...c, lessons: c.lessons.map((l, li) => li === lessonIndex ? { ...l, attachments: [...l.attachments, newAtt] } : l) }
          }),
        }
      }
      return m
    }))
  }, [])

  const uploadAttachment = useCallback(async (moduleIndex: number, lessonIndex: number, file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Maximo 50MB.', variant: 'destructive' })
      return
    }

    try {
      const ext = file.name.split('.').pop()
      const path = `attachments/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
      const { error } = await supabase.storage.from('course_materials').upload(path, file)
      if (error) throw error

      const { data: { publicUrl } } = supabase.storage.from('course_materials').getPublicUrl(path)

      const newAtt: AttachmentData = {
        id: generateTempId(),
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type.includes('pdf') ? 'pdf' : file.name.split('.').pop() || 'file',
        isNew: true,
      }

      setModules(prev => prev.map((m, mi) => {
        if (mi !== moduleIndex) return m
        return {
          ...m,
          lessons: m.lessons.map((l, li) => li === lessonIndex ? { ...l, attachments: [...l.attachments, newAtt] } : l),
        }
      }))
      markChanged()
      toast({ title: 'Arquivo enviado!' })
    } catch (err) {
      logger.error(err)
      toast({ title: 'Erro no upload', variant: 'destructive' })
    }
  }, [toast, markChanged])

  const uploadChildAttachment = useCallback(async (parentIndex: number, childIndex: number, lessonIndex: number, file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Maximo 50MB.', variant: 'destructive' })
      return
    }
    try {
      const ext = file.name.split('.').pop()
      const path = `attachments/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
      const { error } = await supabase.storage.from('course_materials').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('course_materials').getPublicUrl(path)
      const newAtt: AttachmentData = {
        id: generateTempId(), file_url: publicUrl, file_name: file.name,
        file_type: file.type.includes('pdf') ? 'pdf' : file.name.split('.').pop() || 'file', isNew: true,
      }
      setModules(prev => prev.map((m, pi) => {
        if (pi !== parentIndex) return m
        return {
          ...m,
          children: m.children.map((c, ci) => {
            if (ci !== childIndex) return c
            return { ...c, lessons: c.lessons.map((l, li) => li === lessonIndex ? { ...l, attachments: [...l.attachments, newAtt] } : l) }
          }),
        }
      }))
      markChanged()
      toast({ title: 'Arquivo enviado!' })
    } catch (err) {
      logger.error(err)
      toast({ title: 'Erro no upload', variant: 'destructive' })
    }
  }, [toast, markChanged])

  const deleteAttachment = useCallback((moduleIndex: number, lessonIndex: number, attId: string) => {
    const att = modules[moduleIndex]?.lessons[lessonIndex]?.attachments.find(a => a.id === attId)
    if (att && !att.isNew) {
      setDeletedAttachmentIds(prev => [...prev, attId])
    }
    setModules(prev => prev.map((m, mi) => {
      if (mi !== moduleIndex) return m
      return {
        ...m,
        lessons: m.lessons.map((l, li) => {
          if (li !== lessonIndex) return l
          return {
            ...l,
            attachments: l.attachments.filter(a => a.id !== attId),
            accompanying_pdf_attachment_id: l.accompanying_pdf_attachment_id === attId ? null : l.accompanying_pdf_attachment_id,
          }
        }),
      }
    }))
    markChanged()
  }, [modules, markChanged])

  const deleteChildAttachment = useCallback((parentIndex: number, childIndex: number, lessonIndex: number, attId: string) => {
    const att = modules[parentIndex]?.children[childIndex]?.lessons[lessonIndex]?.attachments.find(a => a.id === attId)
    if (att && !att.isNew) {
      setDeletedAttachmentIds(prev => [...prev, attId])
    }
    setModules(prev => prev.map((m, pi) => {
      if (pi !== parentIndex) return m
      return {
        ...m,
        children: m.children.map((c, ci) => {
          if (ci !== childIndex) return c
          return {
            ...c,
            lessons: c.lessons.map((l, li) => {
              if (li !== lessonIndex) return l
              return { ...l, attachments: l.attachments.filter(a => a.id !== attId), accompanying_pdf_attachment_id: l.accompanying_pdf_attachment_id === attId ? null : l.accompanying_pdf_attachment_id }
            }),
          }
        }),
      }
    }))
    markChanged()
  }, [modules, markChanged])

  const setAccompanyingPdf = useCallback((moduleIndex: number, lessonIndex: number, attId: string | null) => {
    updateLesson(moduleIndex, lessonIndex, 'accompanying_pdf_attachment_id', attId)
  }, [updateLesson])

  const setChildAccompanyingPdf = useCallback((parentIndex: number, childIndex: number, lessonIndex: number, attId: string | null) => {
    updateChildLesson(parentIndex, childIndex, lessonIndex, 'accompanying_pdf_attachment_id', attId)
  }, [updateChildLesson])

  /* ---- Video picker ---- */
  const [videoPickerContext, setVideoPickerContext] = useState<{ parentIndex?: number; childIndex?: number } | null>(null)

  const openVideoPicker = useCallback((moduleIndex: number, lessonIndex: number) => {
    setVideoPickerTarget({ moduleIndex, lessonIndex })
    setVideoPickerContext(null)
    setVideoPickerOpen(true)
  }, [])

  const openChildVideoPicker = useCallback((parentIndex: number, childIndex: number, lessonIndex: number) => {
    setVideoPickerTarget({ moduleIndex: parentIndex, lessonIndex })
    setVideoPickerContext({ parentIndex, childIndex })
    setVideoPickerOpen(true)
  }, [])

  const handleVideoSelect = useCallback((video: PandaVideo) => {
    if (!videoPickerTarget) return
    const { moduleIndex, lessonIndex } = videoPickerTarget
    const isYouTube = (video as any)._source === 'youtube'
    const videoData = {
      video_source_type: isYouTube ? 'youtube' : 'panda_video',
      video_source_id: video.id,
      duration_seconds: video.duration,
      title: video.title,
    }

    if (videoPickerContext?.childIndex != null) {
      // Child module lesson
      const { parentIndex, childIndex } = videoPickerContext as { parentIndex: number; childIndex: number }
      setModules(prev => prev.map((m, pi) => {
        if (pi !== parentIndex) return m
        return {
          ...m,
          children: m.children.map((c, ci) => {
            if (ci !== childIndex) return c
            return {
              ...c,
              lessons: c.lessons.map((l, li) => {
                if (li !== lessonIndex) return l
                return { ...l, ...videoData, duration_seconds: videoData.duration_seconds || l.duration_seconds, title: l.title || videoData.title, isModified: !l.isNew }
              }),
            }
          }),
        }
      }))
    } else {
      // Root module lesson
      setModules(prev => prev.map((m, mi) => {
        if (mi !== moduleIndex) return m
        return {
          ...m,
          lessons: m.lessons.map((l, li) => {
            if (li !== lessonIndex) return l
            return { ...l, ...videoData, duration_seconds: videoData.duration_seconds || l.duration_seconds, title: l.title || videoData.title, isModified: !l.isNew }
          }),
        }
      }))
    }
    markChanged()
  }, [videoPickerTarget, videoPickerContext, markChanged])

  /* ---- Toggle module ---- */
  const toggleModule = useCallback((moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }, [])

  /* ---- SAVE (incremental) ---- */
  const handleSave = useCallback(async () => {
    // Validate
    if (!course.name.trim()) {
      toast({ title: 'Nome do curso obrigatorio', variant: 'destructive' })
      return
    }
    for (const mod of modules) {
      if (!mod.name.trim()) {
        toast({ title: 'Todos os módulos precisam ter nome', variant: 'destructive' })
        return
      }
      for (const lesson of mod.lessons) {
        if (!lesson.title.trim()) {
          toast({ title: `Todas as aulas precisam ter título (módulo "${mod.name}")`, variant: 'destructive' })
          return
        }
      }
      for (const child of mod.children) {
        if (!child.name.trim()) {
          toast({ title: 'Todos os submódulos precisam ter nome', variant: 'destructive' })
          return
        }
        for (const lesson of child.lessons) {
          if (!lesson.title.trim()) {
            toast({ title: `Todas as aulas precisam ter título (submódulo "${child.name}")`, variant: 'destructive' })
            return
          }
        }
      }
    }

    setSaving(true)
    try {
      let savedCourseId = course.id

      // 1. Save or create course
      const baseFields = {
        name: course.name,
        description: course.description || null,
        thumbnail_url: course.thumbnail_url || null,
        is_active: course.is_active,
        status: course.is_active ? 'published' : 'draft',
        sales_url: course.sales_url || null,
        show_in_storefront: course.show_in_storefront,
      }

      if (isNewCourse || !savedCourseId) {
        const insertData = { ...baseFields, evercast_enabled: course.evercast_enabled, created_by_user_id: user?.id }
        const result = await supabase.from('video_courses').insert(insertData).select('id').single()
        if (result.error) throw result.error
        savedCourseId = result.data!.id
        setCourse(prev => ({ ...prev, id: savedCourseId }))
      } else {
        const updateData = { ...baseFields, evercast_enabled: course.evercast_enabled, updated_at: new Date().toISOString() }
        const result = await supabase.from('video_courses').update(updateData).eq('id', savedCourseId)
        if (result.error) throw result.error
      }

      // 2. Delete removed items (parallel)
      await Promise.all([
        deletedAttachmentIds.length > 0 ? supabase.from('lesson_attachments').delete().in('id', deletedAttachmentIds) : null,
        deletedLessonIds.length > 0 ? supabase.from('video_lessons').delete().in('id', deletedLessonIds) : null,
        deletedModuleIds.length > 0 ? supabase.from('video_modules').delete().in('id', deletedModuleIds) : null,
      ].filter(Boolean))

      // 3. Save modules and lessons (helper)
      const saveLesson = async (lesson: LessonData, li: number, moduleId: string) => {
        let savedLessonId = lesson.id

        if (lesson.isNew) {
          const pdfId = lesson.accompanying_pdf_attachment_id?.startsWith('temp_') ? null : lesson.accompanying_pdf_attachment_id
          const { data: newLesson, error } = await supabase
            .from('video_lessons')
            .insert({
              module_id: moduleId,
              title: lesson.title, description: lesson.description || null,
              video_source_type: lesson.video_source_type || null, video_source_id: lesson.video_source_id || null,
              duration_seconds: lesson.duration_seconds || null, is_active: lesson.is_active, is_preview: lesson.is_preview,
              order_index: li, accompanying_pdf_attachment_id: pdfId || null,
              topic_id: lesson.topic_id || null, quiz_id: lesson.quiz_id || null,
              quiz_required: lesson.quiz_required, quiz_min_percentage: lesson.quiz_min_percentage,
            }).select('id').single()
          if (error) throw error
          savedLessonId = newLesson.id
        } else if (lesson.isModified) {
          const pdfIdForUpdate = lesson.accompanying_pdf_attachment_id?.startsWith('temp_') ? null : lesson.accompanying_pdf_attachment_id
          const { error } = await supabase.from('video_lessons').update({
            title: lesson.title, description: lesson.description || null,
            video_source_type: lesson.video_source_type || null, video_source_id: lesson.video_source_id || null,
            duration_seconds: lesson.duration_seconds || null, is_active: lesson.is_active, is_preview: lesson.is_preview,
            order_index: li, accompanying_pdf_attachment_id: pdfIdForUpdate || null,
            topic_id: lesson.topic_id || null, quiz_id: lesson.quiz_id || null,
            quiz_required: lesson.quiz_required, quiz_min_percentage: lesson.quiz_min_percentage,
          }).eq('id', savedLessonId)
          if (error) throw error
        }
        // Skip DB operation for unchanged lessons (not isNew and not isModified)

        // Save new attachments (parallel)
        const newAtts = lesson.attachments.filter(a => a.isNew)
        const existingAtts = lesson.attachments.filter(a => !a.isNew)
        const insertedAtts = newAtts.length > 0
          ? await Promise.all(newAtts.map(att =>
              supabase.from('lesson_attachments').insert({
                lesson_id: savedLessonId, file_url: att.file_url, file_name: att.file_name, file_type: att.file_type,
              }).select('id, file_url, file_name, file_type').single().then(r => { if (r.error) throw r.error; return r.data as AttachmentData })
            ))
          : []
        const savedAttachments = [...existingAtts, ...insertedAtts]

        // Update accompanying PDF if it was a new attachment
        if (lesson.accompanying_pdf_attachment_id?.startsWith('temp_')) {
          const origAtt = lesson.attachments.find(a => a.id === lesson.accompanying_pdf_attachment_id)
          const savedAtt = savedAttachments.find(a => a.file_url === origAtt?.file_url)
          if (savedAtt) {
            await supabase.from('video_lessons').update({ accompanying_pdf_attachment_id: savedAtt.id }).eq('id', savedLessonId)
          }
        }

        return { ...lesson, id: savedLessonId, order_index: li, attachments: savedAttachments, isNew: false, isModified: false } as LessonData
      }

      const saveLessonsForModule = async (mod: ModuleData, moduleId: string) => {
        const existingLessons = mod.lessons.map((l, i) => ({ lesson: l, index: i })).filter(x => !x.lesson.isNew)
        const newLessons = mod.lessons.map((l, i) => ({ lesson: l, index: i })).filter(x => x.lesson.isNew)
        const savedExisting = await Promise.all(existingLessons.map(x => saveLesson(x.lesson, x.index, moduleId)))
        const savedNew: LessonData[] = []
        for (const x of newLessons) {
          savedNew.push(await saveLesson(x.lesson, x.index, moduleId))
        }
        return [...savedExisting, ...savedNew].sort((a, b) => a.order_index - b.order_index)
      }

      const savedModules: ModuleData[] = []

      for (let mi = 0; mi < modules.length; mi++) {
        const mod = modules[mi]
        let savedModuleId = mod.id

        if (mod.isNew) {
          const { data: newMod, error } = await supabase
            .from('video_modules')
            .insert({
              course_id: savedCourseId,
              name: mod.name,
              is_active: mod.is_active,
              order_index: mi,
              parent_module_id: null,
            })
            .select('id')
            .single()
          if (error) throw error
          savedModuleId = newMod.id
        } else if (mod.isModified) {
          const { error } = await supabase
            .from('video_modules')
            .update({
              name: mod.name,
              is_active: mod.is_active,
              order_index: mi,
              parent_module_id: null,
            })
            .eq('id', savedModuleId)
          if (error) throw error
        }

        const savedLessons = await saveLessonsForModule(mod, savedModuleId)

        // Save children (submodules)
        const savedChildren: ModuleData[] = []
        for (let ci = 0; ci < mod.children.length; ci++) {
          const child = mod.children[ci]
          let savedChildId = child.id

          if (child.isNew) {
            const { data: newChild, error } = await supabase
              .from('video_modules')
              .insert({
                course_id: savedCourseId,
                name: child.name,
                is_active: child.is_active,
                order_index: ci,
                parent_module_id: savedModuleId,
              })
              .select('id')
              .single()
            if (error) throw error
            savedChildId = newChild.id
          } else if (child.isModified) {
            const { error } = await supabase
              .from('video_modules')
              .update({
                name: child.name,
                is_active: child.is_active,
                order_index: ci,
                parent_module_id: savedModuleId,
              })
              .eq('id', savedChildId)
            if (error) throw error
          }

          const savedChildLessons = await saveLessonsForModule(child, savedChildId)
          savedChildren.push({
            ...child,
            id: savedChildId,
            parent_module_id: savedModuleId,
            order_index: ci,
            lessons: savedChildLessons,
            children: [],
            isNew: false,
            isModified: false,
          })
        }

        savedModules.push({
          ...mod,
          id: savedModuleId,
          parent_module_id: null,
          order_index: mi,
          lessons: savedLessons,
          children: savedChildren,
          isNew: false,
          isModified: false,
        })
      }

      setModules(savedModules)
      setDeletedModuleIds([])
      setDeletedLessonIds([])
      setDeletedAttachmentIds([])
      setHasChanges(false)

      // Save Kiwify product mapping if product ID is set
      if (course.kiwify_product_id?.trim()) {
        // Find the class linked to this course
        const { data: classLink } = await supabase
          .from('class_courses')
          .select('class_id')
          .eq('course_id', savedCourseId)
          .limit(1)
          .maybeSingle()

        if (classLink) {
          await supabase.from('kiwify_products').upsert({
            kiwify_product_id: course.kiwify_product_id.trim(),
            class_id: classLink.class_id,
            product_name: course.name,
            is_active: true,
          }, { onConflict: 'kiwify_product_id' })
        }
      }

      toast({ title: 'Curso salvo com sucesso!' })

      // If was new course, navigate to edit URL
      if (isNewCourse) {
        navigate(`/admin/courses/${savedCourseId}/edit`, { replace: true })
      }
    } catch (err) {
      logger.warn('Error saving course:', err)
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [course, modules, deletedModuleIds, deletedLessonIds, deletedAttachmentIds, isNewCourse, user?.id, toast, navigate])

  /* ---- Stats ---- */
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length + m.children.reduce((cs, c) => cs + c.lessons.length, 0), 0)
  const totalDuration = modules.reduce((sum, m) => {
    const own = m.lessons.reduce((s, l) => s + (l.duration_seconds || 0), 0)
    const childDur = m.children.reduce((cs, c) => cs + c.lessons.reduce((s, l) => s + (l.duration_seconds || 0), 0), 0)
    return sum + own + childDur
  }, 0)
  const totalAttachments = modules.reduce((sum, m) => {
    const own = m.lessons.reduce((s, l) => s + l.attachments.length, 0)
    const childAtts = m.children.reduce((cs, c) => cs + c.lessons.reduce((s, l) => s + l.attachments.length, 0), 0)
    return sum + own + childAtts
  }, 0)
  const totalSubmodules = modules.reduce((sum, m) => sum + m.children.length, 0)

  /* ---- Render ---- */
  if (loading) return <SectionLoader />

  return (
    <>
      <PandaVideoPickerModal
        isOpen={videoPickerOpen}
        onOpenChange={setVideoPickerOpen}
        onVideoSelect={handleVideoSelect}
      />

      <div className="space-y-6">
        <div className="max-w-5xl mx-auto py-6 space-y-6">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/courses')} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                Cursos
              </Button>
              <h1 className="text-lg font-bold text-foreground">
                {isNewCourse ? 'Novo Curso' : 'Editar Curso'}
              </h1>
              {hasChanges && (
                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500 bg-amber-100 dark:bg-amber-950/50">
                  <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                  Alterações não salvas
                </Badge>
              )}
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-2 px-5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>

          {/* Course details card */}
          <div className="border border-border rounded-xl bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Detalhes do Curso</h2>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-5">
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Nome do curso</label>
                  <Input
                    value={course.name}
                    onChange={(e) => updateCourseField('name', e.target.value)}
                    placeholder="Ex: Extensivo EAOF 2027"
                    className="font-medium"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Descricao</label>
                  <Textarea
                    value={course.description}
                    onChange={(e) => updateCourseField('description', e.target.value)}
                    placeholder="Descricao do curso..."
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Link de Checkout (Kiwify, Hotmart, etc.)</label>
                  <Input
                    value={course.sales_url || ''}
                    onChange={(e) => updateCourseField('sales_url', e.target.value || null)}
                    placeholder="https://pay.kiwify.com.br/..."
                    className="text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Aparece para alunos não matriculados na vitrine de cursos</p>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Kiwify Product ID</label>
                  <Input
                    value={course.kiwify_product_id || ''}
                    onChange={(e) => updateCourseField('kiwify_product_id', e.target.value || null)}
                    placeholder="Ex: 9fb08420-022f-11f1-929a-d77c1f07a453"
                    className="text-sm font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">ID do produto na Kiwify — conecta compra automática com matrícula</p>
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch
                      checked={course.is_active}
                      onCheckedChange={(v) => updateCourseField('is_active', v)}
                    />
                    <span className={course.is_active ? 'text-emerald-500 font-medium' : 'text-muted-foreground'}>
                      {course.is_active ? 'Publicado' : 'Rascunho'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch
                      checked={course.evercast_enabled}
                      onCheckedChange={(v) => updateCourseField('evercast_enabled', v)}
                    />
                    <span className={course.evercast_enabled ? 'text-purple-500 font-medium' : 'text-muted-foreground'}>
                      {course.evercast_enabled ? 'Evercast ativo' : 'Evercast desativado'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch
                      checked={course.show_in_storefront}
                      onCheckedChange={(v) => updateCourseField('show_in_storefront', v)}
                    />
                    <span className={course.show_in_storefront ? 'text-orange-500 font-medium' : 'text-muted-foreground'}>
                      {course.show_in_storefront ? 'Vitrine ativa' : 'Vitrine desativada'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Thumbnail */}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Capa do curso</label>
                <div
                  className="relative aspect-[3/4] rounded-lg border-2 border-dashed border-border overflow-hidden bg-muted/20 cursor-pointer hover:border-primary/40 transition-colors group"
                  onClick={() => thumbnailInputRef.current?.click()}
                >
                  {course.thumbnail_url ? (
                    <>
                      <img src={course.thumbnail_url} alt="Capa do curso" className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40">
                      {uploadingThumbnail ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <>
                          <ImageIcon className="h-6 w-6 mb-1" />
                          <span className="text-[10px]">Enviar capa</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleThumbnailUpload(file)
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/20 rounded-xl text-xs text-muted-foreground">
            <span>{modules.length} {modules.length === 1 ? 'módulo' : 'módulos'}</span>
            {totalSubmodules > 0 && (
              <>
                <span className="text-border">|</span>
                <span>{totalSubmodules} {totalSubmodules === 1 ? 'submódulo' : 'submódulos'}</span>
              </>
            )}
            <span className="text-border">|</span>
            <span>{totalLessons} {totalLessons === 1 ? 'aula' : 'aulas'}</span>
            <span className="text-border">|</span>
            <span>{totalDuration > 0 ? `${Math.round(totalDuration / 60)}min de video` : 'Sem video'}</span>
            <span className="text-border">|</span>
            <span>{totalAttachments} {totalAttachments === 1 ? 'arquivo' : 'arquivos'}</span>
          </div>

          {/* Modules list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Modulos e Aulas</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (expandedModules.size > 0) setExpandedModules(new Set())
                    else setExpandedModules(new Set(modules.map(m => m.id)))
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {expandedModules.size > 0 ? 'Recolher tudo' : 'Expandir tudo'}
                </button>
              </div>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleReorder}>
              <SortableContext items={modules.map(m => m.id)} strategy={verticalListSortingStrategy}>
                {modules.map((mod, moduleIndex) => (
                  <SortableModuleItem
                    key={mod.id}
                    module={mod}
                    moduleIndex={moduleIndex}
                    isExpanded={expandedModules.has(mod.id)}
                    expandedModules={expandedModules}
                    onToggle={() => toggleModule(mod.id)}
                    onToggleChild={(id) => toggleModule(id)}
                    onUpdate={(field, value) => updateModule(moduleIndex, field, value)}
                    onDelete={() => deleteModule(moduleIndex)}
                    onAddLesson={() => addLesson(moduleIndex)}
                    onUpdateLesson={(li, field, value) => updateLesson(moduleIndex, li, field, value)}
                    onDeleteLesson={(li) => deleteLesson(moduleIndex, li)}
                    onReorderLessons={(event) => handleLessonReorder(moduleIndex, event)}
                    onUploadAttachment={(li, file) => uploadAttachment(moduleIndex, li, file)}
                    onDeleteAttachment={(li, attId) => deleteAttachment(moduleIndex, li, attId)}
                    onSetAccompanyingPdf={(li, attId) => setAccompanyingPdf(moduleIndex, li, attId)}
                    onOpenVideoPicker={(li) => openVideoPicker(moduleIndex, li)}
                    onAddSubmodule={() => addSubmodule(moduleIndex)}
                    onUpdateChild={(ci, field, value) => updateChildModule(moduleIndex, ci, field, value)}
                    onDeleteChild={(ci) => deleteChildModule(moduleIndex, ci)}
                    onAddChildLesson={(ci) => addChildLesson(moduleIndex, ci)}
                    onUpdateChildLesson={(ci, li, field, value) => updateChildLesson(moduleIndex, ci, li, field, value)}
                    onDeleteChildLesson={(ci, li) => deleteChildLesson(moduleIndex, ci, li)}
                    onReorderChildLessons={(ci, event) => handleChildLessonReorder(moduleIndex, ci, event)}
                    onUploadChildAttachment={(ci, li, file) => uploadChildAttachment(moduleIndex, ci, li, file)}
                    onDeleteChildAttachment={(ci, li, attId) => deleteChildAttachment(moduleIndex, ci, li, attId)}
                    onSetChildAccompanyingPdf={(ci, li, attId) => setChildAccompanyingPdf(moduleIndex, ci, li, attId)}
                    onOpenChildVideoPicker={(ci, li) => openChildVideoPicker(moduleIndex, ci, li)}
                    onPromoteChild={(ci) => promoteChildToModule(moduleIndex, ci)}
                    onReorderChildren={(event) => handleChildReorder(moduleIndex, event)}
                    allSubjects={allSubjects}
                    allTopics={allTopics}
                    allQuizzes={allQuizzes}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {modules.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-xl">
                <Video className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-1">Nenhum módulo ainda</p>
                <p className="text-xs text-muted-foreground/60">Comece adicionando o primeiro módulo do curso</p>
              </div>
            )}

            {/* Add module button */}
            <button
              onClick={addModule}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border/50 rounded-xl text-sm text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all font-medium"
            >
              <Plus className="h-4 w-4" />
              Adicionar módulo
            </button>
          </div>

          {/* Bottom save bar */}
          {hasChanges && (
            <div className="sticky bottom-4 flex items-center justify-between px-5 py-3 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-muted-foreground">Você tem alterações não salvas</span>
              </div>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Salvando...' : 'Salvar alteracoes'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
