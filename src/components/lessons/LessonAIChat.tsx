import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Send, Bot, Loader2 } from 'lucide-react'
import { aiAssistantService } from '@/services/ai/aiAssistantService'
import { extractTextFromPDFWithLimit } from '@/lib/pdfTextExtractor'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'

interface LessonAIChatProps {
  lessonTitle: string
  moduleName: string
  attachments: { name: string; url: string; type?: string }[]
}

interface Message {
  id: string
  role: 'user' | 'ai'
  content: string
}

export function LessonAIChat({ lessonTitle, moduleName, attachments }: LessonAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [lessonContent, setLessonContent] = useState<string | null>(null)
  const [contentError, setContentError] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const pdfAttachments = attachments.filter(
    (a) =>
      a.type?.includes('pdf') ||
      a.name?.toLowerCase().endsWith('.pdf')
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function ensureLessonContent(): Promise<string | null> {
    if (lessonContent !== null) return lessonContent
    if (pdfAttachments.length === 0) {
      setContentError(true)
      return null
    }

    try {
      const text = await extractTextFromPDFWithLimit(pdfAttachments[0].url)
      setLessonContent(text)
      return text
    } catch (err) {
      logger.error('Erro ao extrair texto do PDF da aula:', err)
      setContentError(true)
      return null
    }
  }

  async function handleSend() {
    const question = input.trim()
    if (!question || isLoading) return

    setInput('')
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
    }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const content = await ensureLessonContent()
      if (content === null) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'ai',
            content: 'Nao foi possivel carregar o conteudo desta aula.',
          },
        ])
        return
      }

      const result = await aiAssistantService.lessonChat({
        question,
        lesson_content: content,
        lesson_title: lessonTitle,
        module_name: moduleName,
      })

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'ai',
          content: result.answer,
        },
      ])
    } catch (err) {
      logger.error('Erro no chat de IA da aula:', err)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'ai',
          content: 'Ocorreu um erro ao processar sua pergunta. Tente novamente.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Tirar Duvida com IA</h3>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-[200px] mb-4 pr-1">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Bot className="h-7 w-7 text-primary/60" />
            </div>
            <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
              Pergunte algo sobre o conteudo desta aula
            </p>
            {contentError && (
              <p className="text-xs text-destructive mt-2">
                Nao foi possivel carregar o conteudo desta aula
              </p>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-2 items-start',
              msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            )}
          >
            {msg.role === 'ai' && (
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-muted text-foreground rounded-tl-sm'
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2 items-start">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-muted px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
              <span className="text-sm text-muted-foreground">Pensando...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-center bg-white dark:bg-card border border-border/40 rounded-xl px-3 py-2 shadow-sm">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Digite sua duvida sobre esta aula..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          disabled={isLoading}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="h-8 w-8 p-0 shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
