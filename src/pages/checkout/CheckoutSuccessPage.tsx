import { useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function CheckoutSuccessPage() {
  usePageTitle('Compra Realizada')
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-10 pb-10 space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="text-green-600" size={64} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Compra realizada com sucesso!
          </h1>
          <p className="text-gray-600">
            Você receberá um email com os detalhes do seu acesso.
          </p>
          <Button
            onClick={() => navigate('/courses')}
            className="bg-green-600 hover:bg-green-700 text-white w-full"
          >
            Acessar meus cursos
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
