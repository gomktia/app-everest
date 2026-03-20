import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, Sparkles, Crown, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { getSupportWhatsAppUrl } from '@/lib/constants'

interface LockedContentOverlayProps {
  message?: string
  variant?: 'card' | 'page' | 'inline'
  showBenefits?: boolean
  upgradeUrl?: string | null
  className?: string
}

/**
 * Overlay para conteúdo bloqueado (trial)
 */
export const LockedContentOverlay = ({
  message = 'Este conteúdo está disponível apenas para assinantes',
  variant = 'card',
  showBenefits = false,
  upgradeUrl,
  className,
}: LockedContentOverlayProps) => {
  const navigate = useNavigate()

  const handleUpgrade = () => {
    if (upgradeUrl) {
      window.open(upgradeUrl, '_blank')
    } else {
      window.open(getSupportWhatsAppUrl(), '_blank')
    }
  }

  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-300 dark:border-yellow-800',
          className
        )}
      >
        <Lock className="h-5 w-5 text-yellow-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
            {message}
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleUpgrade}
          className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
        >
          <Crown className="h-3 w-3 mr-1" />
          {upgradeUrl ? 'Comprar' : 'Falar com suporte'}
        </Button>
      </div>
    )
  }

  if (variant === 'page') {
    return (
      <div
        className={cn(
          'min-h-[60vh] flex items-center justify-center p-8',
          className
        )}
      >
        <div className="max-w-2xl w-full text-center space-y-8">
          {/* Ícone */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full blur-2xl opacity-20 animate-pulse" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-300 dark:border-yellow-800 flex items-center justify-center">
                <Lock className="h-12 w-12 text-yellow-600" />
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-950/50 border-yellow-300 dark:border-yellow-800 text-yellow-600">
                <Crown className="h-3 w-3 mr-1" />
                Conteúdo Premium
              </Badge>
            </div>

            <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
              Desbloqueie Este Conteúdo
            </h2>

            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              {message}
            </p>
          </div>

          {/* Benefícios */}
          {showBenefits && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                <Sparkles className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Acesso Total</h3>
                <p className="text-xs text-muted-foreground">
                  Todas as matérias e tópicos
                </p>
              </div>
              <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                <Zap className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Sem Limites</h3>
                <p className="text-xs text-muted-foreground">
                  Quizzes e flashcards ilimitados
                </p>
              </div>
              <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                <Crown className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Suporte Premium</h3>
                <p className="text-xs text-muted-foreground">
                  Atendimento prioritário
                </p>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button
              size="lg"
              onClick={handleUpgrade}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white px-8 py-6 text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all"
            >
              <Crown className="h-5 w-5 mr-2" />
              {upgradeUrl ? 'Adquirir Acesso Completo' : 'Falar com Suporte'}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="text-muted-foreground"
            >
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // variant === 'card'
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-yellow-300 dark:border-yellow-800 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 p-6',
        className
      )}
    >
      {/* Blur effect */}
      <div className="absolute inset-0 backdrop-blur-sm bg-background/80" />

      {/* Content */}
      <div className="relative z-10 space-y-4 text-center">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-300 dark:border-yellow-800">
            <Lock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div>
          <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-950/50 border-yellow-300 dark:border-yellow-800 text-yellow-600 mb-2">
            <Crown className="h-3 w-3 mr-1" />
            Premium
          </Badge>
          <h3 className="text-xl font-bold mb-2">Conteúdo Bloqueado</h3>
          <p className="text-sm text-muted-foreground">
            {message}
          </p>
        </div>

        <Button
          onClick={handleUpgrade}
          className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white w-full"
        >
          <Crown className="h-4 w-4 mr-2" />
          {upgradeUrl ? 'Adquirir Acesso' : 'Falar com Suporte'}
        </Button>
      </div>
    </div>
  )
}

/**
 * Badge para indicar conteúdo bloqueado em listas
 */
export const LockedBadge = () => {
  return (
    <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-950/50 border-yellow-300 dark:border-yellow-800 text-yellow-600">
      <Lock className="h-3 w-3 mr-1" />
      Premium
    </Badge>
  )
}

/**
 * Botão desabilitado com indicação de bloqueio
 */
interface LockedButtonProps {
  label?: string
  message?: string
  upgradeUrl?: string | null
  onClick?: () => void
}

export const LockedButton = ({
  label = 'Iniciar',
  message = 'Faça upgrade para acessar',
  upgradeUrl,
}: LockedButtonProps) => {
  const handleUpgrade = () => {
    if (upgradeUrl) {
      window.open(upgradeUrl, '_blank')
    } else {
      window.open(getSupportWhatsAppUrl(), '_blank')
    }
  }

  return (
    <div className="space-y-2">
      <Button
        disabled
        className="w-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-700 dark:text-yellow-400 cursor-not-allowed relative overflow-hidden"
      >
        <Lock className="h-4 w-4 mr-2" />
        {label}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        {message} •{' '}
        <button
          onClick={handleUpgrade}
          className="text-yellow-600 hover:text-yellow-700 underline font-medium"
        >
          {upgradeUrl ? 'Comprar' : 'Suporte'}
        </button>
      </p>
    </div>
  )
}
