import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Share2,
  Twitter,
  MessageSquare,
  Copy,
  Trophy,
  Target,
  CheckCircle,
  XCircle,
  Sparkles,
  Instagram
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

interface ShareResultsDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  topicTitle: string
  correct: number
  total: number
}

export const ShareResultsDialog = ({
  isOpen,
  onOpenChange,
  topicTitle,
  correct,
  total,
}: ShareResultsDialogProps) => {
  const { toast } = useToast()
  const percentage = Math.round((correct / total) * 100)

  const getPerformanceEmoji = (percentage: number) => {
    if (percentage >= 90) return '🏆'
    if (percentage >= 80) return '⭐'
    if (percentage >= 70) return '🎯'
    if (percentage >= 60) return '📚'
    return '💪'
  }

  const getPerformanceText = (percentage: number) => {
    if (percentage >= 90) return 'Desempenho Excepcional'
    if (percentage >= 80) return 'Excelente Resultado'
    if (percentage >= 70) return 'Bom Desempenho'
    if (percentage >= 60) return 'Resultado Regular'
    return 'Continue Praticando'
  }

  const emoji = getPerformanceEmoji(percentage)
  const performanceText = getPerformanceText(percentage)

  const shareText = `${emoji} Acabei de completar uma sessão de flashcards sobre "${topicTitle}"!

📊 Resultado: ${correct}/${total} cards (${percentage}%)
🎯 ${performanceText}

#EverestPreparatorios #Flashcards #Estudos #Aprovacao`

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`)
      toast({
        title: 'Copiado para a área de transferência!',
        description: 'Agora você pode colar em qualquer lugar.',
      })
    } catch (error) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o texto.',
        variant: 'destructive',
      })
    }
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Meus resultados de estudo!',
          text: shareText,
          url: shareUrl,
        })
      } catch (error) {
        logger.error('Erro ao compartilhar:', error)
        toast({
          title: 'Compartilhamento cancelado',
          description: 'Você pode usar as outras opções abaixo.',
        })
      }
    } else {
      toast({
        title: 'Compartilhamento nativo não disponível',
        description: 'Use uma das opções abaixo.',
      })
    }
  }

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`
  
  // Instagram não tem URL de compartilhamento direto, mas podemos copiar texto otimizado
  const instagramText = `${emoji} ${topicTitle}

📊 ${correct}/${total} cards | ${percentage}%
🎯 ${performanceText}

#EverestPreparatorios #Flashcards #Estudos #Aprovacao #Concurso #ENEM #Vestibular #Foco #Dedicacao #Sucesso`

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2 text-xl md:text-2xl">
            <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-primary animate-pulse" />
            Compartilhe seu Progresso!
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Mostre aos seus amigos e colegas sua dedicação aos estudos e inspire outros a estudar também.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {/* Preview Card */}
        <Card className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-cyan-500/10 border-primary/20">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="text-4xl">{emoji}</div>
              <div>
                <h3 className="text-xl font-bold">{topicTitle}</h3>
                <p className="text-muted-foreground">Sessão de Flashcards</p>
              </div>

              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-2xl font-bold text-green-500">{correct}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Acertos</p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-2xl font-bold text-red-500">{total - correct}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Trophy className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold text-primary">{percentage}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Precisão</p>
                </div>
              </div>

              <Badge
                variant="outline"
                className={cn(
                  "text-sm px-3 py-1",
                  percentage >= 90 && "bg-purple-100 text-purple-600 border-purple-300",
                  percentage >= 80 && percentage < 90 && "bg-green-100 text-green-600 border-green-300",
                  percentage >= 70 && percentage < 80 && "bg-blue-100 text-blue-600 border-blue-300",
                  percentage >= 60 && percentage < 70 && "bg-yellow-100 text-yellow-600 border-yellow-300",
                  percentage < 60 && "bg-red-100 text-red-600 border-red-300"
                )}
              >
                {performanceText}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Share Options */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {typeof window !== 'undefined' && navigator.share && (
              <Button
                onClick={handleNativeShare}
                size="lg"
                className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              >
                <Share2 className="mr-2 h-5 w-5" />
                Compartilhar
              </Button>
            )}

            <Button onClick={handleCopyToClipboard} variant="outline" size="lg">
              <Copy className="mr-2 h-5 w-5" />
              Copiar Texto
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Button asChild variant="outline" size="lg" className="border-[#25D366]/30 hover:bg-[#25D366]/10">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageSquare className="mr-2 h-5 w-5 text-[#25D366]" />
                WhatsApp
              </a>
            </Button>

            <Button asChild variant="outline" size="lg" className="border-[#1DA1F2]/30 hover:bg-[#1DA1F2]/10">
              <a href={twitterUrl} target="_blank" rel="noopener noreferrer">
                <Twitter className="mr-2 h-5 w-5 text-[#1DA1F2]" />
                Twitter
              </a>
            </Button>

            <Button asChild variant="outline" size="lg" className="border-[#0088cc]/30 hover:bg-[#0088cc]/10">
              <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
                <svg className="mr-2 h-5 w-5 text-[#0088cc]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.141.121.099.154.232.17.326.016.094.036.306.02.472z"/>
                </svg>
                Telegram
              </a>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Button asChild variant="outline" size="lg" className="border-[#1877F2]/30 hover:bg-[#1877F2]/10">
              <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
                <svg className="mr-2 h-5 w-5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </a>
            </Button>

            <Button 
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(instagramText)
                  toast({
                    title: '📸 Texto copiado!',
                    description: 'Cole no Instagram e compartilhe sua conquista!',
                  })
                } catch (error) {
                  toast({
                    title: 'Erro ao copiar',
                    variant: 'destructive',
                  })
                }
              }}
              variant="outline" 
              size="lg" 
              className="border-[#E4405F]/30 hover:bg-[#E4405F]/10"
            >
              <Instagram className="mr-2 h-5 w-5 text-[#E4405F]" />
              Instagram
            </Button>

            <Button asChild variant="outline" size="lg" className="border-[#0A66C2]/30 hover:bg-[#0A66C2]/10">
              <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
                <svg className="mr-2 h-5 w-5 text-[#0A66C2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn
              </a>
            </Button>
          </div>
        </div>

        <div className="text-center text-xs md:text-sm text-muted-foreground pt-4 border-t">
          Compartilhar seus resultados motiva outros estudantes e mostra seu comprometimento! 🚀
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
