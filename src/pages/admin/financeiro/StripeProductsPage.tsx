import { usePageTitle } from '@/hooks/usePageTitle'

export default function StripeProductsPage() {
  usePageTitle('Produtos')
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Em construção</h1>
      <p className="text-muted-foreground mt-2">A página de produtos está sendo desenvolvida.</p>
    </div>
  )
}
