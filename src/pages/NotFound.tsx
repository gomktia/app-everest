import { useLocation, Link } from 'react-router-dom'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { logger } from '@/lib/logger'
import {
  Home,
  ArrowLeft,
  Search,
  AlertTriangle,
  Compass,
  Sparkles,
  Zap
} from 'lucide-react'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    logger.error(
      '404 Error: User attempted to access non-existent route:',
      location.pathname,
    )
  }, [location.pathname])

  return (
    <div className="space-y-6">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-8">
          {/* 404 Error Display */}
          <Card className="border-border shadow-sm">
            <CardContent className="text-center py-16">
              <div className="space-y-8">
                {/* Error Icon */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
                      <AlertTriangle className="h-16 w-16 text-primary" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                      <span className="text-2xl font-bold text-orange-600">4</span>
                    </div>
                    <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                      <span className="text-2xl font-bold text-orange-600">4</span>
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                <div className="space-y-4">
                  <h1 className="text-6xl font-bold text-foreground">
                    Oops!
                  </h1>
                  <h2 className="text-2xl font-semibold text-foreground">
                    Página não encontrada
                  </h2>
                  <p className="text-muted-foreground text-lg max-w-md mx-auto">
                    A página que você está procurando não existe ou foi movida para outro local.
                  </p>
                  <div className="text-sm text-muted-foreground font-mono bg-muted/50 px-3 py-2 rounded-lg inline-block">
                    {location.pathname}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild className="px-8 py-3 rounded-xl font-semibold hover:shadow-md inline-flex items-center justify-center">
                    <Link to="/">
                      <Home className="mr-2 h-4 w-4" />
                      Voltar ao Início
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.history.back()}
                    className="px-8 py-3 rounded-xl font-semibold hover:shadow-md"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Página Anterior
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Help Section */}
          <Card className="border-border shadow-sm">
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-2">Precisa de ajuda?</h3>
                  <p className="text-muted-foreground">
                    Tente uma dessas opções para encontrar o que procura
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-xl bg-blue-100 border border-blue-300">
                    <Search className="h-8 w-8 text-blue-500 mx-auto mb-3" />
                    <h4 className="font-semibold mb-2">Buscar</h4>
                    <p className="text-sm text-muted-foreground">
                      Use a busca para encontrar conteúdo
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-green-100 border border-green-300">
                    <Compass className="h-8 w-8 text-green-500 mx-auto mb-3" />
                    <h4 className="font-semibold mb-2">Navegar</h4>
                    <p className="text-sm text-muted-foreground">
                      Explore as categorias principais
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-purple-100 border border-purple-300">
                    <Sparkles className="h-8 w-8 text-purple-500 mx-auto mb-3" />
                    <h4 className="font-semibold mb-2">Descobrir</h4>
                    <p className="text-sm text-muted-foreground">
                      Veja o que há de novo no sistema
                    </p>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/dashboard">Dashboard</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/courses">Cursos</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/quizzes">Quizzes</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/flashcards">Flashcards</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/redacoes">Redações</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default NotFound
