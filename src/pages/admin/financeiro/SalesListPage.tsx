import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import {
  getOrders,
  getOrderById,
  getRefunds,
  getAbandonedCarts,
  adminRefund,
  type Order,
} from '@/services/financialService'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionLoader } from '@/components/SectionLoader'
import {
  ArrowLeft,
  Search,
  Download,
  RefreshCw,
  Eye,
  RotateCcw,
  CheckCircle,
  XCircle,
  ShoppingCart,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('pt-BR')

type TabKey = 'all' | 'refunds' | 'abandoned'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'paid', label: 'Pago' },
  { value: 'pending', label: 'Pendente' },
  { value: 'failed', label: 'Falhou' },
  { value: 'refunded', label: 'Reembolsado' },
  { value: 'expired', label: 'Expirado' },
]

const METHOD_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'card', label: 'Cartao' },
  { value: 'pix', label: 'PIX' },
  { value: 'split_card', label: '2 Cartoes' },
]

const PERIOD_OPTIONS = [
  { value: '1m', label: 'Ultimo mes' },
  { value: '3m', label: 'Ultimos 3 meses' },
  { value: '1y', label: 'Ultimo ano' },
  { value: 'all', label: 'Todos' },
]

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    paid: 'bg-green-100 dark:bg-green-950/50 border-green-300 dark:border-green-800 text-green-600',
    pending: 'bg-yellow-100 dark:bg-yellow-950/50 border-yellow-300 dark:border-yellow-800 text-yellow-600',
    failed: 'bg-red-100 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-600',
    refunded: 'bg-orange-100 dark:bg-orange-950/50 border-orange-300 dark:border-orange-800 text-orange-600',
    expired: 'bg-gray-100 dark:bg-gray-950/50 border-gray-300 dark:border-gray-800 text-gray-500',
    succeeded: 'bg-green-100 dark:bg-green-950/50 border-green-300 dark:border-green-800 text-green-600',
  }
  const labelMap: Record<string, string> = {
    paid: 'Pago',
    pending: 'Pendente',
    failed: 'Falhou',
    refunded: 'Reembolsado',
    expired: 'Expirado',
    succeeded: 'Concluido',
  }
  return (
    <Badge className={map[status] || 'bg-gray-100 dark:bg-gray-950/50 text-gray-500'}>
      {labelMap[status] || status}
    </Badge>
  )
}

const methodBadge = (method: string | null) => {
  if (!method) return <span className="text-muted-foreground">-</span>
  const map: Record<string, string> = {
    card: 'bg-blue-100 dark:bg-blue-950/50 border-blue-300 dark:border-blue-800 text-blue-600',
    pix: 'bg-green-100 dark:bg-green-950/50 border-green-300 dark:border-green-800 text-green-600',
    split_card: 'bg-purple-100 dark:bg-purple-950/50 border-purple-300 dark:border-purple-800 text-purple-600',
  }
  const labelMap: Record<string, string> = {
    card: 'Cartao',
    pix: 'PIX',
    split_card: '2 Cartoes',
  }
  return (
    <Badge className={map[method] || 'bg-gray-100 dark:bg-gray-950/50 text-gray-500'}>
      {labelMap[method] || method}
    </Badge>
  )
}

