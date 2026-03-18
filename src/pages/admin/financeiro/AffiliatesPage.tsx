import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import { supabase } from '@/lib/supabase/client'
import {
  getAffiliates,
  createAffiliate,
  updateAffiliate,
  getCommissions,
  markCommissionPaid,
  getAffiliateStats,
  type Affiliate,
  type AffiliateCommission,
} from '@/services/affiliateService'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SectionLoader } from '@/components/SectionLoader'
import {
  ArrowLeft,
  Plus,
  Copy,
  Edit,
  Check,
  Users,
  DollarSign,
  Search,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AffiliatesPage() {
  usePageTitle('Afiliados')
  const navigate = useNavigate()
  const { toast } = useToast()

  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [stats, setStats] = useState({ activeAffiliates: 0, salesViaAffiliates: 0, pendingCommissions: 0 })
  const [loading, setLoading] = useState(true)

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<{ id: string; first_name: string; last_name: string; email: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{ id: string; first_name: string; last_name: string; email: string } | null>(null)
  const [formCode, setFormCode] = useState('')
  const [formCommission, setFormCommission] = useState('10')

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null)
  const [editCommission, setEditCommission] = useState('')

  // Commissions
  const [expandedAffiliate, setExpandedAffiliate] = useState<string | null>(null)
  const [commissions, setCommissions] = useState<Record<string, AffiliateCommission[]>>({})
  const [loadingCommissions, setLoadingCommissions] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [affiliatesData, statsData] = await Promise.all([
        getAffiliates(),
        getAffiliateStats(),
      ])
      setAffiliates(affiliatesData)
      setStats(statsData)
    } catch (err) {
      logger.error('Error loading affiliates:', err)
      toast({ title: 'Erro ao carregar afiliados', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  // User search with debounce
  useEffect(() => {
    if (userSearch.length < 3) { setUserResults([]); return }
    const timeout = setTimeout(async () => {
      try {
        setSearching(true)
        const { data } = await supabase
          .from('users')
          .select('id, first_name, last_name, email')
          .or(`email.ilike.%${userSearch}%,first_name.ilike.%${userSearch}%,last_name.ilike.%${userSearch}%`)
          .limit(10)
        setUserResults(data || [])
      } catch (err) {
        logger.error('User search error:', err)
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(timeout)
  }, [userSearch])

  const handleSelectUser = (user: typeof userResults[0]) => {
    setSelectedUser(user)
    setUserSearch(`${user.first_name} ${user.last_name} (${user.email})`)
    setUserResults([])
    // Auto-generate code suggestion
    const firstName = user.first_name?.toUpperCase().replace(/\s/g, '') || ''
    setFormCode(`PROF-${firstName}`)
  }

  const handleCreate = async () => {
    if (!selectedUser || !formCode.trim() || !formCommission) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' })
      return
    }
    try {
      setSaving(true)
      await createAffiliate(selectedUser.id, formCode, Number(formCommission))
      toast({ title: 'Afiliado criado com sucesso' })
      setCreateDialogOpen(false)
      resetCreateForm()
      await loadData()
    } catch (err) {
      logger.error('Error creating affiliate:', err)
      toast({ title: 'Erro ao criar afiliado', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const resetCreateForm = () => {
    setUserSearch('')
    setUserResults([])
    setSelectedUser(null)
    setFormCode('')
    setFormCommission('10')
  }

  const openEditDialog = (affiliate: Affiliate) => {
    setEditingAffiliate(affiliate)
    setEditCommission(String(affiliate.commission_percent))
    setEditDialogOpen(true)
  }

  const handleEdit = async () => {
    if (!editingAffiliate || !editCommission) return
    try {
      setSaving(true)
      await updateAffiliate(editingAffiliate.id, { commission_percent: Number(editCommission) })
      toast({ title: 'Comissao atualizada' })
      setEditDialogOpen(false)
      setEditingAffiliate(null)
      await loadData()
    } catch (err) {
      logger.error('Error updating affiliate:', err)
      toast({ title: 'Erro ao atualizar afiliado', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (affiliate: Affiliate) => {
    try {
      await updateAffiliate(affiliate.id, { is_active: !affiliate.is_active })
      toast({ title: affiliate.is_active ? 'Afiliado desativado' : 'Afiliado ativado' })
      await loadData()
    } catch (err) {
      logger.error('Error toggling affiliate:', err)
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  const handleCopyLink = (code: string) => {
    const url = `https://app.everestpreparatorios.com.br/checkout?ref=${code}`
    navigator.clipboard.writeText(url)
    toast({ title: 'Link copiado!' })
  }

  const toggleCommissions = async (affiliateId: string) => {
    if (expandedAffiliate === affiliateId) {
      setExpandedAffiliate(null)
      return
    }
    setExpandedAffiliate(affiliateId)
    if (!commissions[affiliateId]) {
      try {
        setLoadingCommissions(affiliateId)
        const data = await getCommissions(affiliateId)
        setCommissions(prev => ({ ...prev, [affiliateId]: data }))
      } catch (err) {
        logger.error('Error loading commissions:', err)
        toast({ title: 'Erro ao carregar comissoes', variant: 'destructive' })
      } finally {
        setLoadingCommissions(null)
      }
    }
  }

  const handleMarkPaid = async (commissionId: string, affiliateId: string) => {
    try {
      await markCommissionPaid(commissionId)
      toast({ title: 'Comissao marcada como paga' })
      // Reload commissions for this affiliate
      const data = await getCommissions(affiliateId)
      setCommissions(prev => ({ ...prev, [affiliateId]: data }))
      await loadData()
    } catch (err) {
      logger.error('Error marking commission paid:', err)
      toast({ title: 'Erro ao marcar como paga', variant: 'destructive' })
    }
  }

  if (loading) return <SectionLoader />

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/financeiro')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Afiliados</h1>
        </div>
        <Button onClick={() => { resetCreateForm(); setCreateDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" /> Criar Afiliado
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-blue-500/10 p-3">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Afiliados Ativos</p>
              <p className="text-2xl font-bold">{stats.activeAffiliates}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-green-500/10 p-3">
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vendas via Afiliados</p>
              <p className="text-2xl font-bold">{stats.salesViaAffiliates}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-yellow-500/10 p-3">
              <DollarSign className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Comissoes Pendentes</p>
              <p className="text-2xl font-bold">{formatBRL(stats.pendingCommissions)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Afiliado</TableHead>
                <TableHead>Codigo</TableHead>
                <TableHead>Comissao %</TableHead>
                <TableHead>Vendas</TableHead>
                <TableHead>Total Ganho</TableHead>
                <TableHead>Pendente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {affiliates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum afiliado cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                affiliates.map(affiliate => {
                  const isExpanded = expandedAffiliate === affiliate.id
                  const affiliateCommissions = commissions[affiliate.id] || []
                  const pendingCents = affiliate.total_earned_cents - affiliate.total_paid_cents

                  return (
                    <>
                      <TableRow key={affiliate.id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleCommissions(affiliate.id)}
                          >
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4" />
                              : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {affiliate.user?.first_name} {affiliate.user?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">{affiliate.user?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-semibold">{affiliate.affiliate_code}</TableCell>
                        <TableCell>{affiliate.commission_percent}%</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>{formatBRL(affiliate.total_earned_cents)}</TableCell>
                        <TableCell>{formatBRL(pendingCents > 0 ? pendingCents : 0)}</TableCell>
                        <TableCell>
                          <Badge variant={affiliate.is_active ? 'default' : 'secondary'}>
                            {affiliate.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(affiliate)}
                              title="Editar comissao"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(affiliate)}
                              title={affiliate.is_active ? 'Desativar' : 'Ativar'}
                            >
                              <Check className={`h-4 w-4 ${affiliate.is_active ? 'text-green-500' : 'text-muted-foreground'}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopyLink(affiliate.affiliate_code)}
                              title="Copiar link"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded commissions */}
                      {isExpanded && (
                        <TableRow key={`${affiliate.id}-commissions`}>
                          <TableCell colSpan={9} className="bg-muted/50 p-4">
                            {loadingCommissions === affiliate.id ? (
                              <p className="text-center text-sm text-muted-foreground">Carregando comissoes...</p>
                            ) : affiliateCommissions.length === 0 ? (
                              <p className="text-center text-sm text-muted-foreground">Nenhuma comissao registrada</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Pedido</TableHead>
                                    <TableHead>Valor Comissao</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Acao</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {affiliateCommissions.map(comm => (
                                    <TableRow key={comm.id}>
                                      <TableCell>
                                        {new Date(comm.created_at).toLocaleDateString('pt-BR')}
                                      </TableCell>
                                      <TableCell className="font-mono text-xs">
                                        {comm.order_id.slice(0, 8)}...
                                      </TableCell>
                                      <TableCell>{formatBRL(comm.commission_cents)}</TableCell>
                                      <TableCell>
                                        <Badge variant={comm.status === 'paid' ? 'default' : comm.status === 'pending' ? 'outline' : 'secondary'}>
                                          {comm.status === 'paid' ? 'Pago' : comm.status === 'pending' ? 'Pendente' : comm.status}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {comm.status === 'pending' && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleMarkPaid(comm.id, affiliate.id)}
                                          >
                                            Marcar como Pago
                                          </Button>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) { setCreateDialogOpen(false); resetCreateForm() } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Afiliado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Buscar Usuario</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nome ou email..."
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setSelectedUser(null) }}
                />
              </div>
              {searching && (
                <p className="text-xs text-muted-foreground">Buscando...</p>
              )}
              {userResults.length > 0 && !selectedUser && (
                <div className="max-h-40 overflow-y-auto rounded border divide-y">
                  {userResults.map(user => (
                    <button
                      key={user.id}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                      onClick={() => handleSelectUser(user)}
                    >
                      <p className="font-medium">{user.first_name} {user.last_name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="affiliate-code">Codigo do Afiliado</Label>
              <Input
                id="affiliate-code"
                placeholder="EX: PROF-RICARDO"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="affiliate-commission">Comissao (%)</Label>
              <Input
                id="affiliate-commission"
                type="number"
                min={1}
                max={100}
                value={formCommission}
                onChange={(e) => setFormCommission(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetCreateForm() }}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving || !selectedUser}>
              {saving ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) { setEditDialogOpen(false); setEditingAffiliate(null) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Comissao</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingAffiliate && (
              <p className="text-sm text-muted-foreground">
                {editingAffiliate.user?.first_name} {editingAffiliate.user?.last_name} ({editingAffiliate.affiliate_code})
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-commission">Comissao (%)</Label>
              <Input
                id="edit-commission"
                type="number"
                min={1}
                max={100}
                value={editCommission}
                onChange={(e) => setEditCommission(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditingAffiliate(null) }}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
