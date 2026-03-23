import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { bulkInsertQuestions } from '@/services/adminQuizService'
import {
  parseQuestionBankFromFile,
  downloadTxtFile,
  QUESTION_BANK_TEMPLATE,
  type ImportError,
} from '@/lib/importExport'
import { ImportErrorsDialog } from '@/components/admin/ImportErrorsDialog'
import { Download, Upload, FileText } from 'lucide-react'

interface ImportQuestionsToQuizDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete: () => void
  quizId: string
  quizTitle: string
  entityLabel?: string // "simulado" or "quiz"
}

export const ImportQuestionsToQuizDialog = ({
  isOpen,
  onOpenChange,
  onImportComplete,
  quizId,
  quizTitle,
  entityLabel = 'quiz',
}: ImportQuestionsToQuizDialogProps) => {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [importErrors, setImportErrors] = useState<ImportError[]>([])
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async () => {
    if (!file) return

    setIsSubmitting(true)
    const content = await file.text()
    const result = parseQuestionBankFromFile(content)

    if (result.errors) {
      setImportErrors(result.errors)
      setIsErrorDialogOpen(true)
      setIsSubmitting(false)
      return
    }

    try {
      const questionsToInsert = result.data!.map((q) => ({
        quiz_id: quizId,
        question_text: q.question,
        options: q.options,
        correct_answer: q.answer,
        explanation: q.explanation,
        points: q.points,
        question_type: q.type,
      }))

      await bulkInsertQuestions(questionsToInsert)

      toast({
        title: 'Importação bem-sucedida!',
        description: `${result.data!.length} questões importadas para "${quizTitle}".`,
      })
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onImportComplete()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'Erro na importação',
        description: 'Não foi possível salvar as questões.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <ImportErrorsDialog
        errors={importErrors}
        isOpen={isErrorDialogOpen}
        onClose={() => setIsErrorDialogOpen(false)}
      />
      <Dialog open={isOpen} onOpenChange={onOpenChange} modal={false}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Importar Questões</DialogTitle>
            <DialogDescription>
              Importe questões em massa para o {entityLabel} "{quizTitle}".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Template info */}
            <div className="rounded-lg border border-dashed border-border p-4 bg-muted/30 space-y-3">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Formatos aceitos</p>
                  <p className="font-medium text-foreground text-xs mt-2">Formato simples:</p>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 whitespace-pre-wrap">
{`Q: Texto da pergunta
O1: Opção 1
O2: Opção 2
O3: Opção 3
O4: Opção 4
A: Opção 3`}
                  </pre>
                  <p className="font-medium text-foreground text-xs mt-2">Formato completo (separado por ---):</p>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 whitespace-pre-wrap">
{`QUESTION: Texto da pergunta
TYPE: multiple_choice
OPTIONS:
A) Opção 1
B) Opção 2
C) Opção 3
D) Opção 4
ANSWER: B
EXPLANATION: Explicação (opcional)
POINTS: 1`}
                  </pre>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => downloadTxtFile(QUESTION_BANK_TEMPLATE, `modelo-${entityLabel}.txt`)}
              >
                <Download className="mr-2 h-3.5 w-3.5" />
                Baixar Modelo (.txt)
              </Button>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label>Arquivo de Questões (.txt)</Label>
              <input
                type="file"
                accept=".txt"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 h-20 w-full rounded-md border-2 border-dashed border-input bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {file ? file.name : 'Clique para selecionar um arquivo .txt'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !file}>
              <Upload className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Importando...' : `Importar Questões`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
