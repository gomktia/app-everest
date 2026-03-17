import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Eye } from 'lucide-react'
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  getQuizReport,
  type QuizReport,
  type StudentAttempt,
} from '@/services/adminQuizService'
import { SectionLoader } from '@/components/SectionLoader'
import { AttemptDetailsDialog } from '@/components/admin/quizzes/AttemptDetailsDialog'

export default function AdminQuizReportsPage() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  usePageTitle('Relatório do Quiz')
  const [report, setReport] = useState<QuizReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAttempt, setSelectedAttempt] = useState<StudentAttempt | null>(
    null,
  )
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  useEffect(() => {
    if (quizId) {
      setIsLoading(true)
      getQuizReport(quizId)
        .then(setReport)
        .finally(() => setIsLoading(false))
    }
  }, [quizId])

  const handleViewDetails = (attempt: StudentAttempt) => {
    setSelectedAttempt(attempt)
    setIsDetailsOpen(true)
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  }

  if (isLoading) {
    return <SectionLoader />
  }

  if (!report) {
    return <div>Relatório não encontrado.</div>
  }

  return (
    <>
      <AttemptDetailsDialog
        isOpen={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        attempt={selectedAttempt}
      />
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigate(`/admin/quizzes`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Relatório de Desempenho</h1>
            <p className="text-muted-foreground">{report.quiz_title}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total de Tentativas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{report.total_attempts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pontuação Média</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">
                {report.average_score_percentage.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Duração Média</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">
                {formatDuration(report.average_duration_seconds)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Desempenho por Questão</CardTitle>
            <CardDescription>
              Número de respostas corretas e incorretas para cada questão.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-96 w-full">
              <BarChart
                data={report.question_performance}
                layout="vertical"
                margin={{ left: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis
                  dataKey="question_text"
                  type="category"
                  width={150}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) =>
                    value.length > 20 ? `${value.substring(0, 20)}...` : value
                  }
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="correct_answers"
                  name="Corretas"
                  stackId="a"
                  fill="hsl(var(--chart-2))"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey="incorrect_answers"
                  name="Incorretas"
                  stackId="a"
                  fill="hsl(var(--chart-4))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tentativas dos Alunos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Pontuação</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.student_attempts.map((attempt) => (
                  <TableRow key={attempt.attempt_id}>
                    <TableCell className="font-medium">
                      {attempt.user_name}
                    </TableCell>
                    <TableCell>
                      {attempt.score}/{attempt.total_questions}
                    </TableCell>
                    <TableCell>
                      {formatDuration(attempt.duration_seconds || 0)}
                    </TableCell>
                    <TableCell>
                      {new Date(attempt.attempt_date).toLocaleDateString(
                        'pt-BR',
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(attempt)}
                      >
                        <Eye className="mr-2 h-4 w-4" /> Ver Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
