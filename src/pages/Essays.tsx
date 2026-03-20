import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  FilePlus2,
  Eye,
  TrendingUp,
  FileText,
  Calendar,
  Clock,
  Lock,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import {
  getUserEssaysList,
  getUserEssayStats,
  type EssayListItem,
  type EssayStatsData,
} from '@/services/essayService'
import { useAuth } from '@/hooks/use-auth'
import { SectionLoader } from '@/components/SectionLoader'
import { useContentAccess } from '@/hooks/useContentAccess'
import { useFeaturePermissions } from '@/hooks/use-feature-permissions'
import { FEATURE_KEYS } from '@/services/classPermissionsService'
import { logger } from '@/lib/logger'

export default function EssaysPage() {
  const { user, isStudent } = useAuth()
  const { hasFeature, loading: permissionsLoading } = useFeaturePermissions()
  const { isRestricted: essayRestricted, allowedIds: essayAllowedIds } = useContentAccess('essay_limit')
  const [essays, setEssays] = useState<EssayListItem[]>([])
  const [stats, setStats] = useState<EssayStatsData>({
    totalEssays: 0,
    averageGrade: 0,
    averageDays: 0,
    pending: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchEssays = async () => {
      try {
        if (!user?.id) return
        const [essaysData, statsData] = await Promise.all([
          getUserEssaysList(user.id),
          getUserEssayStats(user.id),
        ])
        setEssays(essaysData)
        setStats(statsData)
      } catch (error) {
        logger.error('Error fetching essays:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchEssays()
  }, [user?.id])

  if (permissionsLoading || isLoading) {
    return <SectionLoader />
  }

  if (isStudent && !hasFeature(FEATURE_KEYS.ESSAYS)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Redações</h1>
          <p className="text-sm text-muted-foreground mt-1">Recurso bloqueado</p>
        </div>
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Recurso Bloqueado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              O sistema de redações não está disponível para sua turma. Entre em contato com seu
              professor ou administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Essay limit enforcement
  const essayLimit = isStudent && essayRestricted ? parseInt(essayAllowedIds[0] || '0') : Infinity
  const nonDraftCount = essays.filter((e) => e.status !== 'Rascunho').length
  const essayLimitReached = isStudent && essayRestricted && nonDraftCount >= essayLimit

  const correctedCount = essays.filter((e) => e.status === 'Corrigida').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Minhas Redações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envie suas redações e acompanhe correções e notas
          </p>
        </div>
        {essayLimitReached ? (
          <div className="flex flex-col items-end gap-1">
            <Button disabled className="gap-2 w-fit opacity-50 cursor-not-allowed">
              <Lock className="h-4 w-4" />
              Enviar Nova Redação
            </Button>
            <span className="text-xs text-muted-foreground">
              Você atingiu o limite de {essayLimit} redação(ões) para esta turma
            </span>
          </div>
        ) : (
          <Button asChild className="gap-2 w-fit transition-all duration-200 hover:shadow-md hover:bg-green-600">
            <Link to="/redacoes/nova">
              <FilePlus2 className="h-4 w-4" />
              Enviar Nova Redação
            </Link>
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-500/30">
          <CardContent className="p-4 text-center">
            <FileText className="h-5 w-5 text-blue-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{stats.totalEssays}</div>
            <div className="text-xs text-muted-foreground">Enviadas</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-green-500/30">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-green-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{stats.averageGrade}</div>
            <div className="text-xs text-muted-foreground">Nota Média</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-purple-500/30">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 text-purple-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{stats.averageDays}d</div>
            <div className="text-xs text-muted-foreground">Tempo Médio</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-orange-500/30">
          <CardContent className="p-4 text-center">
            <Calendar className="h-5 w-5 text-orange-500 mx-auto mb-1.5" />
            <div className="text-xl font-bold text-foreground">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Pendentes</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-border shadow-sm">
        <div className="p-4 flex items-center justify-between border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Histórico</h2>
          <Badge variant="outline" className="text-xs">
            {correctedCount} corrigida{correctedCount !== 1 ? 's' : ''}
          </Badge>
        </div>
        <CardContent className="p-0">
          {essays.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Nenhuma redação enviada</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Envie sua primeira redação para receber correção detalhada.
              </p>
              <Button asChild className="gap-2">
                <Link to="/redacoes/nova">
                  <FilePlus2 className="h-4 w-4" />
                  Enviar Redação
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tema</TableHead>
                    <TableHead className="hidden md:table-cell">Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Nota</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {essays.map((essay, index) => (
                    <TableRow key={essay.id} className={cn("transition-colors hover:bg-muted/50", index % 2 === 1 && "bg-muted/30")}>
                      <TableCell className="font-medium">{essay.theme}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {essay.date}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={essay.status === 'Corrigida' ? 'default' : 'secondary'}
                          className={cn(
                            essay.status === 'Corrigida' &&
                              'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 border-green-300 dark:border-green-800',
                          )}
                        >
                          {essay.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {essay.grade ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {essay.status === 'Corrigida' && (
                          <Button
                            variant="outline"
                            size="icon"
                            asChild
                            className="transition-all duration-200 hover:shadow-md hover:border-primary/30"
                          >
                            <Link to={`/redacoes/${essay.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
