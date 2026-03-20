import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Printer, ArrowLeft, FileText, PenLine, BookOpen, BarChart3, Lightbulb, AlertTriangle, CheckCircle } from 'lucide-react'
import {
  getStudentEssayDetails,
  type StudentEssayDetails,
} from '@/services/essayService'
import { ciaarCorrectionService } from '@/services/ciaarCorrectionService'
import { SectionLoader } from '@/components/SectionLoader'
import { cn } from '@/lib/utils'
import type { CorrectionResult, CorrectionType } from '@/types/essay-correction'
import { Progress } from '@/components/ui/progress'

export default function EssayReportPage() {
  const { essayId } = useParams<{ essayId: string }>()
  const [essay, setEssay] = useState<StudentEssayDetails | null>(null)
  const [correction, setCorrection] = useState<CorrectionResult | null>(null)
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
        <h1 className="text-2xl font-bold text-foreground">Relatório não encontrado</h1>
        <Button asChild>
          <Link to="/redacoes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>
    )
  }

  const data = essay as any
  const correctionType: CorrectionType = correction?.correctionType || (data.correction_type as CorrectionType) || 'ciaar'
  const isEnem = correctionType === 'enem'
  const finalGrade = isEnem
    ? (correction?.finalGrade ?? data.final_grade_enem ?? 0)
    : (correction?.finalGrade ?? data.final_grade_ciaar ?? 0)
  const maxGrade = isEnem ? 1000 : 10
  const expressionDebit = correction?.totalExpressionDebit ?? 0
  const structureDebit = correction?.totalStructureDebit ?? 0
  const contentDebit = correction?.totalContentDebit ?? 0
  const promptTitle = data.essay_prompts?.title || 'Redação'
  const submissionText = data.submission_text || ''
  const submissionDate = data.submission_date || data.created_at
  const formattedDate = submissionDate ? new Date(submissionDate).toLocaleDateString('pt-BR') : '—'
  const hasFugaTotal = correction?.contentAnalysis.some(c => c.debit_level === 'Fuga TOTAL') ?? false

  const getGradeColor = (g: number, max: number) => {
    const pct = g / max
    if (pct >= 0.7) return 'text-green-600'
    if (pct >= 0.5) return 'text-amber-600'
    return 'text-red-600'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 print:space-y-4 print:max-w-none print:mx-0">
      {/* Header - hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <Link
            to={`/redacoes/${essayId}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Relatório de Correção</h1>
        </div>
        <Button onClick={() => window.print()} variant="outline" className="gap-2">
          <Printer className="h-4 w-4" />
          Imprimir / Salvar PDF
        </Button>
      </div>

      {/* Print header */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold">Relatório de Correção — Everest Preparatórios</h1>
      </div>

      {/* Title + Grade */}
      <Card className="border-border shadow-sm print:shadow-none print:border">
        <CardContent className="p-6 print:p-4">
          <div className="flex items-center gap-6">
            <div className="text-center shrink-0">
              <div className={cn('text-5xl font-bold print:text-3xl', getGradeColor(finalGrade, maxGrade))}>
                {isEnem ? finalGrade : finalGrade.toFixed(3)}
              </div>
              <div className="text-sm text-muted-foreground">de {maxGrade}</div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground print:text-lg">{promptTitle}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Enviada em {formattedDate}
                {isEnem && <Badge className="ml-2 bg-blue-600 text-white text-[10px]">ENEM</Badge>}
              </p>
              {hasFugaTotal && (
                <Badge variant="destructive" className="mt-2 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Fuga Total — Nota Zerada
                </Badge>
              )}
            </div>
          </div>

          {/* CIAAR debit summary */}
          {!isEnem && correction && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="rounded-lg border p-2.5 text-center">
                <div className="text-[10px] text-muted-foreground">Expressão</div>
                <div className="text-sm font-bold text-red-600">-{expressionDebit.toFixed(3)}</div>
                <div className="text-[10px] text-muted-foreground">{correction.expressionErrors.length} erros</div>
              </div>
              <div className="rounded-lg border p-2.5 text-center">
                <div className="text-[10px] text-muted-foreground">Estrutura</div>
                <div className="text-sm font-bold text-red-600">-{structureDebit.toFixed(3)}</div>
              </div>
              <div className="rounded-lg border p-2.5 text-center">
                <div className="text-[10px] text-muted-foreground">Conteúdo</div>
                <div className="text-sm font-bold text-red-600">-{contentDebit.toFixed(3)}</div>
              </div>
            </div>
          )}

          {/* ENEM competency bars */}
          {isEnem && correction?.competencyScores && correction.competencyScores.length > 0 && (
            <div className="space-y-2 mt-4">
              {correction.competencyScores.map((comp) => {
                const pct = comp.max_score > 0 ? (comp.score / comp.max_score) * 100 : 0
                return (
                  <div key={comp.competency_number} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">C{comp.competency_number} - {comp.competency_name}</span>
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
        </CardContent>
      </Card>

      {/* Essay Text */}
      <Card className="border-border shadow-sm print:shadow-none print:border">
        <CardHeader className="py-4 px-5">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Redação
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
            {submissionText || <span className="text-muted-foreground italic">Texto não disponível</span>}
          </div>
        </CardContent>
      </Card>

      {/* CIAAR: Expression Errors */}
      {!isEnem && correction && correction.expressionErrors.length > 0 && (
        <Card className="border-border shadow-sm print:shadow-none print:border print:break-inside-avoid">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <PenLine className="h-4 w-4 text-red-500" />
              1 — Erros de Expressão
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {correction.expressionErrors.length} erros · Débito: -{expressionDebit.toFixed(3)}
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {correction.expressionErrors.map((error, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-1.5 print:break-inside-avoid">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">
                    P{error.paragraph_number}, Per. {error.sentence_number}
                  </Badge>
                  <Badge variant="destructive" className="text-[10px]">-{error.debit_value.toFixed(3)}</Badge>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="text-red-600 line-through">{error.error_text}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-green-600">{error.suggested_correction}</span>
                </div>
                <p className="text-xs text-muted-foreground">{error.error_explanation}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* CIAAR: Structure Analysis */}
      {!isEnem && correction && correction.structureAnalysis.length > 0 && (
        <Card className="border-border shadow-sm print:shadow-none print:border print:break-inside-avoid">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              2 — Análise de Estrutura
            </CardTitle>
            <p className="text-xs text-muted-foreground">Débito: -{structureDebit.toFixed(3)}</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {correction.structureAnalysis.map((analysis, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-1.5 print:break-inside-avoid">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">Parágrafo {analysis.paragraph_number}</Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {analysis.paragraph_type === 'introduction' ? 'Introdução' :
                        analysis.paragraph_type === 'conclusion' ? 'Conclusão' : 'Desenvolvimento'}
                    </Badge>
                  </div>
                  <Badge
                    variant={analysis.debit_value > 0 ? 'destructive' : 'outline'}
                    className={cn('text-[10px]', analysis.debit_value === 0 && 'text-green-600 border-green-300')}
                  >
                    {analysis.debit_value > 0 ? `-${analysis.debit_value.toFixed(3)}` : 'OK'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{analysis.analysis_text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* CIAAR: Content Analysis */}
      {!isEnem && correction && correction.contentAnalysis.length > 0 && (
        <Card className="border-border shadow-sm print:shadow-none print:border print:break-inside-avoid">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-orange-500" />
              3 — Análise de Conteúdo
            </CardTitle>
            <p className="text-xs text-muted-foreground">Débito: -{contentDebit.toFixed(3)}</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {correction.contentAnalysis.map((analysis, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-1.5 print:break-inside-avoid">
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
                      className={cn('text-[10px]', analysis.debit_value === 0 && 'text-green-600 border-green-300')}
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
      )}

      {/* Grade Summary Table */}
      {correction && (
        <Card className="border-border shadow-sm print:shadow-none print:border print:break-inside-avoid">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-base">Cálculo Final da Nota</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Critério</th>
                  <th className="text-right py-2 font-medium">Débito</th>
                </tr>
              </thead>
              <tbody>
                {!isEnem && (
                  <>
                    <tr className="border-b">
                      <td className="py-2 text-muted-foreground">Erros de Expressão ({correction.expressionErrors.length} erros × -0,200)</td>
                      <td className="py-2 text-right text-red-600 font-medium">-{expressionDebit.toFixed(3)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-muted-foreground">Erros de Estrutura</td>
                      <td className="py-2 text-right text-red-600 font-medium">-{structureDebit.toFixed(3)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-muted-foreground">Erros de Conteúdo</td>
                      <td className="py-2 text-right text-red-600 font-medium">-{contentDebit.toFixed(3)}</td>
                    </tr>
                  </>
                )}
                <tr className="font-bold text-base">
                  <td className="py-3">Nota Final</td>
                  <td className={cn('py-3 text-right', getGradeColor(finalGrade, maxGrade))}>
                    {isEnem ? finalGrade : finalGrade.toFixed(3)}
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      {correction && correction.improvementSuggestions.length > 0 && (
        <Card className="border-border shadow-sm print:shadow-none print:border print:break-inside-avoid">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Sugestões de Melhoria
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {correction.improvementSuggestions.map((suggestion, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-1.5 print:break-inside-avoid">
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

      {/* Teacher feedback */}
      {data.teacher_feedback_text && (
        <Card className="border-border shadow-sm print:shadow-none print:border print:break-inside-avoid">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Feedback do Professor
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {data.teacher_feedback_text}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Print footer */}
      <div className="hidden print:block text-center text-xs text-muted-foreground mt-8 pt-4 border-t">
        Relatório gerado pela plataforma Everest Preparatórios — {new Date().toLocaleDateString('pt-BR')}
      </div>
    </div>
  )
}
