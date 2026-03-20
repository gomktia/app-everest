import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageTabs } from '@/components/PageTabs'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft,
  FileDown,
  FileText,
  PenLine,
  BookOpen,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Mic,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import {
  getStudentEssayDetails,
  type StudentEssayDetails,
} from '@/services/essayService'
import { ciaarCorrectionService } from '@/services/ciaarCorrectionService'
import { SectionLoader } from '@/components/SectionLoader'
import { cn } from '@/lib/utils'
import type { CorrectionResult, CorrectionType } from '@/types/essay-correction'

function CiaarCorrectionTabs({ correction, expressionDebit, structureDebit, contentDebit }: {
  correction: CorrectionResult
  expressionDebit: number
  structureDebit: number
  contentDebit: number
}) {
  const [tab, setTab] = useState('expression')

  return (
    <PageTabs
      value={tab}
      onChange={setTab}
      layout={4}
      tabs={[
        {
          value: 'expression',
          label: 'Expressão',
          icon: <PenLine className="h-3.5 w-3.5" />,
          count: correction.expressionErrors.length > 0 ? correction.expressionErrors.length : undefined,
          content: (
            <Card>
              <CardHeader className="py-4 px-5">
                <CardTitle className="text-base">Erros de Expressão</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {correction.expressionErrors.length} erros encontrados · Débito: -{expressionDebit.toFixed(3)}
                </p>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                {correction.expressionErrors.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="text-sm font-medium">Nenhum erro de expressão!</p>
                  </div>
                ) : (
                  correction.expressionErrors.map((error, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px]">
                          P{error.paragraph_number}, Per. {error.sentence_number}
                        </Badge>
                        <Badge variant="destructive" className="text-[10px]">
                          -{error.debit_value.toFixed(3)}
                        </Badge>
                      </div>
                      <div className="bg-red-50 dark:bg-red-950/50 rounded-md px-3 py-2">
                        <span className="text-xs text-red-700 dark:text-red-400 line-through">{error.error_text}</span>
                      </div>
                      <div className="bg-green-50 dark:bg-green-950/50 rounded-md px-3 py-2">
                        <span className="text-xs text-green-700 dark:text-green-400">{error.suggested_correction}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{error.error_explanation}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ),
        },
        {
          value: 'structure',
          label: 'Estrutura',
          icon: <BookOpen className="h-3.5 w-3.5" />,
          content: (
            <Card>
              <CardHeader className="py-4 px-5">
                <CardTitle className="text-base">Análise de Estrutura</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {correction.structureAnalysis.length} parágrafos analisados · Débito: -{structureDebit.toFixed(3)}
                </p>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                {correction.structureAnalysis.map((analysis, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          Parágrafo {analysis.paragraph_number}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {analysis.paragraph_type === 'introduction' ? 'Introdução' :
                            analysis.paragraph_type === 'conclusion' ? 'Conclusão' :
                              'Desenvolvimento'}
                        </Badge>
                      </div>
                      <Badge
                        variant={analysis.debit_value > 0 ? 'destructive' : 'outline'}
                        className={cn('text-[10px]', analysis.debit_value === 0 && 'text-green-600 border-green-300 dark:border-green-800')}
                      >
                        {analysis.debit_value > 0 ? `-${analysis.debit_value.toFixed(3)}` : 'OK'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{analysis.analysis_text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ),
        },
        {
          value: 'content',
          label: 'Conteúdo',
          icon: <BarChart3 className="h-3.5 w-3.5" />,
          content: (
            <Card>
              <CardHeader className="py-4 px-5">
                <CardTitle className="text-base">Análise de Conteúdo</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {correction.contentAnalysis.length} critérios · Débito: -{contentDebit.toFixed(3)}
                </p>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                {correction.contentAnalysis.map((analysis, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{analysis.criterion_name}</span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={analysis.debit_level === 'Fuga TOTAL' ? 'destructive' : 'outline'}
                          className="text-[10px]"
                        >
                          {analysis.debit_level}
                        </Badge>
                        <Badge
                          variant={analysis.debit_value > 0 ? 'destructive' : 'outline'}
                          className={cn('text-[10px]', analysis.debit_value === 0 && 'text-green-600 border-green-300 dark:border-green-800')}
                        >
                          {analysis.debit_value > 0 ? `-${analysis.debit_value.toFixed(3)}` : 'Sem débito'}
                        </Badge>
                      </div>
                    </div>
                    {analysis.debit_level === 'Fuga TOTAL' && (
                      <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-950/50 rounded-md px-3 py-1.5">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-xs font-medium">Fuga total: nota final zerada</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{analysis.analysis_text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ),
        },
        {
          value: 'suggestions',
          label: 'Sugestões',
          icon: <Lightbulb className="h-3.5 w-3.5" />,
          content: (
            <Card>
              <CardHeader className="py-4 px-5">
                <CardTitle className="text-base">Sugestões de Melhoria</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {correction.improvementSuggestions.length} sugestões para melhorar sua redação
                </p>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                {correction.improvementSuggestions.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhuma sugestão disponível</p>
                  </div>
                ) : (
                  correction.improvementSuggestions.map((suggestion, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {suggestion.category === 'expression' ? 'Expressão' :
                          suggestion.category === 'structure' ? 'Estrutura' : 'Conteúdo'}
                      </Badge>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{suggestion.suggestion_text}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ),
        },
      ]}
    />
  )
}

export default function EssayDetailsPage() {
  const { essayId } = useParams<{ essayId: string }>()
  const [essay, setEssay] = useState<StudentEssayDetails | null>(null)
  const [correction, setCorrection] = useState<CorrectionResult | null>(null)
  const [correctedFileUrl, setCorrectedFileUrl] = useState<string | null>(null)
  const [feedbackAudioUrl, setFeedbackAudioUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!essayId) return
    const load = async () => {
      try {
        const [essayData, correctionData] = await Promise.all([
          getStudentEssayDetails(essayId),
          ciaarCorrectionService.loadCorrection(essayId),
        ])
        setEssay(essayData)
        setCorrection(correctionData)

        if ((essayData as any)?.corrected_file_url) {
          const { data } = await supabase.storage
            .from('essays')
            .createSignedUrl((essayData as any).corrected_file_url, 3600)
          if (data?.signedUrl) setCorrectedFileUrl(data.signedUrl)
        }
        if ((essayData as any)?.teacher_feedback_audio_url) {
          const { data } = await supabase.storage
            .from('essays')
            .createSignedUrl((essayData as any).teacher_feedback_audio_url, 3600)
          if (data?.signedUrl) setFeedbackAudioUrl(data.signedUrl)
        }
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [essayId])

  if (isLoading) return <SectionLoader />

  if (!essay) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Redação não encontrada</h1>
        <Button asChild>
          <Link to="/redacoes"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
        </Button>
      </div>
    )
  }

  const isCorrected = (essay as any).status === 'corrected'
  const submissionDate = (essay as any).submission_date || (essay as any).created_at
  const formattedDate = submissionDate ? new Date(submissionDate).toLocaleDateString('pt-BR') : '—'
  const submissionText = (essay as any).submission_text || ''
  const wordCount = submissionText.trim() ? submissionText.trim().split(/\s+/).length : 0
  const promptTitle = (essay as any).essay_prompts?.title || 'Redação'
  const teacherFeedback = (essay as any).teacher_feedback_text || ''
  const annotatedTextHtml = (essay as any).annotated_text_html || ''
  const annotationImageUrl = (essay as any).annotation_image_url || ''

  // Detect correction type
  const correctionType: CorrectionType = correction?.correctionType || ((essay as any).correction_type as CorrectionType) || 'ciaar'
  const isEnem = correctionType === 'enem'

  // Grade data
  const finalGrade = isEnem
    ? (correction?.finalGrade ?? (essay as any).final_grade_enem ?? 0)
    : (correction?.finalGrade ?? (essay as any).final_grade_ciaar ?? 0)
  const maxGrade = isEnem ? 1000 : 10
  const expressionDebit = correction?.totalExpressionDebit ?? 0
  const structureDebit = correction?.totalStructureDebit ?? 0
  const contentDebit = correction?.totalContentDebit ?? 0
  const hasFugaTotal = correction?.contentAnalysis.some(c => c.debit_level === 'Fuga TOTAL') ?? false

  const getGradeColor = (g: number, max: number) => {
    const pct = g / max
    if (pct >= 0.7) return 'text-green-600'
    if (pct >= 0.5) return 'text-amber-600'
    return 'text-red-600'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/redacoes"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{promptTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enviada em {formattedDate} · {wordCount} palavras
            {isEnem && <Badge className="ml-2 bg-blue-600 text-white text-[10px]">ENEM</Badge>}
          </p>
        </div>
        <Button
          variant="outline"
          asChild
          className="gap-2"
        >
          <Link to={`/redacoes/${essayId}/report`} target="_blank">
            <FileDown className="h-4 w-4" />
            Relatório PDF
          </Link>
        </Button>
      </div>

      {/* Grade Card */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            {/* Grade */}
            <div className="text-center shrink-0">
              <div className={cn('text-5xl font-bold', getGradeColor(finalGrade, maxGrade))}>
                {isEnem ? finalGrade : finalGrade.toFixed(3)}
              </div>
              <div className="text-sm text-muted-foreground">de {maxGrade}</div>
            </div>

            {/* Status + breakdown */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    isCorrected
                      ? 'bg-green-100 dark:bg-green-950/50 text-green-600 border-green-300 dark:border-green-800'
                      : 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-600 border-yellow-300 dark:border-yellow-800',
                  )}
                >
                  {isCorrected ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                  {isCorrected ? 'Corrigida' : 'Em Correção'}
                </Badge>
                {hasFugaTotal && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Fuga Total
                  </Badge>
                )}
              </div>

              {/* ENEM: Competency bars */}
              {isEnem && correction?.competencyScores && correction.competencyScores.length > 0 && (
                <div className="space-y-2">
                  {correction.competencyScores.map((comp) => {
                    const pct = comp.max_score > 0 ? (comp.score / comp.max_score) * 100 : 0
                    return (
                      <div key={comp.competency_number} className="space-y-0.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground truncate mr-2">C{comp.competency_number} - {comp.competency_name}</span>
                          <span className={cn('font-bold', getGradeColor(comp.score, comp.max_score))}>{comp.score}/{comp.max_score}</span>
                        </div>
                        <Progress value={pct} className={cn(
                          'h-2',
                          pct >= 70 ? '[&>div]:bg-green-500' : pct >= 40 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'
                        )} />
                      </div>
                    )
                  })}
                </div>
              )}

              {/* CIAAR: Debit bars */}
              {!isEnem && correction && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border p-2.5">
                    <div className="text-[10px] text-muted-foreground">Expressão</div>
                    <div className="text-sm font-bold text-red-600">-{expressionDebit.toFixed(3)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {correction.expressionErrors.length} erros
                    </div>
                  </div>
                  <div className="rounded-lg border p-2.5">
                    <div className="text-[10px] text-muted-foreground">Estrutura</div>
                    <div className="text-sm font-bold text-red-600">-{structureDebit.toFixed(3)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {correction.structureAnalysis.length} parágrafos
                    </div>
                  </div>
                  <div className="rounded-lg border p-2.5">
                    <div className="text-[10px] text-muted-foreground">Conteúdo</div>
                    <div className="text-sm font-bold text-red-600">-{contentDebit.toFixed(3)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {correction.contentAnalysis.length} critérios
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teacher feedback (visible for both types) */}
      {(teacherFeedback || feedbackAudioUrl) && (
        <Card className="border-border shadow-sm border-l-4 border-l-emerald-500">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Comentários do Professor
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {teacherFeedback && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3">
                {teacherFeedback}
              </p>
            )}
            {feedbackAudioUrl && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Feedback em Áudio
                </h4>
                <audio controls src={feedbackAudioUrl} className="w-full rounded-lg" preload="metadata">
                  <source src={feedbackAudioUrl} type="audio/webm" />
                  <source src={feedbackAudioUrl} type="audio/ogg" />
                  <source src={feedbackAudioUrl} type="audio/mp4" />
                  Seu navegador não suporta o player de áudio.
                </audio>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Teacher's corrected file (scanned) */}
      {correctedFileUrl && (
        <Card className="border-emerald-200 dark:border-emerald-800/30 shadow-sm">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Correção do Professor
            </CardTitle>
            <p className="text-xs text-muted-foreground">Redação corrigida à mão pelo professor</p>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {/\.(jpg|jpeg|png)$/i.test(correctedFileUrl) ? (
              <img src={correctedFileUrl} alt="Correção do professor" className="max-w-full h-auto rounded-lg border" />
            ) : (
              <iframe src={correctedFileUrl} className="w-full h-[600px] rounded-lg border" title="Correção PDF" />
            )}
          </CardContent>
        </Card>
      )}

      {/* ENEM: Competency Details */}
      {isEnem && correction?.competencyScores && correction.competencyScores.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Detalhamento por Competência
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            {correction.competencyScores.map((comp) => {
              const pct = comp.max_score > 0 ? (comp.score / comp.max_score) * 100 : 0
              return (
                <div key={comp.competency_number} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white',
                        pct >= 70 ? 'bg-green-600' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
                      )}>
                        C{comp.competency_number}
                      </div>
                      <span className="text-sm font-medium">{comp.competency_name}</span>
                    </div>
                    <div className="text-right">
                      <span className={cn('text-lg font-bold', getGradeColor(comp.score, comp.max_score))}>
                        {comp.score}
                      </span>
                      <span className="text-xs text-muted-foreground">/{comp.max_score}</span>
                    </div>
                  </div>
                  <Progress value={pct} className={cn(
                    'h-2',
                    pct >= 70 ? '[&>div]:bg-green-500' : pct >= 40 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'
                  )} />
                  {comp.justification && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{comp.justification}</p>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* CIAAR: Correction Details Tabs */}
      {!isEnem && correction && (
        <CiaarCorrectionTabs
          correction={correction}
          expressionDebit={expressionDebit}
          structureDebit={structureDebit}
          contentDebit={contentDebit}
        />
      )}

      {/* ENEM: Suggestions (outside tabs) */}
      {isEnem && correction?.improvementSuggestions && correction.improvementSuggestions.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Sugestões de Melhoria
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {correction.improvementSuggestions.map((suggestion, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-2">
                <Badge variant="secondary" className="text-[10px]">
                  {suggestion.category === 'expression' ? 'Expressão' :
                    suggestion.category === 'structure' ? 'Estrutura' : 'Conteúdo'}
                </Badge>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{suggestion.suggestion_text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Annotated text from teacher (if available) */}
      {annotatedTextHtml && (
        <Card className="border-border shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <PenLine className="h-4 w-4 text-blue-500" />
              Sua Redação — Anotações do Professor
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div
              className="prose dark:prose-invert max-w-none text-sm [&_mark]:rounded [&_mark]:px-0.5"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(annotatedTextHtml) }}
            />
          </CardContent>
        </Card>
      )}

      {/* Teacher's annotation on the document image */}
      {annotationImageUrl && (
        <Card className="border-border shadow-sm border-l-4 border-l-purple-500">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-purple-500" />
              Correção no Documento
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <img src={annotationImageUrl} alt="Documento com anotações do professor" className="max-w-full h-auto rounded-lg border" />
          </CardContent>
        </Card>
      )}

      {/* If no correction data yet, show essay text */}
      {!correction && !annotatedTextHtml && (
        <Card className="border-border shadow-sm">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Sua Redação
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="prose dark:prose-invert max-w-none text-sm whitespace-pre-wrap">
              {submissionText || <span className="text-muted-foreground italic">Texto não disponível</span>}
            </div>
            {!isCorrected && (
              <div className="mt-4 flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/50 rounded-md px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="text-sm">Sua redação está em processo de correção. Você será notificado quando estiver pronta.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
