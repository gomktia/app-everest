import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageTabs } from '@/components/PageTabs'
import { SectionLoader } from '@/components/SectionLoader'
import { logger } from '@/lib/logger'
import {
  getFinancialStats,
  getRevenueByMonth,
  type FinancialStats,
} from '@/services/financialService'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  ArrowLeft,
  DollarSign,
  ShoppingCart,
  Receipt,
  RefreshCcw,
  TrendingUp,
  ShoppingBag,
  Users,
  LayoutDashboard,
  Tag,
  FileText,
} from 'lucide-react'

const formatCents = (cents: number) => {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

const formatAxisValue = (value: number) => {
  const reais = value / 100
  if (reais >= 1000) return `R$ ${(reais / 1000).toFixed(1)}k`
  return `R$ ${reais.toFixed(0)}`
}

const formatMonthLabel = (month: string) => {
  const [, m] = month.split('-')
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return months[parseInt(m, 10) - 1] || m
}

export default function FinancialDashboardPage() {
  usePageTitle('Financeiro')
  const navigate = useNavigate()
  const location = useLocation()

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [prevStats, setPrevStats] = useState<FinancialStats | null>(null)
  const [revenueData, setRevenueData] = useState<{ month: string; total: number }[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Current month
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      // Previous month
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const previousMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`

      const [currentStats, previousStats, revenue] = await Promise.all([
        getFinancialStats(currentMonth),
        getFinancialStats(previousMonth),
        getRevenueByMonth(),
      ])

      setStats(currentStats)
      setPrevStats(previousStats)
      setRevenueData(revenue)
    } catch (error) {
      logger.error('Error loading financial dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDelta = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '0%'
    const change = Math.round(((current - previous) / previous) * 100)
    return change >= 0 ? `+${change}%` : `${change}%`
  }

  const getDeltaColor = (current: number, previous: number, invertColors = false) => {
    const isUp = current >= previous
    if (invertColors) return isUp ? 'text-red-600' : 'text-green-600'
    return isUp ? 'text-green-600' : 'text-red-600'
  }

  const currentTab = location.pathname === '/admin/financeiro' ? 'dashboard' : ''

  const tabs = [
    {
      value: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
      content: null, // Content rendered below
    },
    {
      value: 'vendas',
      label: 'Vendas',
      icon: <ShoppingCart className="h-4 w-4" />,
      content: null,
    },
    {
      value: 'cupons',
      label: 'Cupons',
      icon: <Tag className="h-4 w-4" />,
      content: null,
    },
    {
      value: 'afiliados',
      label: 'Afiliados',
      icon: <Users className="h-4 w-4" />,
      content: null,
    },
    {
      value: 'relatorios',
      label: 'Relatórios',
      icon: <FileText className="h-4 w-4" />,
      content: null,
    },
  ]

  const handleTabChange = (tab: string) => {
    if (tab === 'dashboard') {
      navigate('/admin/financeiro')
    } else {
      navigate(`/admin/financeiro/${tab}`)
    }
  }

  if (loading) return <SectionLoader />

  const s = stats || {
    totalRevenue: 0,
    salesCount: 0,
    avgTicket: 0,
    refundsCount: 0,
    refundsTotal: 0,
    conversionRate: 0,
    abandonedCarts: 0,
    pendingCommissions: 0,
  }

  const p = prevStats || { ...s }

  const refundRate = s.salesCount > 0 ? ((s.refundsCount / s.salesCount) * 100).toFixed(1) : '0'

  const kpis = [
    {
      label: 'Receita Total',
      value: formatCents(s.totalRevenue),
      delta: `${getDelta(s.totalRevenue, p.totalRevenue)} vs mês anterior`,
      deltaColor: getDeltaColor(s.totalRevenue, p.totalRevenue),
      arrow: s.totalRevenue >= p.totalRevenue ? '↑' : '↓',
      bg: 'bg-green-100 border-green-300',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      icon: DollarSign,
    },
    {
      label: 'Vendas do Mês',
      value: s.salesCount.toString(),
      delta: `${getDelta(s.salesCount, p.salesCount)} vs mês anterior`,
      deltaColor: getDeltaColor(s.salesCount, p.salesCount),
      arrow: s.salesCount >= p.salesCount ? '↑' : '↓',
      bg: 'bg-blue-100 border-blue-300',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      icon: ShoppingCart,
    },
    {
      label: 'Ticket Médio',
      value: formatCents(s.avgTicket),
      delta: `${getDelta(s.avgTicket, p.avgTicket)} vs mês anterior`,
      deltaColor: getDeltaColor(s.avgTicket, p.avgTicket),
      arrow: s.avgTicket >= p.avgTicket ? '↑' : '↓',
      bg: 'bg-yellow-100 border-yellow-300',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      icon: Receipt,
    },
    {
      label: 'Reembolsos',
      value: `${s.refundsCount} (${formatCents(s.refundsTotal)})`,
      delta: `Taxa: ${refundRate}%`,
      deltaColor: 'text-red-600',
      arrow: '',
      bg: 'bg-red-100 border-red-300',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      icon: RefreshCcw,
    },
    {
      label: 'Taxa de Conversão',
      value: `${s.conversionRate}%`,
      delta: `${getDelta(s.conversionRate, p.conversionRate)} vs mês anterior`,
      deltaColor: getDeltaColor(s.conversionRate, p.conversionRate),
      arrow: s.conversionRate >= p.conversionRate ? '↑' : '↓',
      bg: 'bg-purple-100 border-purple-300',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      icon: TrendingUp,
    },
    {
      label: 'Carrinhos Abandonados',
      value: s.abandonedCarts.toString(),
      delta: `${getDelta(s.abandonedCarts, p.abandonedCarts)} vs mês anterior`,
      deltaColor: getDeltaColor(s.abandonedCarts, p.abandonedCarts, true),
      arrow: s.abandonedCarts >= p.abandonedCarts ? '↑' : '↓',
      bg: 'bg-teal-100 border-teal-300',
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600',
      icon: ShoppingBag,
    },
    {
      label: 'Comissões Pendentes',
      value: formatCents(s.pendingCommissions),
      delta: '',
      deltaColor: '',
      arrow: '',
      bg: 'bg-orange-100 border-orange-300',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      icon: Users,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral de receitas, vendas e métricas financeiras
          </p>
        </div>
      </div>

      {/* Tabs */}
      <PageTabs
        tabs={tabs}
        value={currentTab}
        onChange={handleTabChange}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon
          return (
            <Card key={index} className={`border ${kpi.bg}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1.5 rounded-md ${kpi.iconBg}`}>
                    <Icon className={`h-4 w-4 ${kpi.iconColor}`} />
                  </div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {kpi.label}
                  </div>
                </div>
                <div className="text-2xl font-extrabold mt-1">{kpi.value}</div>
                {kpi.delta && (
                  <div className={`text-xs mt-1 ${kpi.deltaColor}`}>
                    {kpi.arrow} {kpi.delta}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Revenue Chart */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">
            Receita Mensal (últimos 12 meses)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Vendas pagas agrupadas por mês
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonthLabel}
                    fontSize={12}
                    stroke="#9ca3af"
                  />
                  <YAxis
                    tickFormatter={formatAxisValue}
                    fontSize={12}
                    stroke="#9ca3af"
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCents(value), 'Receita']}
                    labelFormatter={formatMonthLabel}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar dataKey="total" fill="#f97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Nenhum dado de receita disponível
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
