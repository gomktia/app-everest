import { usePageTitle } from '@/hooks/usePageTitle'

export default function SalesListPage() {
  usePageTitle('Vendas')
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Em construção</h1>
      <p className="text-muted-foreground mt-2">A página de vendas está sendo desenvolvida.</p>
    </div>
  )
}
