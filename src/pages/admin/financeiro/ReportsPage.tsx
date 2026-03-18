import { useState, useEffect, useMemo } from 'react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, FileText, TrendingUp, TrendingDown, DollarSign, BarChart3, Users, Percent } from 'lucide-react'
import { getFinancialStats, getRevenueByMonth, getOrders, type FinancialStats, type Order } from '@/services/financialService'
import { logger } from '@/lib/logger'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import jsPDF from 'jspdf'

const CHART_COLORS = {
  orange: '#f97316',
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#8b5cf6',
}

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type PeriodKey = 'this_month' | 'last_month' | 'last_3_months' | 'last_year'

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'this_month', label: 'Este Mês' },
  { key: 'last_month', label: 'Último Mês' },
  { key: 'last_3_months', label: 'Últimos 3 Meses' },
  { key: 'last_year', label: 'Último Ano' },
]

function getPeriodDates(period: PeriodKey) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  switch (period) {
    case 'this_month':
      return {
        startDate: new Date(y, m, 1).toISOString(),
        endDate: new Date(y, m + 1, 0, 23, 59, 59).toISOString(),
        month: `${y}-${String(m + 1).padStart(2, '0')}`,
        label: `${String(m + 1).padStart(2, '0')}/${y}`,
      }
    case 'last_month':
      return {
        startDate: new Date(y, m - 1, 1).toISOString(),
        endDate: new Date(y, m, 0, 23, 59, 59).toISOString(),
        month: `${new Date(y, m - 1, 1).getFullYear()}-${String(new Date(y, m - 1, 1).getMonth() + 1).padStart(2, '0')}`,
        label: `${String(new Date(y, m - 1, 1).getMonth() + 1).padStart(2, '0')}/${new Date(y, m - 1, 1).getFullYear()}`,
      }
    case 'last_3_months':
      return {
        startDate: new Date(y, m - 2, 1).toISOString(),
        endDate: new Date(y, m + 1, 0, 23, 59, 59).toISOString(),
        month: undefined,
        label: 'Últimos 3 Meses',
      }
    case 'last_year':
      return {
        startDate: new Date(y - 1, m + 1, 1).toISOString(),
        endDate: new Date(y, m + 1, 0, 23, 59, 59).toISOString(),
        month: undefined,
        label: 'Último Ano',
      }
  }
}

