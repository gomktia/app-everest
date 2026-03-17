import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  FileText,
  PenLine,
  BookOpen,
  Lightbulb,
  Save,
  Send,
  Trash2,
  Plus,
  ImageIcon,

  Upload,
  FileDown,
} from 'lucide-react'
import {
  getEssayForCorrection,
  type EssayForCorrection,
} from '@/services/essayService'
import { useAuth } from '@/hooks/use-auth'
import { SectionLoader } from '@/components/SectionLoader'
import { useToast } from '@/hooks/use-toast'
import { createNotification } from '@/services/notificationService'
import { aiCorrectionService } from '@/services/ai/aiCorrectionService'
import { ciaarCorrectionService } from '@/services/ciaarCorrectionService'
import type {
  CorrectionTemplate,
  CorrectionResult,
  CorrectionType,
  ExpressionError,
  StructureAnalysis,
  ContentAnalysis,
  ImprovementSuggestion,
  CompetencyScore,
  EnemCompetencyDef,
} from '@/types/essay-correction'
import { calculateFinalGrade, calculateEnemGrade, createEmptyCompetencyScores } from '@/types/essay-correction'
import { EssayTextAnnotator } from '@/components/admin/essays/EssayTextAnnotator'
import { PdfAnnotationCanvas } from '@/components/admin/essays/PdfAnnotationCanvas'
import { AudioFeedbackRecorder } from '@/components/admin/essays/AudioFeedbackRecorder'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

