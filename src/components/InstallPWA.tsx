import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      const dismissedDate = new Date(dismissed)
      const now = new Date()
      const daysDiff = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
      
      if (daysDiff < 7) {
        return // Don't show for 7 days
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      
      // Show install prompt after 5 seconds
      setTimeout(() => {
        setShowInstallPrompt(true)
      }, 5000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      // PWA instalado
    }

    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    // Show again in 7 days
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString())
  }

  if (isInstalled || !showInstallPrompt || !deferredPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-fade-in-up">
      <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 rounded-2xl shadow-2xl border border-primary/20">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="font-bold mb-1 flex items-center gap-2">
              <Download className="h-5 w-5" />
              Instalar Everest
            </h3>
            <p className="text-sm text-white/90 mb-3">
              Adicione à tela inicial para acesso rápido e use offline!
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleInstallClick}
                size="sm"
                className="bg-white hover:bg-white/90 text-gray-900 font-semibold shadow-md"
              >
                Instalar Agora
              </Button>
              <Button
                onClick={handleDismiss}
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20 border border-white/30"
              >
                Depois
              </Button>
            </div>
          </div>
          <Button
            onClick={handleDismiss}
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

