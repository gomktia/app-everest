import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { logger } from '@/lib/logger'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  PlusCircle,
  Pencil,
  Archive,
  Users,
  Copy,
  Link as LinkIcon,
  Mail,
  ArchiveIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PageTabs } from '@/components/PageTabs'
import { getAllInvites, archiveInvite, updateInvite } from '@/services/inviteService'
import { useToast } from '@/components/ui/use-toast'
import { SectionLoader } from '@/components/SectionLoader'

interface InviteRow {
  id: string
  slug: string
  title: string
  description?: string | null
  status: 'active' | 'archived'
  invite_registrations: { count: number }[]
}

export default function AdminInvitesPage() {
  usePageTitle('Convites')
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const { toast } = useToast()

  const loadInvites = async () => {
    try {
      setLoading(true)
      const data = await getAllInvites()
      setInvites(data as unknown as InviteRow[])
    } catch (error) {
      logger.error('Erro ao carregar convites:', error)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os convites.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvites()
  }, [])

  const handleArchive = async (invite: InviteRow) => {
    const action = invite.status === 'active' ? 'arquivar' : 'reativar'
    if (!confirm(`Tem certeza que deseja ${action} o convite "${invite.title}"?`)) return

    try {
      if (invite.status === 'active') {
        await archiveInvite(invite.id)
      } else {
        await updateInvite(invite.id, { status: 'active' })
      }
      toast({
        title: invite.status === 'active' ? 'Convite arquivado' : 'Convite reativado',
        description: `O convite foi ${invite.status === 'active' ? 'arquivado' : 'reativado'} com sucesso.`,
      })
      loadInvites()
    } catch (error) {
      logger.error('Erro ao atualizar convite:', error)
      toast({
        title: 'Erro',
        description: `Não foi possível ${action} o convite.`,
        variant: 'destructive',
      })
    }
  }

  const handleCopyLink = async (slug: string) => {
    const url = `${window.location.origin}/invite/${slug}`
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Link copiado!', description: url })
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar o link.', variant: 'destructive' })
    }
  }

  const activeInvites = invites.filter((i) => i.status === 'active')
  const archivedInvites = invites.filter((i) => i.status === 'archived')
  const totalRegistrations = invites.reduce((sum, i) => sum + (i.invite_registrations?.[0]?.count ?? 0), 0)

  const getRegistrationCount = (invite: InviteRow) => {
    return invite.invite_registrations?.[0]?.count ?? 0
  }

  const renderTable = (items: InviteRow[], emptyMessage: string) => (
    <Card className="border-border shadow-sm">
      <CardContent className="p-0">
        <div className="rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Título</TableHead>
                <TableHead className="font-semibold">Inscritos</TableHead>
                <TableHead className="font-semibold">Link de divulgação</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((invite) => {
                  const inviteUrl = `${window.location.origin}/invite/${invite.slug}`
                  return (
                    <TableRow key={invite.id} className="group hover:bg-primary/5">
                      <TableCell className="font-medium max-w-xs">
                        <div>
                          <p className="font-medium group-hover:text-primary transition-colors">{invite.title}</p>
                          {invite.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                              {invite.description.length > 80
                                ? invite.description.slice(0, 80) + '...'
                                : invite.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="cursor-pointer gap-1">
                          <Users className="h-3 w-3" />
                          {getRegistrationCount(invite)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded max-w-[250px] truncate block">
                            {inviteUrl}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => handleCopyLink(invite.slug)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 group-hover/btn:text-primary" asChild>
                            <Link to={`/admin/invites/${invite.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleArchive(invite)}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return <SectionLoader />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gestão de Convites</h1>
        <p className="text-muted-foreground mt-1">Gerencie convites e links de inscrição</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border shadow-sm">
          <CardContent className="p-3 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
              <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-muted/50">
                <Mail className="h-5 w-5 md:h-6 md:w-6 text-orange-500" />
              </div>
              <div>
                <div className="text-xl md:text-2xl font-bold text-foreground">{invites.length}</div>
                <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Total de Convites</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-3 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
              <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-muted/50">
                <LinkIcon className="h-5 w-5 md:h-6 md:w-6 text-green-500" />
              </div>
              <div>
                <div className="text-xl md:text-2xl font-bold text-foreground">{activeInvites.length}</div>
                <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Convites Ativos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-3 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
              <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-muted/50">
                <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-500" />
              </div>
              <div>
                <div className="text-xl md:text-2xl font-bold text-foreground">{totalRegistrations}</div>
                <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Total Inscritos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-3 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
              <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-muted/50">
                <ArchiveIcon className="h-5 w-5 md:h-6 md:w-6 text-purple-500" />
              </div>
              <div>
                <div className="text-xl md:text-2xl font-bold text-foreground">{archivedInvites.length}</div>
                <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Arquivados</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and New button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-3">
        <Button asChild className="px-6 py-3 rounded-xl font-semibold">
          <Link to="/admin/invites/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Convite
          </Link>
        </Button>
      </div>

      {/* Tabs + Table */}
      <PageTabs
        value={tab}
        onChange={(v) => setTab(v as 'active' | 'archived')}
        tabs={[
          {
            value: 'active',
            label: 'Ativos',
            count: activeInvites.length,
            content: renderTable(activeInvites, 'Nenhum convite ativo. Crie seu primeiro convite!'),
          },
          {
            value: 'archived',
            label: 'Arquivados',
            count: archivedInvites.length,
            content: renderTable(archivedInvites, 'Nenhum convite arquivado.'),
          },
        ]}
      />
    </div>
  )
}
