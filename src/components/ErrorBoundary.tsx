import React, { Component, ErrorInfo, ReactNode } from 'react'
import * as Sentry from '@sentry/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { logger } from '@/lib/logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Error caught by boundary:', error, errorInfo)
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="mx-auto mt-8 max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Algo deu errado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente recarregar a página ou contate o suporte se o problema persistir.
            </p>
            <div className="flex gap-2">
              <Button onClick={this.handleRetry} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
              <Button onClick={() => window.location.reload()} size="sm">
                Recarregar página
              </Button>
            </div>
            {this.state.error && process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Detalhes do erro (dev)
                </summary>
                <pre className="mt-2 text-xs overflow-auto p-2 bg-muted rounded">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