function getPeriodDates(period: string): { startDate?: string; endDate?: string } {
  if (period === 'all') return {}
  const now = new Date()
  const start = new Date()
  if (period === '1m') start.setMonth(now.getMonth() - 1)
  else if (period === '3m') start.setMonth(now.getMonth() - 3)
  else if (period === '1y') start.setFullYear(now.getFullYear() - 1)
  return { startDate: start.toISOString(), endDate: now.toISOString() }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SalesListPage() {
  usePageTitle('Vendas')
  const navigate = useNavigate()
  const { toast } = useToast()

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>('all')

  // Orders state
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersLoading, setOrdersLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')

  // Refunds state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [refunds, setRefunds] = useState<any[]>([])
  const [refundsLoading, setRefundsLoading] = useState(false)

  // Abandoned carts state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [abandonedCarts, setAbandonedCarts] = useState<any[]>([])
  const [abandonedLoading, setAbandonedLoading] = useState(false)

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detailOrder, setDetailOrder] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Refund dialog
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundOrder, setRefundOrder] = useState<Order | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundSubmitting, setRefundSubmitting] = useState(false)

  const LIMIT = 20
  const totalPages = Math.ceil(ordersTotal / LIMIT)

  // ─── Load orders ────────────────────────────────────────────────────────────

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true)
    try {
      const { startDate, endDate } = getPeriodDates(periodFilter)
      const result = await getOrders({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        paymentMethod: methodFilter !== 'all' ? methodFilter : undefined,
        search: search.trim() || undefined,
        startDate,
        endDate,
        page: ordersPage,
        limit: LIMIT,
      })
      setOrders(result.orders as Order[])
      setOrdersTotal(result.total)
    } catch (err) {
      logger.error('Erro ao carregar vendas:', err)
      toast({ title: 'Erro ao carregar vendas', variant: 'destructive' })
    } finally {
      setOrdersLoading(false)
    }
  }, [statusFilter, methodFilter, search, periodFilter, ordersPage, toast])

  useEffect(() => {
    if (activeTab === 'all') loadOrders()
  }, [activeTab, loadOrders])

  // ─── Load refunds ──────────────────────────────────────────────────────────

  const loadRefunds = useCallback(async () => {
    setRefundsLoading(true)
    try {
      const data = await getRefunds()
      setRefunds(data)
    } catch (err) {
      logger.error('Erro ao carregar reembolsos:', err)
      toast({ title: 'Erro ao carregar reembolsos', variant: 'destructive' })
    } finally {
      setRefundsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (activeTab === 'refunds') loadRefunds()
  }, [activeTab, loadRefunds])

  // ─── Load abandoned carts ──────────────────────────────────────────────────

  const loadAbandoned = useCallback(async () => {
    setAbandonedLoading(true)
    try {
      const data = await getAbandonedCarts()
      setAbandonedCarts(data)
    } catch (err) {
      logger.error('Erro ao carregar carrinhos:', err)
      toast({ title: 'Erro ao carregar carrinhos abandonados', variant: 'destructive' })
    } finally {
      setAbandonedLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (activeTab === 'abandoned') loadAbandoned()
  }, [activeTab, loadAbandoned])

  // ─── Order detail ──────────────────────────────────────────────────────────

  const openDetail = async (orderId: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const data = await getOrderById(orderId)
      setDetailOrder(data)
    } catch (err) {
      logger.error('Erro ao carregar pedido:', err)
      toast({ title: 'Erro ao carregar detalhes', variant: 'destructive' })
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  // ─── Refund ────────────────────────────────────────────────────────────────

  const openRefundDialog = (order: Order) => {
    setRefundOrder(order)
    setRefundReason('')
    setRefundAmount('')
    setRefundOpen(true)
  }

  const handleRefund = async () => {
    if (!refundOrder) return
    setRefundSubmitting(true)
    try {
      const amountCents = refundAmount
        ? Math.round(parseFloat(refundAmount.replace(',', '.')) * 100)
        : undefined
      await adminRefund(refundOrder.id, amountCents, refundReason || undefined)
      toast({ title: 'Reembolso processado com sucesso' })
      setRefundOpen(false)
      loadOrders()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Tente novamente'
      logger.error('Erro ao reembolsar:', err)
      toast({ title: 'Erro ao processar reembolso', description: message, variant: 'destructive' })
    } finally {
      setRefundSubmitting(false)
    }
  }

  // ─── CSV Export ────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const header = 'Data,Email,Produto,Valor,Parcelas,Metodo,Status'
    const rows = orders.map((o) => {
      const email = o.user?.email || (o.metadata?.email as string) || ''
      const product = o.order_items?.map((i) => i.stripe_products?.product_name).join('; ') || ''
      const valor = (o.total_cents / 100).toFixed(2).replace('.', ',')
      const parcelas = o.installments || 1
      const method = o.payment_method || ''
      return `${formatDate(o.created_at)},"${email}","${product}","R$ ${valor}",${parcelas},${method},${o.status}`
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const today = new Date().toISOString().split('T')[0]
    a.download = `vendas-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Reset page on filter change ──────────────────────────────────────────

  const handleSearchChange = (val: string) => {
    setSearch(val)
    setOrdersPage(1)
  }
  const handleStatusChange = (val: string) => {
    setStatusFilter(val)
    setOrdersPage(1)
  }
  const handleMethodChange = (val: string) => {
    setMethodFilter(val)
    setOrdersPage(1)
  }
  const handlePeriodChange = (val: string) => {
    setPeriodFilter(val)
    setOrdersPage(1)
  }

  // ─── Helpers for order display ─────────────────────────────────────────────

  const getOrderName = (order: Order) => {
    if (order.user) return `${order.user.first_name || ''} ${order.user.last_name || ''}`.trim()
    return (order.metadata?.name as string) || '-'
  }

  const getOrderEmail = (order: Order) => {
    return order.user?.email || (order.metadata?.email as string) || '-'
  }

  const getOrderProduct = (order: Order) => {
    return order.order_items?.map((i) => i.stripe_products?.product_name).join(', ') || '-'
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'Todas as Vendas' },
    { key: 'refunds', label: 'Reembolsos' },
    { key: 'abandoned', label: 'Carrinhos Abandonados' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin/financeiro')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Vendas</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie pedidos, reembolsos e carrinhos abandonados.
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
            className={activeTab === tab.key ? '' : 'text-muted-foreground'}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* ─── Tab: Todas as Vendas ──────────────────────────────────────────── */}
      {activeTab === 'all' && (
        <>
          {/* Filter bar */}
          <Card className="border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
                <div className="relative flex-1 w-full lg:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por email..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-full lg:w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={methodFilter} onValueChange={handleMethodChange}>
                  <SelectTrigger className="w-full lg:w-[160px]">
                    <SelectValue placeholder="Metodo" />
                  </SelectTrigger>
                  <SelectContent>
                    {METHOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={periodFilter} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="w-full lg:w-[170px]">
                    <SelectValue placeholder="Periodo" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={loadOrders} title="Atualizar">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={exportCSV} className="gap-2">
                    <Download className="h-4 w-4" />
                    Exportar CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Orders table */}
          <Card className="border-border shadow-sm">
            <CardContent className="p-4">
              {ordersLoading ? (
                <SectionLoader />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Aluno</TableHead>
                          <TableHead className="hidden md:table-cell">Produto</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead className="hidden lg:table-cell">Parcelas</TableHead>
                          <TableHead className="hidden md:table-cell">Metodo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Acoes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-12">
                              <div className="flex flex-col items-center gap-3">
                                <ShoppingCart className="h-12 w-12 text-muted-foreground/50" />
                                <p className="font-medium text-muted-foreground">
                                  Nenhuma venda encontrada
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          orders.map((order) => (
                            <TableRow key={order.id} className="group hover:bg-primary/5">
                              <TableCell className="text-sm whitespace-nowrap">
                                {formatDate(order.created_at)}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-sm">{getOrderName(order)}</div>
                                <div className="text-xs text-muted-foreground">{getOrderEmail(order)}</div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm max-w-[200px] truncate">
                                {getOrderProduct(order)}
                              </TableCell>
                              <TableCell className="font-medium text-sm whitespace-nowrap">
                                {formatBRL(order.total_cents)}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-sm">
                                {order.installments || 1}x
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {methodBadge(order.payment_method)}
                              </TableCell>
                              <TableCell>{statusBadge(order.status)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openDetail(order.id)}
                                    title="Ver detalhes"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {order.status === 'paid' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-orange-600 hover:text-orange-700"
                                      onClick={() => openRefundDialog(order)}
                                      title="Reembolsar"
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Pagina {ordersPage} de {totalPages} ({ordersTotal} resultados)
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={ordersPage <= 1}
                          onClick={() => setOrdersPage((p) => p - 1)}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={ordersPage >= totalPages}
                          onClick={() => setOrdersPage((p) => p + 1)}
                        >
                          Proxima
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── Tab: Reembolsos ───────────────────────────────────────────────── */}
      {activeTab === 'refunds' && (
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            {refundsLoading ? (
              <SectionLoader />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Aluno</TableHead>
                      <TableHead className="hidden md:table-cell">Produto</TableHead>
                      <TableHead>Valor Reembolsado</TableHead>
                      <TableHead className="hidden lg:table-cell">Motivo</TableHead>
                      <TableHead className="hidden md:table-cell">Admin</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refunds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <RotateCcw className="h-12 w-12 text-muted-foreground/50" />
                            <p className="font-medium text-muted-foreground">
                              Nenhum reembolso encontrado
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      refunds.map((r) => (
                        <TableRow key={r.id} className="hover:bg-primary/5">
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDate(r.created_at)}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">
                              {r.order?.user
                                ? `${r.order.user.first_name || ''} ${r.order.user.last_name || ''}`.trim()
                                : '-'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {r.order?.user?.email || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {r.order?.order_items?.[0]?.stripe_products?.product_name || '-'}
                          </TableCell>
                          <TableCell className="font-medium text-sm whitespace-nowrap">
                            {formatBRL(r.amount_cents)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm max-w-[200px] truncate">
                            {r.reason || '-'}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {r.admin
                              ? `${r.admin.first_name || ''} ${r.admin.last_name || ''}`.trim()
                              : '-'}
                          </TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Tab: Carrinhos Abandonados ────────────────────────────────────── */}
      {activeTab === 'abandoned' && (
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            {abandonedLoading ? (
              <SectionLoader />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Abandonado em</TableHead>
                      <TableHead className="text-center">Email enviado?</TableHead>
                      <TableHead className="text-center">Recuperado?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {abandonedCarts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <ShoppingCart className="h-12 w-12 text-muted-foreground/50" />
                            <p className="font-medium text-muted-foreground">
                              Nenhum carrinho abandonado
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      abandonedCarts.map((cart) => {
                        const productsData = cart.products
                        const product =
                          typeof productsData === 'object' && productsData
                            ? Array.isArray(productsData)
                              ? (productsData[0] as Record<string, unknown>)?.product_name ||
                                (productsData[0] as Record<string, unknown>)?.name ||
                                '-'
                              : (productsData as Record<string, unknown>).product_name ||
                                (productsData as Record<string, unknown>).name ||
                                '-'
                            : '-'
                        const value = cart.total_cents
                        return (
                          <TableRow key={cart.id} className="hover:bg-primary/5">
                            <TableCell className="text-sm">{cart.email || '-'}</TableCell>
                            <TableCell className="text-sm">{String(product)}</TableCell>
                            <TableCell className="text-sm font-medium whitespace-nowrap">
                              {typeof value === 'number' ? formatBRL(value) : '-'}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {cart.abandoned_at ? formatDate(cart.abandoned_at) : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {cart.recovery_email_sent ? (
                                <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {cart.recovered_order_id ? (
                                <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Order Detail Dialog ───────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <SectionLoader />
          ) : detailOrder ? (
            <div className="space-y-4 text-sm">
              {/* Order info */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="text-muted-foreground">ID</div>
                <div className="font-mono text-xs">{detailOrder.id}</div>
                <div className="text-muted-foreground">Data</div>
                <div>{formatDate(detailOrder.created_at)}</div>
                <div className="text-muted-foreground">Status</div>
                <div>{statusBadge(detailOrder.status)}</div>
                <div className="text-muted-foreground">Metodo</div>
                <div>{methodBadge(detailOrder.payment_method)}</div>
                <div className="text-muted-foreground">Parcelas</div>
                <div>{detailOrder.installments || 1}x</div>
              </div>

              {/* Customer */}
              {detailOrder.user && (
                <div className="border-t pt-3">
                  <h4 className="font-semibold mb-1">Cliente</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="text-muted-foreground">Nome</div>
                    <div>{`${detailOrder.user.first_name || ''} ${detailOrder.user.last_name || ''}`.trim()}</div>
                    <div className="text-muted-foreground">Email</div>
                    <div>{detailOrder.user.email}</div>
                  </div>
                </div>
              )}

              {/* Products */}
              {detailOrder.order_items?.length > 0 && (
                <div className="border-t pt-3">
                  <h4 className="font-semibold mb-1">Produtos</h4>
                  {detailOrder.order_items.map((item: Record<string, unknown>, idx: number) => {
                    const sp = item.stripe_products as Record<string, unknown> | null
                    return (
                      <div key={idx} className="flex justify-between">
                        <span>{sp?.product_name ? String(sp.product_name) : '-'}</span>
                        <span className="font-medium">
                          {typeof sp?.price_cents === 'number' ? formatBRL(sp.price_cents as number) : '-'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Payment details */}
              {detailOrder.payments?.length > 0 && (
                <div className="border-t pt-3">
                  <h4 className="font-semibold mb-1">Pagamento</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {detailOrder.payments[0].card_last4 && (
                      <>
                        <div className="text-muted-foreground">Cartao</div>
                        <div>
                          {detailOrder.payments[0].card_brand || ''} **** {detailOrder.payments[0].card_last4}
                        </div>
                      </>
                    )}
                    {detailOrder.payments[0].stripe_fee_cents != null && (
                      <>
                        <div className="text-muted-foreground">Taxa Stripe</div>
                        <div>{formatBRL(detailOrder.payments[0].stripe_fee_cents)}</div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Coupon */}
              {detailOrder.coupon && (
                <div className="border-t pt-3">
                  <h4 className="font-semibold mb-1">Cupom</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="text-muted-foreground">Codigo</div>
                    <div className="font-mono">{detailOrder.coupon.code}</div>
                    <div className="text-muted-foreground">Desconto</div>
                    <div>
                      {detailOrder.coupon.discount_type === 'percent'
                        ? `${detailOrder.coupon.discount_value}%`
                        : formatBRL(detailOrder.coupon.discount_value)}
                    </div>
                  </div>
                </div>
              )}

              {/* Affiliate */}
              {detailOrder.affiliate && (
                <div className="border-t pt-3">
                  <h4 className="font-semibold mb-1">Afiliado</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="text-muted-foreground">Codigo</div>
                    <div className="font-mono">{detailOrder.affiliate.affiliate_code}</div>
                    <div className="text-muted-foreground">Comissao</div>
                    <div>{detailOrder.affiliate.commission_percent}%</div>
                    {detailOrder.affiliate.user && (
                      <>
                        <div className="text-muted-foreground">Afiliado</div>
                        <div>
                          {`${detailOrder.affiliate.user.first_name || ''} ${detailOrder.affiliate.user.last_name || ''}`.trim()}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ─── Refund Confirmation Dialog ────────────────────────────────────── */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Reembolso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja reembolsar este pedido?
            </p>
            {refundOrder && (
              <div className="text-sm bg-muted/50 rounded-lg p-3 space-y-1">
                <div>
                  <span className="text-muted-foreground">Aluno: </span>
                  <span className="font-medium">{getOrderName(refundOrder)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor total: </span>
                  <span className="font-medium">{formatBRL(refundOrder.total_cents)}</span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Textarea
                placeholder="Descreva o motivo do reembolso..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Valor do reembolso (opcional, padrao: valor total)
              </label>
              <Input
                placeholder="Ex: 99,90"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio para reembolso total.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)} disabled={refundSubmitting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRefund}
              disabled={refundSubmitting}
            >
              {refundSubmitting ? 'Processando...' : 'Confirmar Reembolso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