export default function AdminEssayCorrectionPage() {
  const { submissionId } = useParams<{ submissionId: string }>()
  const navigate = useNavigate()
  usePageTitle('Correção de Redação')
  const { user } = useAuth()
  const { toast } = useToast()

  const [essay, setEssay] = useState<EssayForCorrection | null>(null)
  const [allTemplates, setAllTemplates] = useState<CorrectionTemplate[]>([])
  const [template, setTemplate] = useState<CorrectionTemplate | null>(null)
  const [correctionType, setCorrectionType] = useState<CorrectionType>('ciaar')
  const [isLoading, setIsLoading] = useState(true)
  const [isAILoading, setIsAILoading] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [fileUrl, setFileUrl] = useState<string | null>(null)

  // CIAAR correction data
  const [expressionErrors, setExpressionErrors] = useState<ExpressionError[]>([])
  const [structureAnalysis, setStructureAnalysis] = useState<StructureAnalysis[]>([])
  const [contentAnalysis, setContentAnalysis] = useState<ContentAnalysis[]>([])
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion[]>([])

  // ENEM correction data
  const [competencyScores, setCompetencyScores] = useState<CompetencyScore[]>([])

  // Shared
  const [transcribedText, setTranscribedText] = useState('')
  const [teacherFeedback, setTeacherFeedback] = useState('')
  const [correctedFileUrl, setCorrectedFileUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false)
  const [annotatedTextHtml, setAnnotatedTextHtml] = useState<string | null>(null)
  const [annotationImageUrl, setAnnotationImageUrl] = useState<string | null>(null)
  const [feedbackAudioUrl, setFeedbackAudioUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!submissionId) return
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [essayData, templates, existingCorrection] = await Promise.all([
          getEssayForCorrection(submissionId),
          ciaarCorrectionService.getAllTemplates(),
          ciaarCorrectionService.loadCorrection(submissionId),
        ])

        setEssay(essayData)
        setAllTemplates(templates)

        // Determine correction type from existing correction or default template
        if (existingCorrection) {
          setCorrectionType(existingCorrection.correctionType || 'ciaar')
          if (existingCorrection.correctionType === 'enem') {
            setCompetencyScores(existingCorrection.competencyScores)
          } else {
            setExpressionErrors(existingCorrection.expressionErrors)
            setStructureAnalysis(existingCorrection.structureAnalysis)
            setContentAnalysis(existingCorrection.contentAnalysis)
          }
          setSuggestions(existingCorrection.improvementSuggestions)

          // Find the template that was used
          const usedTemplateId = (essayData as any)?.correction_template_id
          const usedTemplate = usedTemplateId
            ? templates.find(t => t.id === usedTemplateId)
            : templates.find(t => t.correction_type === existingCorrection.correctionType && t.is_default)
          setTemplate(usedTemplate || templates.find(t => t.is_default) || templates[0] || null)
        } else {
          // No existing correction - use default template
          const defaultTemplate = templates.find(t => t.is_default) || templates[0]
          setTemplate(defaultTemplate || null)
          setCorrectionType(defaultTemplate?.correction_type || 'ciaar')
        }

        // Load transcribed text
        if ((essayData as any)?.transcribed_text) {
          setTranscribedText((essayData as any).transcribed_text)
        }

        // Load teacher feedback
        if ((essayData as any)?.teacher_feedback_text) {
          setTeacherFeedback((essayData as any).teacher_feedback_text)
        }

        // Load file URL for image/PDF essays
        if ((essayData as any)?.file_url) {
          const { data } = await supabase.storage
            .from('essays')
            .createSignedUrl((essayData as any).file_url, 3600)
          if (data?.signedUrl) setFileUrl(data.signedUrl)
        }

        // Load corrected file URL
        if ((essayData as any)?.corrected_file_url) {
          const { data } = await supabase.storage
            .from('essays')
            .createSignedUrl((essayData as any).corrected_file_url, 3600)
          if (data?.signedUrl) setCorrectedFileUrl(data.signedUrl)
        }

        // Load teacher annotations
        if ((essayData as any)?.annotated_text_html) {
          setAnnotatedTextHtml((essayData as any).annotated_text_html)
        }
        if ((essayData as any)?.annotation_image_url) {
          setAnnotationImageUrl((essayData as any).annotation_image_url)
        }
        if ((essayData as any)?.teacher_feedback_audio_url) {
          const { data } = await supabase.storage
            .from('essays')
            .createSignedUrl((essayData as any).teacher_feedback_audio_url, 3600)
          if (data?.signedUrl) setFeedbackAudioUrl(data.signedUrl)
        }
      } catch {
        toast({ title: 'Erro ao carregar redação', variant: 'destructive' })
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [submissionId])

  // --- Template change handler ---
  const handleTemplateChange = (templateId: string) => {
    const newTemplate = allTemplates.find(t => t.id === templateId)
    if (!newTemplate) return
    setTemplate(newTemplate)
    const newType = newTemplate.correction_type || 'ciaar'
    setCorrectionType(newType)

    // Initialize ENEM competency scores from template
    if (newType === 'enem' && competencyScores.length === 0) {
      const competencies = (newTemplate.content_criteria as any)?.competencies as EnemCompetencyDef[] | undefined
      if (competencies) {
        setCompetencyScores(createEmptyCompetencyScores(competencies))
      }
    }
  }

  // --- Grade calculations ---
  const expressionDebitTotal = expressionErrors.reduce((sum, e) => sum + e.debit_value, 0)
  const structureDebitTotal = structureAnalysis.reduce((sum, s) => sum + s.debit_value, 0)
  const contentDebitTotal = contentAnalysis.reduce((sum, c) => sum + c.debit_value, 0)

  const finalGrade = correctionType === 'enem'
    ? calculateEnemGrade(competencyScores)
    : calculateFinalGrade(
        template?.max_grade ?? 10,
        expressionDebitTotal,
        structureDebitTotal,
        contentDebitTotal,
        contentAnalysis
      )

  const maxGrade = template?.max_grade ?? (correctionType === 'enem' ? 1000 : 10)

  // --- Progress tracking ---
  const getCorrectionProgress = () => {
    if (correctionType === 'enem') {
      const filled = competencyScores.filter(c => c.score > 0 || c.justification).length
      return { filled, total: competencyScores.length, percent: competencyScores.length > 0 ? (filled / competencyScores.length) * 100 : 0 }
    }
    const hasExpression = expressionErrors.length > 0
    const hasStructure = structureAnalysis.length > 0
    const hasContent = contentAnalysis.length > 0
    const filled = [hasExpression, hasStructure, hasContent].filter(Boolean).length
    return { filled, total: 3, percent: (filled / 3) * 100 }
  }
  const progress = getCorrectionProgress()

  // --- AI Correction ---
  const handleAICorrection = async () => {
    if (!essay || !template) {
      toast({ title: 'Template de correção não encontrado', variant: 'destructive' })
      return
    }

    const textToCorrect = transcribedText || essay.submission_text
    if (!textToCorrect) {
      toast({ title: 'Nenhum texto para corrigir', description: 'Transcreva o texto ou verifique a redação.', variant: 'destructive' })
      return
    }

    try {
      setIsAILoading(true)
      toast({ title: 'Iniciando correção com IA...', description: 'Isso pode levar de 15 a 30 segundos.' })

      const result: CorrectionResult = await aiCorrectionService.correctEssay({
        essayText: textToCorrect,
        theme: essay.essay_prompts?.title || 'Tema Livre',
        correctionTemplate: {
          name: template.name,
          correction_type: correctionType,
          max_grade: template.max_grade,
          expression_debit_value: template.expression_debit_value,
          structure_criteria: template.structure_criteria,
          content_criteria: template.content_criteria,
        },
        studentName: `${essay.users?.first_name || ''} ${essay.users?.last_name || ''}`.trim() || undefined,
      })

      // Populate correction data from AI response
      if (correctionType === 'enem' && result.competencyScores?.length > 0) {
        setCompetencyScores(result.competencyScores)
      } else {
        setExpressionErrors(result.expressionErrors || [])
        setStructureAnalysis(result.structureAnalysis || [])
        setContentAnalysis(result.contentAnalysis || [])
      }
      setSuggestions(result.improvementSuggestions || [])

      toast({ title: 'Correção IA concluída!', description: 'Revise os resultados antes de finalizar.' })
    } catch (err: any) {
      toast({
        title: 'Erro na correção IA',
        description: err.message || 'Não foi possível gerar a correção.',
        variant: 'destructive',
      })
    } finally {
      setIsAILoading(false)
    }
  }

  const handleTranscribe = async () => {
    if (!fileUrl) return
    try {
      setIsTranscribing(true)
      toast({ title: 'Transcrevendo redação manuscrita...' })
      const text = await aiCorrectionService.transcribeEssay([fileUrl])
      setTranscribedText(text)

      if (submissionId) {
        await supabase
          .from('essays')
          .update({ transcribed_text: text })
          .eq('id', submissionId)
      }

      toast({ title: 'Transcrição concluída!' })
    } catch (err: any) {
      toast({
        title: 'Erro na transcrição',
        description: err.message || 'Não foi possível transcrever.',
        variant: 'destructive',
      })
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleUploadCorrected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !submissionId || !user) return

    setIsUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `corrections/${user.id}/${submissionId}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('essays')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      await supabase
        .from('essays')
        .update({ corrected_file_url: path })
        .eq('id', submissionId)

      const { data } = await supabase.storage
        .from('essays')
        .createSignedUrl(path, 3600)

      if (data?.signedUrl) setCorrectedFileUrl(data.signedUrl)

      toast({ title: 'Correção enviada com sucesso!' })
    } catch (err: any) {
      toast({ title: 'Erro ao enviar arquivo', description: err.message, variant: 'destructive' })
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const handleGeneratePdf = async () => {
    if (!essay || !template) return
    setIsGeneratingPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ format: 'a4', unit: 'mm' })
      const margin = 15
      const pageWidth = doc.internal.pageSize.getWidth() - margin * 2
      let y = margin

      const addText = (text: string, size: number, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [0, 0, 0]) => {
        doc.setFontSize(size)
        doc.setFont('helvetica', style)
        doc.setTextColor(...color)
        const lines = doc.splitTextToSize(text, pageWidth)
        for (const line of lines) {
          if (y > 275) { doc.addPage(); y = margin }
          doc.text(line, margin, y)
          y += size * 0.45
        }
      }

      const addLine = () => {
        if (y > 275) { doc.addPage(); y = margin }
        doc.setDrawColor(200, 200, 200)
        doc.line(margin, y, margin + pageWidth, y)
        y += 4
      }

      const headerLabel = correctionType === 'enem' ? 'RELATÓRIO DE CORREÇÃO ENEM' : 'RELATÓRIO DE CORREÇÃO CIAAR'
      addText(headerLabel, 16, 'bold', [30, 64, 175])
      y += 2
      addLine()
      addText(`Aluno: ${studentName || '—'}`, 10, 'normal')
      addText(`Turma: ${className || '—'}`, 10, 'normal')
      addText(`Tema: ${essay.essay_prompts?.title || 'Tema Livre'}`, 10, 'normal')
      addText(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 10, 'normal')
      y += 3

      addText(`NOTA FINAL: ${correctionType === 'enem' ? finalGrade : finalGrade.toFixed(3)} / ${maxGrade}`, 14, 'bold',
        finalGrade >= (maxGrade * 0.7) ? [22, 163, 74] : finalGrade >= (maxGrade * 0.5) ? [217, 119, 6] : [220, 38, 38])
      y += 4

      if (correctionType === 'enem') {
        // ENEM: competency scores
        addLine()
        addText('COMPETÊNCIAS', 12, 'bold', [30, 64, 175])
        y += 2
        competencyScores.forEach(c => {
          addText(`C${c.competency_number} - ${c.competency_name}: ${c.score}/${c.max_score}`, 10, 'bold')
          if (c.justification) addText(`   ${c.justification}`, 8, 'normal', [80, 80, 80])
          y += 2
        })
      } else {
        // CIAAR: debit breakdown
        addText(`Expressão: -${expressionDebitTotal.toFixed(3)} (${expressionErrors.length} erros)`, 9, 'normal', [220, 38, 38])
        addText(`Estrutura: -${structureDebitTotal.toFixed(3)}`, 9, 'normal', [37, 99, 235])
        addText(`Conteúdo: -${contentDebitTotal.toFixed(3)}`, 9, 'normal', [217, 119, 6])
        y += 4
        addLine()

        if (expressionErrors.length > 0) {
          y += 2
          addText('ERROS DE EXPRESSÃO', 12, 'bold', [220, 38, 38])
          y += 2
          expressionErrors.forEach((err, i) => {
            addText(`${i + 1}. P${err.paragraph_number}, Per. ${err.sentence_number} — Débito: -${err.debit_value.toFixed(3)}`, 9, 'bold')
            if (err.error_text) addText(`   Erro: "${err.error_text}"`, 9, 'normal', [180, 0, 0])
            if (err.suggested_correction) addText(`   Correção: "${err.suggested_correction}"`, 9, 'normal', [0, 128, 0])
            if (err.error_explanation) addText(`   ${err.error_explanation}`, 8, 'normal', [100, 100, 100])
            y += 2
          })
          addLine()
        }

        if (structureAnalysis.length > 0) {
          y += 2
          addText('ANÁLISE DE ESTRUTURA', 12, 'bold', [37, 99, 235])
          y += 2
          structureAnalysis.forEach(s => {
            const type = s.paragraph_type === 'introduction' ? 'Introdução' : s.paragraph_type === 'conclusion' ? 'Conclusão' : 'Desenvolvimento'
            addText(`Parágrafo ${s.paragraph_number} (${type}) — ${s.debit_value > 0 ? `-${s.debit_value.toFixed(3)}` : 'OK'}`, 9, 'bold')
            if (s.analysis_text) addText(`   ${s.analysis_text}`, 8, 'normal', [80, 80, 80])
            y += 2
          })
          addLine()
        }

        if (contentAnalysis.length > 0) {
          y += 2
          addText('ANÁLISE DE CONTEÚDO', 12, 'bold', [217, 119, 6])
          y += 2
          contentAnalysis.forEach(c => {
            addText(`${c.criterion_name} — ${c.debit_level} (${c.debit_value > 0 ? `-${c.debit_value.toFixed(3)}` : 'Sem débito'})`, 9, 'bold')
            if (c.analysis_text) addText(`   ${c.analysis_text}`, 8, 'normal', [80, 80, 80])
            y += 2
          })
          addLine()
        }
      }

      if (suggestions.length > 0) {
        y += 2
        addText('SUGESTÕES DE MELHORIA', 12, 'bold', [5, 150, 105])
        y += 2
        suggestions.forEach(s => {
          const cat = s.category === 'expression' ? 'Expressão' : s.category === 'structure' ? 'Estrutura' : 'Conteúdo'
          addText(`[${cat}]`, 9, 'bold', [5, 150, 105])
          addText(`   ${s.suggestion_text}`, 8, 'normal', [80, 80, 80])
          y += 2
        })
        addLine()
      }

      if (teacherFeedback) {
        y += 2
        addText('COMENTÁRIOS DO PROFESSOR', 12, 'bold')
        y += 2
        addText(teacherFeedback, 9, 'normal', [60, 60, 60])
      }

      y += 8
      addText('Everest Preparatórios — Correção gerada automaticamente', 7, 'normal', [160, 160, 160])

      doc.save(`correcao-${studentName || 'aluno'}-${essay.essay_prompts?.title || 'tema'}.pdf`.replace(/\s+/g, '-'))
      toast({ title: 'PDF gerado com sucesso!' })
    } catch (err: any) {
      toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'destructive' })
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const buildCorrectionResult = (): CorrectionResult => ({
    correctionType,
    expressionErrors,
    structureAnalysis,
    contentAnalysis,
    improvementSuggestions: suggestions,
    competencyScores,
    totalExpressionDebit: expressionDebitTotal,
    totalStructureDebit: structureDebitTotal,
    totalContentDebit: contentDebitTotal,
    finalGrade,
  })

  const handleSaveDraft = async () => {
    if (!submissionId || !user) return
    if (!template?.id) {
      toast({ title: 'Selecione um modelo de correção', variant: 'destructive' })
      return
    }

    setIsSaving(true)
    try {
      await ciaarCorrectionService.saveCorrection(
        submissionId,
        buildCorrectionResult(),
        template.id,
        user.id,
        undefined,
        true // isDraft
      )

      // Save additional teacher feedback fields
      await supabase
        .from('essays')
        .update({
          teacher_feedback_text: teacherFeedback || null,
          annotated_text_html: annotatedTextHtml || null,
          annotation_image_url: annotationImageUrl || null,
        } as any)
        .eq('id', submissionId)

      toast({ title: 'Rascunho salvo!' })
    } catch {
      toast({ title: 'Erro ao salvar rascunho', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleFinalizeCorrection = async () => {
    if (!submissionId || !user || !essay) return
    if (!template?.id) {
      toast({ title: 'Selecione um modelo de correção antes de finalizar', variant: 'destructive' })
      return
    }

    setIsSaving(true)
    try {
      await ciaarCorrectionService.saveCorrection(
        submissionId,
        buildCorrectionResult(),
        template.id,
        user.id
      )

      await supabase
        .from('essays')
        .update({
          status: 'corrected',
          correction_type: correctionType,
          final_grade: finalGrade,
          teacher_feedback_text: teacherFeedback || null,
          annotated_text_html: annotatedTextHtml || null,
          annotation_image_url: annotationImageUrl || null,
          teacher_feedback_audio_url: (feedbackAudioUrl && !feedbackAudioUrl.startsWith('http')) ? feedbackAudioUrl : undefined,
        } as any)
        .eq('id', submissionId)

      const gradeDisplay = correctionType === 'enem' ? `${finalGrade}` : finalGrade.toFixed(3)
      await createNotification({
        user_id: essay.student_id,
        type: 'essay_corrected',
        title: 'Sua redação foi corrigida!',
        message: `A redação sobre "${essay.essay_prompts?.title}" recebeu nota ${gradeDisplay}.`,
        related_entity_id: essay.id,
        related_entity_type: 'essay',
      })

      toast({ title: 'Correção finalizada e aluno notificado!' })
      navigate(classId ? `/admin/essays/turma/${classId}` : '/admin/essays')
    } catch {
      toast({ title: 'Erro ao finalizar correção', variant: 'destructive' })
    } finally {
      setIsSaving(false)
      setShowFinalizeDialog(false)
    }
  }

  // --- CIAAR: Expression Error management ---
  const removeExpressionError = (index: number) => {
    setExpressionErrors(prev => prev.filter((_, i) => i !== index))
  }

  const addExpressionError = () => {
    setExpressionErrors(prev => [...prev, {
      paragraph_number: 1,
      sentence_number: 1,
      error_text: '',
      error_explanation: '',
      suggested_correction: '',
      debit_value: template?.expression_debit_value ?? 0.2,
      source: 'manual',
    }])
  }

  const updateExpressionError = (index: number, field: keyof ExpressionError, value: string | number) => {
    setExpressionErrors(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e))
  }

  // --- CIAAR: Structure Analysis management ---
  const addStructureAnalysis = () => {
    setStructureAnalysis(prev => [...prev, {
      paragraph_number: prev.length + 1,
      paragraph_type: 'development',
      analysis_text: '',
      debit_value: 0,
      source: 'manual',
    }])
  }

  const removeStructureAnalysis = (index: number) => {
    setStructureAnalysis(prev => prev.filter((_, i) => i !== index))
  }

  const updateStructureAnalysis = (index: number, field: keyof StructureAnalysis, value: string | number) => {
    setStructureAnalysis(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  // --- CIAAR: Content Analysis management ---
  const criterionNameMap: Record<string, string> = {
    pertinence: 'Pertinência ao Tema',
    argumentation: 'Argumentação',
    informativity: 'Informatividade',
  }

  const addContentAnalysis = () => {
    setContentAnalysis(prev => [...prev, {
      criterion_type: 'pertinence',
      criterion_name: 'Pertinência ao Tema',
      analysis_text: '',
      debit_level: 'Sem débito',
      debit_value: 0,
      source: 'manual',
    }])
  }

  const removeContentAnalysis = (index: number) => {
    setContentAnalysis(prev => prev.filter((_, i) => i !== index))
  }

  const updateContentAnalysis = (index: number, field: keyof ContentAnalysis, value: string | number) => {
    setContentAnalysis(prev => prev.map((c, i) => {
      if (i !== index) return c
      const updated = { ...c, [field]: value }
      if (field === 'criterion_type' && typeof value === 'string') {
        updated.criterion_name = criterionNameMap[value] || value
      }
      return updated
    }))
  }

  // --- Suggestions management ---
  const addSuggestion = () => {
    setSuggestions(prev => [...prev, {
      category: 'expression',
      suggestion_text: '',
    }])
  }

  const removeSuggestion = (index: number) => {
    setSuggestions(prev => prev.filter((_, i) => i !== index))
  }

  const updateSuggestion = (index: number, field: keyof ImprovementSuggestion, value: string) => {
    setSuggestions(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  // --- ENEM: Competency management ---
  const updateCompetencyScore = (index: number, field: keyof CompetencyScore, value: string | number) => {
    setCompetencyScores(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  const enemCompetencies = (template?.content_criteria as any)?.competencies as EnemCompetencyDef[] | undefined

  // --- Render ---
  if (isLoading) return <SectionLoader />

  if (!essay) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Redação não encontrada</h1>
        <Button variant="outline" onClick={() => navigate('/admin/essays')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    )
  }

  const studentName = `${essay.users?.first_name || ''} ${essay.users?.last_name || ''}`.trim()
  const classId = essay.users?.student_classes?.[0]?.class_id
  const className = essay.users?.student_classes?.[0]?.classes?.name
  const essayText = transcribedText || essay.submission_text || ''
  const isImage = fileUrl && /\.(jpg|jpeg|png)$/i.test((essay as any).file_url || '')
  const submittedAt = (essay as any)?.created_at
    ? new Date((essay as any).created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  const getGradeColor = (g: number, max: number) => {
    const pct = g / max
    if (pct >= 0.7) return 'text-green-600'
    if (pct >= 0.5) return 'text-amber-600'
    return 'text-red-600'
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="bg-white dark:bg-slate-800 hover:bg-green-50 hover:text-green-700 hover:border-green-300 dark:hover:bg-green-900/30 dark:hover:text-green-300 dark:hover:border-green-700"
              onClick={() => navigate(classId ? `/admin/essays/turma/${classId}` : '/admin/essays')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Correção de Redação</h1>
          </div>

          {/* Grade + Progress */}
          <div className="flex items-center gap-4">
            {/* Progress indicator */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{progress.filled}/{progress.total}</span>
              <Progress value={progress.percent} className="w-20 h-2" />
            </div>

            {/* Grade display */}
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Nota</div>
              <div className={cn('text-2xl font-bold', getGradeColor(finalGrade, maxGrade))}>
                {correctionType === 'enem' ? finalGrade : finalGrade.toFixed(3)}
              </div>
              <div className="text-[10px] text-muted-foreground">/ {maxGrade}</div>
            </div>
          </div>
        </div>

        {/* Info card with template selector */}
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-6 flex-wrap">
              <div className="min-w-[120px]">
                <Label className="text-xs text-muted-foreground">Aluno</Label>
                <p className="text-sm font-medium">{studentName || '—'}</p>
              </div>
              <div className="min-w-[100px]">
                <Label className="text-xs text-muted-foreground">Turma</Label>
                <p className="text-sm font-medium">{className || '—'}</p>
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">Tema</Label>
                <p className="text-sm font-medium">{essay.essay_prompts?.title || 'Tema Livre'}</p>
              </div>
              <div className="min-w-[180px]">
                <Label className="text-xs text-muted-foreground">Modelo de Correção</Label>
                <Select value={template?.id || ''} onValueChange={handleTemplateChange}>
                  <SelectTrigger className="h-8 text-xs mt-0.5">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id!}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn(
                            'text-[9px] px-1',
                            t.correction_type === 'enem' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                          )}>
                            {(t.correction_type || 'ciaar').toUpperCase()}
                          </Badge>
                          {t.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[140px] text-right">
                <Label className="text-xs text-muted-foreground">Data de Envio</Label>
                <p className="text-sm font-medium">{submittedAt}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="bg-white dark:bg-slate-800 hover:bg-green-50 hover:text-green-700 hover:border-green-300 dark:hover:bg-green-900/30 dark:hover:text-green-300 dark:hover:border-green-700" onClick={() => document.getElementById('corrected-upload')?.click()} disabled={isUploading}>
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            {correctedFileUrl ? 'Reenviar Correção' : 'Enviar Correção'}
          </Button>
          <input id="corrected-upload" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUploadCorrected} />

          {fileUrl && !transcribedText && (
            <Button size="sm" variant="outline" className="bg-white dark:bg-slate-800 hover:bg-green-50 hover:text-green-700 hover:border-green-300 dark:hover:bg-green-900/30 dark:hover:text-green-300 dark:hover:border-green-700" onClick={handleTranscribe} disabled={isTranscribing}>
              {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ImageIcon className="h-4 w-4 mr-1" />}
              Transcrever
            </Button>
          )}

          <Button size="sm" variant="outline" className="bg-white dark:bg-slate-800 hover:bg-green-50 hover:text-green-700 hover:border-green-300 dark:hover:bg-green-900/30 dark:hover:text-green-300 dark:hover:border-green-700" onClick={handleAICorrection} disabled={isAILoading || !essayText}>
            {isAILoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {isAILoading ? 'Analisando...' : 'Correção IA'}
          </Button>

          <Button size="sm" variant="outline" className="bg-white dark:bg-slate-800 hover:bg-green-50 hover:text-green-700 hover:border-green-300 dark:hover:bg-green-900/30 dark:hover:text-green-300 dark:hover:border-green-700" onClick={handleGeneratePdf} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
            Gerar PDF
          </Button>

          <div className="flex-1" />

          <Button size="sm" variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar Rascunho
          </Button>

          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowFinalizeDialog(true)} disabled={isSaving}>
            <Send className="h-4 w-4 mr-1" /> Finalizar Correção
          </Button>
        </div>
      </div>

      {/* Main content: Essay + Correction Panel */}
      <div className="grid lg:grid-cols-5 gap-4 flex-grow overflow-hidden">
        {/* Left: Essay text or image */}
        <div className="lg:col-span-2 h-full flex flex-col overflow-hidden">
          <Card className="h-full flex flex-col">
            <CardHeader className="py-3 px-4 shrink-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Redação
                {transcribedText && <Badge variant="secondary" className="text-[10px]">Transcrita</Badge>}
                {essay.submission_text && fileUrl && (
                  <Badge variant="secondary" className="text-[10px]">Texto + Arquivo</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1">
              <CardContent className="px-4 pb-4 space-y-4">
                {essay.submission_text && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Texto digitado pelo aluno — clique para anotar</span>
                    </div>
                    <EssayTextAnnotator
                      originalText={essay.submission_text}
                      annotatedHtml={annotatedTextHtml}
                      onChange={setAnnotatedTextHtml}
                    />
                  </div>
                )}

                {transcribedText && transcribedText !== essay.submission_text && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Texto transcrito (IA)</span>
                    </div>
                    <div className="prose dark:prose-invert max-w-none text-sm whitespace-pre-wrap rounded-lg p-3 border">
                      {transcribedText}
                    </div>
                  </div>
                )}

                {fileUrl && (
                  <PdfAnnotationCanvas
                    fileUrl={fileUrl}
                    isImage={!!isImage}
                    annotationDataUrl={annotationImageUrl}
                    onSave={setAnnotationImageUrl}
                  />
                )}

                {correctedFileUrl && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Correção do professor (escaneada)</span>
                    </div>
                    {/\.(jpg|jpeg|png)$/i.test(correctedFileUrl) ? (
                      <img src={correctedFileUrl} alt="Correção escaneada" className="max-w-full h-auto rounded-lg border" />
                    ) : (
                      <iframe src={correctedFileUrl} className="w-full h-[500px] rounded-lg border" title="Correção PDF" />
                    )}
                  </div>
                )}

                {!essay.submission_text && !transcribedText && !fileUrl && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm italic">Nenhum texto disponível</p>
                  </div>
                )}

                <AudioFeedbackRecorder
                  audioUrl={feedbackAudioUrl}
                  onSave={(url) => setFeedbackAudioUrl(url)}
                  onUpload={async (blob) => {
                    const fileName = `audio-feedback/${submissionId}-${Date.now()}.webm`
                    const { error } = await supabase.storage
                      .from('essays')
                      .upload(fileName, blob, { upsert: true })
                    if (error) throw error
                    await supabase
                      .from('essays')
                      .update({ teacher_feedback_audio_url: fileName } as any)
                      .eq('id', submissionId)
                    const { data } = await supabase.storage
                      .from('essays')
                      .createSignedUrl(fileName, 3600)
                    return data?.signedUrl || fileName
                  }}
                  disabled={isSaving}
                />
              </CardContent>
            </ScrollArea>
          </Card>
        </div>

        {/* Right: Correction Panel */}
        <div className="lg:col-span-3 h-full overflow-hidden">
          {correctionType === 'enem' ? (
            // ==================== ENEM PANEL ====================
            <Card className="h-full flex flex-col">
              <CardHeader className="py-3 px-4 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge className="bg-blue-600 text-white text-[10px]">ENEM</Badge>
                      Competências
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {competencyScores.filter(c => c.score > 0).length}/{competencyScores.length} avaliadas · Total: {finalGrade}/{maxGrade}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <ScrollArea className="flex-1">
                <CardContent className="px-4 pb-4 space-y-4">
                  {/* Competency Score Cards */}
                  {competencyScores.map((comp, index) => {
                    const def = enemCompetencies?.find(c => c.number === comp.competency_number)
                    const levels = def?.levels || []
                    const scorePercent = comp.max_score > 0 ? (comp.score / comp.max_score) * 100 : 0

                    return (
                      <div key={index} className="border rounded-lg p-4 space-y-3 bg-card">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white',
                              scorePercent >= 70 ? 'bg-green-600' : scorePercent >= 40 ? 'bg-amber-500' : scorePercent > 0 ? 'bg-red-500' : 'bg-muted-foreground/30'
                            )}>
                              C{comp.competency_number}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{comp.competency_name}</p>
                              {def?.description && (
                                <p className="text-[10px] text-muted-foreground line-clamp-1">{def.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={cn(
                              'text-lg font-bold',
                              getGradeColor(comp.score, comp.max_score)
                            )}>
                              {comp.score}
                            </span>
                            <span className="text-xs text-muted-foreground">/{comp.max_score}</span>
                          </div>
                        </div>

                        {/* Score level selector */}
                        <div className="flex gap-1">
                          {levels.map((level) => (
                            <button
                              key={level.score}
                              onClick={() => updateCompetencyScore(index, 'score', level.score)}
                              className={cn(
                                'flex-1 py-1.5 px-1 rounded text-[10px] font-medium border transition-all',
                                comp.score === level.score
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                              )}
                              title={level.label}
                            >
                              {level.score}
                            </button>
                          ))}
                        </div>

                        {/* Selected level label */}
                        {comp.score > 0 && levels.length > 0 && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            {levels.find(l => l.score === comp.score)?.label || ''}
                          </p>
                        )}

                        {/* Progress bar */}
                        <Progress value={scorePercent} className={cn(
                          'h-1.5',
                          scorePercent >= 70 ? '[&>div]:bg-green-500' : scorePercent >= 40 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'
                        )} />

                        {/* Justification */}
                        <Textarea
                          value={comp.justification}
                          onChange={(e) => updateCompetencyScore(index, 'justification', e.target.value)}
                          rows={2}
                          placeholder="Justificativa da nota..."
                          className="text-xs"
                        />
                      </div>
                    )
                  })}

                  {competencyScores.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Selecione um template ENEM para começar</p>
                    </div>
                  )}

                  {/* Teacher feedback */}
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Comentários Gerais do Professor</label>
                    <Textarea
                      value={teacherFeedback}
                      onChange={(e) => setTeacherFeedback(e.target.value)}
                      rows={4}
                      placeholder="Observações gerais sobre a redação, dicas para o aluno..."
                      className="text-sm"
                    />
                  </div>

                  {/* Suggestions */}
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Sugestões de Melhoria
                      </label>
                      <Button size="sm" variant="outline" onClick={addSuggestion}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                      </Button>
                    </div>
                    {suggestions.map((suggestion, index) => (
                      <div key={index} className="border rounded-lg p-3 space-y-2 bg-card">
                        <div className="flex items-center justify-between">
                          <Select
                            value={suggestion.category}
                            onValueChange={(val) => updateSuggestion(index, 'category', val)}
                          >
                            <SelectTrigger className="h-6 w-[140px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="expression">Expressão</SelectItem>
                              <SelectItem value="structure">Estrutura</SelectItem>
                              <SelectItem value="content">Conteúdo</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSuggestion(index)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        <Textarea
                          value={suggestion.suggestion_text}
                          onChange={(e) => updateSuggestion(index, 'suggestion_text', e.target.value)}
                          rows={2}
                          className="text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </ScrollArea>
            </Card>
          ) : (
            // ==================== CIAAR PANEL ====================
            <Tabs defaultValue="expression" className="h-full flex flex-col">
              <TabsList className="w-full shrink-0 grid grid-cols-4">
                <TabsTrigger value="expression" className="text-xs gap-1.5 bg-white dark:bg-slate-800 data-[state=active]:bg-red-100 data-[state=active]:text-red-700 dark:data-[state=active]:bg-red-900/40 dark:data-[state=active]:text-red-300">
                  <PenLine className="h-3.5 w-3.5" />
                  Expressão
                  {expressionErrors.length > 0 && (
                    <Badge variant="destructive" className="text-[9px] px-1 py-0 ml-1">{expressionErrors.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="structure" className="text-xs gap-1.5 bg-white dark:bg-slate-800 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/40 dark:data-[state=active]:text-blue-300">
                  <BookOpen className="h-3.5 w-3.5" />
                  Estrutura
                </TabsTrigger>
                <TabsTrigger value="content" className="text-xs gap-1.5 bg-white dark:bg-slate-800 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 dark:data-[state=active]:bg-purple-900/40 dark:data-[state=active]:text-purple-300">
                  <FileText className="h-3.5 w-3.5" />
                  Conteúdo
                </TabsTrigger>
                <TabsTrigger value="suggestions" className="text-xs gap-1.5 bg-white dark:bg-slate-800 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700 dark:data-[state=active]:bg-amber-900/40 dark:data-[state=active]:text-amber-300">
                  <Lightbulb className="h-3.5 w-3.5" />
                  Sugestões
                </TabsTrigger>
              </TabsList>

              {/* Expression Errors Tab */}
              <TabsContent value="expression" className="flex-1 overflow-hidden mt-2">
                <Card className="h-full flex flex-col">
                  <CardHeader className="py-3 px-4 shrink-0 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">Erros de Expressão</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {expressionErrors.length} erros | Débito total: -{expressionDebitTotal.toFixed(3)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={addExpressionError}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                    </Button>
                  </CardHeader>
                  <ScrollArea className="flex-1">
                    <CardContent className="px-4 pb-4 space-y-3">
                      {expressionErrors.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm">Nenhum erro de expressão encontrado</p>
                          <p className="text-xs">Use "Correção IA" ou adicione manualmente</p>
                        </div>
                      ) : (
                        expressionErrors.map((error, index) => (
                          <div key={index} className="border rounded-lg p-3 space-y-2 bg-card">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <Label className="text-[10px]">P</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={error.paragraph_number}
                                    onChange={(e) => updateExpressionError(index, 'paragraph_number', parseInt(e.target.value) || 1)}
                                    className="h-6 w-14 text-xs px-1"
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <Label className="text-[10px]">Per.</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={error.sentence_number}
                                    onChange={(e) => updateExpressionError(index, 'sentence_number', parseInt(e.target.value) || 1)}
                                    className="h-6 w-14 text-xs px-1"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <Label className="text-[10px]">Débito</Label>
                                  <Input
                                    type="number"
                                    step="0.001"
                                    min={0}
                                    value={error.debit_value}
                                    onChange={(e) => updateExpressionError(index, 'debit_value', parseFloat(e.target.value) || 0)}
                                    className="h-6 w-20 text-xs px-1"
                                  />
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeExpressionError(index)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <div>
                                <label className="text-[10px] font-medium text-muted-foreground">Trecho com erro</label>
                                <Textarea
                                  value={error.error_text}
                                  onChange={(e) => updateExpressionError(index, 'error_text', e.target.value)}
                                  rows={1}
                                  className="text-xs min-h-[32px]"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-medium text-muted-foreground">Explicação</label>
                                <Textarea
                                  value={error.error_explanation}
                                  onChange={(e) => updateExpressionError(index, 'error_explanation', e.target.value)}
                                  rows={2}
                                  className="text-xs min-h-[48px]"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-medium text-muted-foreground">Correção sugerida</label>
                                <Textarea
                                  value={error.suggested_correction}
                                  onChange={(e) => updateExpressionError(index, 'suggested_correction', e.target.value)}
                                  rows={1}
                                  className="text-xs min-h-[32px]"
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </ScrollArea>
                </Card>
              </TabsContent>

              {/* Structure Analysis Tab */}
              <TabsContent value="structure" className="flex-1 overflow-hidden mt-2">
                <Card className="h-full flex flex-col">
                  <CardHeader className="py-3 px-4 shrink-0 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">Análise de Estrutura</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {structureAnalysis.length} parágrafos | Débito total: -{structureDebitTotal.toFixed(3)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={addStructureAnalysis}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Parágrafo
                    </Button>
                  </CardHeader>
                  <ScrollArea className="flex-1">
                    <CardContent className="px-4 pb-4 space-y-3">
                      {structureAnalysis.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm">Análise de estrutura pendente</p>
                          <p className="text-xs">Use "Correção IA" ou adicione manualmente</p>
                        </div>
                      ) : (
                        structureAnalysis.map((analysis, index) => (
                          <div key={index} className="border rounded-lg p-3 space-y-2 bg-card">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <Label className="text-[10px]">Parágrafo</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={analysis.paragraph_number}
                                    onChange={(e) => updateStructureAnalysis(index, 'paragraph_number', parseInt(e.target.value) || 1)}
                                    className="h-6 w-14 text-xs px-1"
                                  />
                                </div>
                                <Select
                                  value={analysis.paragraph_type}
                                  onValueChange={(val) => updateStructureAnalysis(index, 'paragraph_type', val)}
                                >
                                  <SelectTrigger className="h-6 w-[140px] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="introduction">Introdução</SelectItem>
                                    <SelectItem value="development">Desenvolvimento</SelectItem>
                                    <SelectItem value="conclusion">Conclusão</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <Label className="text-[10px]">Débito</Label>
                                  <Input
                                    type="number"
                                    step="0.001"
                                    min={0}
                                    value={analysis.debit_value}
                                    onChange={(e) => updateStructureAnalysis(index, 'debit_value', parseFloat(e.target.value) || 0)}
                                    className="h-6 w-20 text-xs px-1"
                                  />
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeStructureAnalysis(index)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground">Análise</label>
                              <Textarea
                                value={analysis.analysis_text}
                                onChange={(e) => updateStructureAnalysis(index, 'analysis_text', e.target.value)}
                                rows={3}
                                className="text-xs"
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </ScrollArea>
                </Card>
              </TabsContent>

              {/* Content Analysis Tab */}
              <TabsContent value="content" className="flex-1 overflow-hidden mt-2">
                <Card className="h-full flex flex-col">
                  <CardHeader className="py-3 px-4 shrink-0 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">Análise de Conteúdo</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {contentAnalysis.length} critérios | Débito total: -{contentDebitTotal.toFixed(3)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={addContentAnalysis}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Critério
                    </Button>
                  </CardHeader>
                  <ScrollArea className="flex-1">
                    <CardContent className="px-4 pb-4 space-y-3">
                      {contentAnalysis.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm">Análise de conteúdo pendente</p>
                          <p className="text-xs">Use "Correção IA" ou adicione manualmente</p>
                        </div>
                      ) : (
                        contentAnalysis.map((analysis, index) => (
                          <div key={index} className="border rounded-lg p-3 space-y-2 bg-card">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Select
                                  value={analysis.criterion_type}
                                  onValueChange={(val) => updateContentAnalysis(index, 'criterion_type', val)}
                                >
                                  <SelectTrigger className="h-6 w-[160px] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pertinence">Pertinência ao Tema</SelectItem>
                                    <SelectItem value="argumentation">Argumentação</SelectItem>
                                    <SelectItem value="informativity">Informatividade</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <Label className="text-[10px]">Nível</Label>
                                  <Input
                                    type="text"
                                    value={analysis.debit_level}
                                    onChange={(e) => updateContentAnalysis(index, 'debit_level', e.target.value)}
                                    className="h-6 w-24 text-xs px-1"
                                    placeholder="Sem débito"
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <Label className="text-[10px]">Débito</Label>
                                  <Input
                                    type="number"
                                    step="0.001"
                                    min={0}
                                    value={analysis.debit_value}
                                    onChange={(e) => updateContentAnalysis(index, 'debit_value', parseFloat(e.target.value) || 0)}
                                    className="h-6 w-20 text-xs px-1"
                                  />
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeContentAnalysis(index)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>

                            {analysis.debit_level === 'Fuga TOTAL' && (
                              <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-md px-3 py-1.5">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-xs font-medium">Fuga total: nota final automaticamente 0</span>
                              </div>
                            )}

                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground">Análise</label>
                              <Textarea
                                value={analysis.analysis_text}
                                onChange={(e) => updateContentAnalysis(index, 'analysis_text', e.target.value)}
                                rows={3}
                                className="text-xs"
                              />
                            </div>
                          </div>
                        ))
                      )}

                      {/* Teacher feedback at the end of Content tab */}
                      <Separator className="my-4" />
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Comentários Gerais do Professor</label>
                        <Textarea
                          value={teacherFeedback}
                          onChange={(e) => setTeacherFeedback(e.target.value)}
                          rows={4}
                          placeholder="Observações gerais sobre a redação, dicas para o aluno..."
                          className="text-sm"
                        />
                      </div>
                    </CardContent>
                  </ScrollArea>
                </Card>
              </TabsContent>

              {/* Suggestions Tab */}
              <TabsContent value="suggestions" className="flex-1 overflow-hidden mt-2">
                <Card className="h-full flex flex-col">
                  <CardHeader className="py-3 px-4 shrink-0 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">Sugestões de Melhoria</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {suggestions.length} sugestões para o aluno
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={addSuggestion}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Sugestão
                    </Button>
                  </CardHeader>
                  <ScrollArea className="flex-1">
                    <CardContent className="px-4 pb-4 space-y-3">
                      {suggestions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm">Nenhuma sugestão ainda</p>
                          <p className="text-xs">Use "Correção IA" ou adicione manualmente</p>
                        </div>
                      ) : (
                        suggestions.map((suggestion, index) => (
                          <div key={index} className="border rounded-lg p-3 space-y-2 bg-card">
                            <div className="flex items-center justify-between">
                              <Select
                                value={suggestion.category}
                                onValueChange={(val) => updateSuggestion(index, 'category', val)}
                              >
                                <SelectTrigger className="h-6 w-[140px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="expression">Expressão</SelectItem>
                                  <SelectItem value="structure">Estrutura</SelectItem>
                                  <SelectItem value="content">Conteúdo</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSuggestion(index)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground">Sugestão</label>
                              <Textarea
                                value={suggestion.suggestion_text}
                                onChange={(e) => updateSuggestion(index, 'suggestion_text', e.target.value)}
                                rows={3}
                                className="text-xs"
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </ScrollArea>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* Bottom: Grade summary */}
      <div className="shrink-0 border-t pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {correctionType === 'enem' ? (
              // ENEM: show competency badges
              competencyScores.map((c) => (
                <Badge key={c.competency_number} variant="outline" className={cn(
                  'gap-1 py-1',
                  c.score >= 160 ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' :
                  c.score >= 80 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' :
                  'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                )}>
                  C{c.competency_number}: {c.score}
                </Badge>
              ))
            ) : (
              // CIAAR: show debit badges
              <>
                <Badge variant="outline" className="gap-1.5 py-1 bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                  <PenLine className="h-3 w-3" />
                  Expressão: -{expressionDebitTotal.toFixed(3)} ({expressionErrors.length})
                </Badge>
                <Badge variant="outline" className="gap-1.5 py-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                  <BookOpen className="h-3 w-3" />
                  Estrutura: -{structureDebitTotal.toFixed(3)}
                </Badge>
                <Badge variant="outline" className="gap-1.5 py-1 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800">
                  <FileText className="h-3 w-3" />
                  Conteúdo: -{contentDebitTotal.toFixed(3)}
                </Badge>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Nota Final</span>
            <span className={cn('text-2xl font-bold', getGradeColor(finalGrade, maxGrade))}>
              {correctionType === 'enem' ? finalGrade : finalGrade.toFixed(3)}
            </span>
            <span className="text-xs text-muted-foreground">/ {maxGrade}</span>
          </div>
        </div>
      </div>

      {/* Finalize Confirmation Dialog */}
      <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Correção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja finalizar a correção? O aluno será notificado e a nota será registrada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalizeCorrection} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