export default function ReportsPage() {
  usePageTitle('Relatórios')

  const [period, setPeriod] = useState<PeriodKey>('this_month')
  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [prevStats, setPrevStats] = useState<FinancialStats | null>(null)
  const [revenueByMonth, setRevenueByMonth] = useState<{ month: string; total: number }[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const periodDates = useMemo(() => getPeriodDates(period), [period])

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [statsRes, revenueRes, ordersRes] = await Promise.all([
          getFinancialStats(periodDates.month),
          getRevenueByMonth(),
          getOrders({ startDate: periodDates.startDate, endDate: periodDates.endDate, limit: 1000 }),
        ])
        setStats(statsRes)
        setRevenueByMonth(revenueRes)
        setOrders(ordersRes.orders)

        // Fetch previous month stats for comparison
        const now = new Date()
        const prevMonth = `${new Date(now.getFullYear(), now.getMonth() - 1, 1).getFullYear()}-${String(new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth() + 1).padStart(2, '0')}`
        const prevRes = await getFinancialStats(prevMonth)
        setPrevStats(prevRes)
      } catch (err) {
        logger.error('Failed to fetch report data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [periodDates])

  // Aggregate daily sales from orders
  const dailySales = useMemo(() => {
    const byDay: Record<string, number> = {}
    for (const order of orders) {
      if (order.status !== 'paid') continue
      const day = order.created_at.substring(0, 10)
      byDay[day] = (byDay[day] || 0) + order.total_cents
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, total]) => ({ day: day.substring(5), total: total / 100 }))
  }, [orders])

  // Payment method distribution
  const paymentMethods = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const order of orders) {
      if (order.status !== 'paid') continue
      const method = order.payment_method || 'Outro'
      const label = method === 'card' ? 'Cartão'
        : method === 'pix' ? 'PIX'
        : method === 'split_card' ? 'Parcelado'
        : method
      counts[label] = (counts[label] || 0) + 1
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [orders])

  // Funnel data
  const funnelData = useMemo(() => {
    const total = orders.length
    const paid = orders.filter(o => o.status === 'paid').length
    const pending = orders.filter(o => o.status === 'pending').length
    return [
      { stage: 'Checkouts Iniciados', count: total },
      { stage: 'Pagamentos', count: paid + pending },
      { stage: 'Confirmados', count: paid },
    ]
  }, [orders])

  // Revenue chart formatted
  const revenueChartData = useMemo(() =>
    revenueByMonth.map(r => ({
      month: r.month.substring(5),
      receita: r.total / 100,
    })),
  [revenueByMonth])

  // Comparison deltas
  const comparison = useMemo(() => {
    if (!stats || !prevStats) return null
    const delta = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0
      return Math.round(((curr - prev) / prev) * 100)
    }
    return [
      { label: 'Receita', current: formatBRL(stats.totalRevenue), previous: formatBRL(prevStats.totalRevenue), delta: delta(stats.totalRevenue, prevStats.totalRevenue) },
      { label: 'Vendas', current: String(stats.salesCount), previous: String(prevStats.salesCount), delta: delta(stats.salesCount, prevStats.salesCount) },
      { label: 'Ticket Médio', current: formatBRL(stats.avgTicket), previous: formatBRL(prevStats.avgTicket), delta: delta(stats.avgTicket, prevStats.avgTicket) },
      { label: 'Reembolsos', current: String(stats.refundsCount), previous: String(prevStats.refundsCount), delta: delta(stats.refundsCount, prevStats.refundsCount) },
      { label: 'Taxa Conversão', current: `${stats.conversionRate}%`, previous: `${prevStats.conversionRate}%`, delta: delta(stats.conversionRate, prevStats.conversionRate) },
    ]
  }, [stats, prevStats])

  // CSV export
  const exportCSV = () => {
    const header = 'ID,Data,Status,Valor,Método,Cliente\n'
    const rows = orders.map(o => {
      const name = o.user ? `${o.user.first_name} ${o.user.last_name}` : '-'
      return `${o.id},${o.created_at.substring(0, 10)},${o.status},${(o.total_cents / 100).toFixed(2)},${o.payment_method || '-'},${name}`
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pedidos-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // PDF export
  const exportPDF = () => {
    if (!stats) return
    const doc = new jsPDF()
    doc.setFontSize(20)
    doc.text('Relatório Financeiro - Everest Preparatórios', 20, 20)
    doc.setFontSize(12)
    doc.text(`Período: ${periodDates.label}`, 20, 35)
    doc.text(`Receita Total: ${formatBRL(stats.totalRevenue)}`, 20, 50)
    doc.text(`Vendas: ${stats.salesCount}`, 20, 60)
    doc.text(`Ticket Médio: ${formatBRL(stats.avgTicket)}`, 20, 70)
    doc.text(`Reembolsos: ${stats.refundsCount} (${formatBRL(stats.refundsTotal)})`, 20, 80)
    doc.text(`Taxa de Conversão: ${stats.conversionRate}%`, 20, 90)
    doc.text(`Carrinhos Abandonados: ${stats.abandonedCarts}`, 20, 100)
    doc.text(`Comissões Pendentes: ${formatBRL(stats.pendingCommissions)}`, 20, 110)
    doc.save(`relatorio-financeiro-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const PIE_COLORS = [CHART_COLORS.orange, CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.purple]

  const churnRate = stats
    ? stats.salesCount > 0
      ? ((stats.refundsCount / stats.salesCount) * 100).toFixed(1)
      : '0.0'
    : '-'

  const ltv = stats ? formatBRL(stats.avgTicket) : '-'

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Relatórios Financeiros</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={loading}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={loading || !stats}>
            <FileText className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map(p => (
          <Button
            key={p.key}
            variant={period === p.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Metrics Row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MRR</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats ? formatBRL(stats.totalRevenue) : '-'}</div>
                <p className="text-xs text-muted-foreground">Receita recorrente mensal</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats ? formatBRL(stats.avgTicket) : '-'}</div>
                <p className="text-xs text-muted-foreground">Valor médio por pedido</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Churn</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{churnRate}%</div>
                <p className="text-xs text-muted-foreground">Reembolsos / total vendas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">LTV Estimado</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{ltv}</div>
                <p className="text-xs text-muted-foreground">Ticket médio x 1 (acesso anual)</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Revenue by Month */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Receita por Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v: number) => `R$${v}`} />
                    <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Receita']} />
                    <Bar dataKey="receita" fill={CHART_COLORS.orange} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Daily Sales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vendas por Dia</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailySales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis tickFormatter={(v: number) => `R$${v}`} />
                    <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Vendas']} />
                    <Line type="monotone" dataKey="total" stroke={CHART_COLORS.blue} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Métodos de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentMethods}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {paymentMethods.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Conversion Funnel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Funil de Conversão</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={funnelData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="stage" type="category" width={140} />
                    <Tooltip />
                    <Bar dataKey="count" fill={CHART_COLORS.green} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Month Comparison Table */}
          {comparison && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Comparativo Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left font-medium">Métrica</th>
                        <th className="py-2 text-right font-medium">Mês Atual</th>
                        <th className="py-2 text-right font-medium">Mês Anterior</th>
                        <th className="py-2 text-right font-medium">Variação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.map(row => {
                        const isNegativeGood = row.label === 'Reembolsos'
                        const isPositive = isNegativeGood ? row.delta <= 0 : row.delta >= 0
                        return (
                          <tr key={row.label} className="border-b last:border-0">
                            <td className="py-3 font-medium">{row.label}</td>
                            <td className="py-3 text-right">{row.current}</td>
                            <td className="py-3 text-right text-muted-foreground">{row.previous}</td>
                            <td className="py-3 text-right">
                              <span className={`inline-flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                                {row.delta >= 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {row.delta >= 0 ? '+' : ''}{row.delta}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
