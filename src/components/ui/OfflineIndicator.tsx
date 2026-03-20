/**
 * Indicador de Status Offline
 * Mostra ao usuário quando está offline e sincronização pendente
 */

import { useState, useEffect } from 'react'
import { syncService } from '@/lib/syncService'
import { offlineStorage } from '@/lib/offlineStorage'
import { Wifi, WifiOff, CloudUpload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { logger } from '@/lib/logger'

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(syncService.getOnlineStatus())
  const [syncQueueSize, setSyncQueueSize] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<{
    synced: number
    failed: number
  } | null>(null)

  useEffect(() => {
    // Atualizar status online/offline
    const unsubscribe = syncService.addListener((online) => {
      setIsOnline(online)
      if (online) {
        // Quando voltar online, verificar fila
        checkSyncQueue()
      }
    })

    // Verificar fila inicialmente
    checkSyncQueue()

    // Verificar fila periodicamente
    const interval = setInterval(checkSyncQueue, 30000) // A cada 30 segundos

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const checkSyncQueue = async () => {
    const queue = await offlineStorage.getSyncQueue()
    setSyncQueueSize(queue.length)
  }

  const handleManualSync = async () => {
    if (isSyncing || !isOnline) return

    setIsSyncing(true)
    try {
      const result = await syncService.forceSyncNow()
      setLastSyncResult({
        synced: result.synced,
        failed: result.failed
      })
      await checkSyncQueue()

      // Limpar mensagem após 5 segundos
      setTimeout(() => setLastSyncResult(null), 5000)
    } catch (error) {
      logger.error('Erro ao sincronizar:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  // Não mostrar nada se estiver online e sem fila
  if (isOnline && syncQueueSize === 0 && !lastSyncResult) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-80 shadow-lg border-2">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {/* Ícone de status */}
            <div
              className={`p-2 rounded-full ${
                isOnline ? 'bg-green-100 dark:bg-green-950/50' : 'bg-red-100 dark:bg-red-950/50'
              }`}
            >
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-600" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-600" />
              )}
            </div>

            {/* Conteúdo */}
            <div className="flex-1">
              <p className="font-semibold text-sm">
                {isOnline ? 'Conectado' : 'Modo Offline'}
              </p>

              {syncQueueSize > 0 && (
                <p className="text-xs text-muted-foreground">
                  {syncQueueSize} {syncQueueSize === 1 ? 'item' : 'itens'} para
                  sincronizar
                </p>
              )}

              {lastSyncResult && (
                <p className="text-xs text-green-600">
                  {lastSyncResult.synced} sincronizado
                  {lastSyncResult.synced !== 1 ? 's' : ''}
                  {lastSyncResult.failed > 0 &&
                    `, ${lastSyncResult.failed} falha${lastSyncResult.failed !== 1 ? 's' : ''}`}
                </p>
              )}
            </div>

            {/* Botão de sincronização manual */}
            {isOnline && syncQueueSize > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="ml-2"
              >
                {isSyncing ? (
                  <CloudUpload className="h-4 w-4 animate-pulse" />
                ) : (
                  <CloudUpload className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          {/* Mensagem adicional quando offline */}
          {!isOnline && (
            <p className="mt-2 text-xs text-muted-foreground">
              Seus dados serão salvos localmente e sincronizados quando a
              conexão for restaurada.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
