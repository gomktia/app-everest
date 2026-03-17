import DOMPurify from 'dompurify'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface QuestionRendererProps {
  question: {
    id: string
    question_format: string
    question_text: string
    question_html?: string
    question_image_url?: string
    question_image_caption?: string
    options?: string[]
    options_rich?: Array<{
      id: string
      text: string
      html?: string
      imageUrl?: string
      isCorrect?: boolean
    }>
    difficulty?: string
    points?: number
  }
  answer?: any
  onAnswerChange?: (answer: any) => void
  showCorrectAnswer?: boolean
  correctAnswer?: any
  disabled?: boolean
}

export function QuestionRenderer({
  question,
  answer,
  onAnswerChange,
  showCorrectAnswer = false,
  correctAnswer,
  disabled = false,
}: QuestionRendererProps) {
  const renderQuestionContent = () => {
    return (
      <div className="space-y-4">
        {/* Question text with rich formatting */}
        <div className="space-y-3">
          {question.question_html ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(question.question_html) }}
            />
          ) : (
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {question.question_text}
            </p>
          )}

          {/* Question image */}
          {question.question_image_url && (
            <div className="space-y-2">
              <img
                src={question.question_image_url}
                alt="Imagem da questão"
                className="max-w-full h-auto rounded-lg border"
              />
              {question.question_image_caption && (
                <p className="text-sm text-muted-foreground italic">
                  {question.question_image_caption}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Metadata badges */}
        <div className="flex flex-wrap gap-2">
          {question.difficulty && (
            <Badge
              variant={
                question.difficulty === 'easy'
                  ? 'default'
                  : question.difficulty === 'medium'
                  ? 'secondary'
                  : 'destructive'
              }
            >
              {question.difficulty === 'easy' && 'Fácil'}
              {question.difficulty === 'medium' && 'Médio'}
              {question.difficulty === 'hard' && 'Difícil'}
              {question.difficulty === 'expert' && 'Expert'}
            </Badge>
          )}
          {question.points && (
            <Badge variant="outline">{question.points} ponto(s)</Badge>
          )}
        </div>
      </div>
    )
  }

  const renderOptions = () => {
    switch (question.question_format) {
      case 'multiple_choice':
        return (
          <RadioGroup
            value={answer ?? ""}
            onValueChange={onAnswerChange}
            disabled={disabled}
            className="space-y-3"
          >
            {question.options?.map((option, index) => {
              const optionLetter = String.fromCharCode(65 + index)
              const isCorrect = showCorrectAnswer && option === correctAnswer
              const isSelected = answer === option
              const isWrong = showCorrectAnswer && isSelected && !isCorrect

              return (
                <div
                  key={index}
                  className={cn(
                    'flex items-start space-x-3 p-4 rounded-lg border-2 transition-all',
                    isCorrect && 'border-green-500 bg-green-50 dark:bg-green-950',
                    isWrong && 'border-red-500 bg-red-50 dark:bg-red-950',
                    !showCorrectAnswer && isSelected && 'border-primary bg-primary/5',
                    !showCorrectAnswer && !isSelected && 'border-border hover:border-primary/50'
                  )}
                >
                  <RadioGroupItem value={option} id={`option-${index}`} />
                  <Label
                    htmlFor={`option-${index}`}
                    className="flex-1 cursor-pointer font-normal"
                  >
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">
                        {optionLetter}
                      </Badge>
                      <span className="flex-1">{option}</span>
                    </div>
                  </Label>
                </div>
              )
            })}
          </RadioGroup>
        )

      case 'true_false':
        return (
          <RadioGroup
            value={answer ?? ""}
            onValueChange={onAnswerChange}
            disabled={disabled}
            className="space-y-3"
          >
            {['true', 'false'].map((value) => {
              const isCorrect = showCorrectAnswer && value === correctAnswer
              const isSelected = answer === value
              const isWrong = showCorrectAnswer && isSelected && !isCorrect

              return (
                <div
                  key={value}
                  className={cn(
                    'flex items-start space-x-3 p-4 rounded-lg border-2 transition-all',
                    isCorrect && 'border-green-500 bg-green-50 dark:bg-green-950',
                    isWrong && 'border-red-500 bg-red-50 dark:bg-red-950',
                    !showCorrectAnswer && isSelected && 'border-primary bg-primary/5',
                    !showCorrectAnswer && !isSelected && 'border-border hover:border-primary/50'
                  )}
                >
                  <RadioGroupItem value={value} id={`tf-${value}`} />
                  <Label
                    htmlFor={`tf-${value}`}
                    className="flex-1 cursor-pointer font-normal"
                  >
                    {value === 'true' ? 'Verdadeiro' : 'Falso'}
                  </Label>
                </div>
              )
            })}
          </RadioGroup>
        )

      case 'multiple_response':
        return (
          <div className="space-y-3">
            {question.options_rich?.map((option, index) => {
              const selectedAnswers = answer || []
              const isSelected = selectedAnswers.includes(option.id)
              const isCorrect = showCorrectAnswer && option.isCorrect
              const isWrong = showCorrectAnswer && isSelected && !option.isCorrect

              return (
                <div
                  key={option.id}
                  className={cn(
                    'flex items-start space-x-3 p-4 rounded-lg border-2 transition-all',
                    isCorrect && 'border-green-500 bg-green-50 dark:bg-green-950',
                    isWrong && 'border-red-500 bg-red-50 dark:bg-red-950',
                    !showCorrectAnswer && isSelected && 'border-primary bg-primary/5',
                    !showCorrectAnswer && !isSelected && 'border-border hover:border-primary/50'
                  )}
                >
                  <Checkbox
                    id={`option-${option.id}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      if (disabled) return
                      const newAnswer = checked
                        ? [...selectedAnswers, option.id]
                        : selectedAnswers.filter((id: string) => id !== option.id)
                      onAnswerChange?.(newAnswer)
                    }}
                    disabled={disabled}
                  />
                  <Label
                    htmlFor={`option-${option.id}`}
                    className="flex-1 cursor-pointer font-normal"
                  >
                    <div className="space-y-2">
                      {option.html ? (
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(option.html) }}
                        />
                      ) : (
                        <p>{option.text}</p>
                      )}
                      {option.imageUrl && (
                        <img
                          src={option.imageUrl}
                          alt="Imagem da alternativa"
                          className="max-w-xs h-auto rounded border"
                        />
                      )}
                    </div>
                  </Label>
                </div>
              )
            })}
          </div>
        )

      case 'fill_blank':
      case 'essay':
        return (
          <textarea
            value={answer || ''}
            onChange={(e) => onAnswerChange?.(e.target.value)}
            disabled={disabled}
            className="w-full min-h-[200px] p-4 rounded-lg border-2 border-border focus:border-primary focus:outline-none resize-y"
            placeholder="Digite sua resposta aqui..."
          />
        )

      default:
        return (
          <p className="text-muted-foreground italic">
            Formato de questão não suportado: {question.question_format}
          </p>
        )
    }
  }

  return (
    <div className="space-y-6">
      {renderQuestionContent()}
      {renderOptions()}
    </div>
  )
}
