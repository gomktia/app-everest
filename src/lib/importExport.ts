interface FlashcardData {
  question: string
  answer: string
}

interface QuizQuestionData {
  question: string
  options: string[]
  correctAnswer: string
}

export interface QuestionBankData {
  question: string
  options: string[]
  answer: string
  explanation?: string
  points: number
  type: string
}

export interface ImportError {
  line: number
  message: string
}

export interface ParseResult<T> {
  data: T[] | null
  errors: ImportError[] | null
}

export const formatFlashcardsForExport = (
  flashcards: FlashcardData[],
): string => {
  return flashcards
    .map((fc) => `Q: ${fc.question}\nA: ${fc.answer}`)
    .join('\n\n')
}

export const parseFlashcardsFromFile = (
  fileContent: string,
): ParseResult<FlashcardData> => {
  if (fileContent.trim() === '') {
    return { data: [], errors: null }
  }

  const lines = fileContent.split(/\r?\n/)
  const flashcards: FlashcardData[] = []
  const errors: ImportError[] = []
  let i = 0

  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === '') {
      i++
    }
    if (i >= lines.length) break

    const blockStartLine = i + 1
    let question: string | null = null
    let answer: string | null = null

    if (lines[i].startsWith('Q: ')) {
      question = lines[i].substring(3).trim()
      i++
    } else {
      errors.push({
        line: i + 1,
        message: 'Bloco inválido. Esperava uma pergunta começando com "Q: ".',
      })
      while (i < lines.length && lines[i].trim() !== '') {
        i++
      }
      continue
    }

    if (i < lines.length && lines[i].startsWith('A: ')) {
      answer = lines[i].substring(3).trim()
      i++
    } else {
      errors.push({
        line: i < lines.length ? i + 1 : i,
        message: `Pergunta na linha ${blockStartLine} não tem uma resposta correspondente (deve começar com "A: ").`,
      })
      while (i < lines.length && lines[i].trim() !== '') {
        i++
      }
      continue
    }

    if (!question) {
      errors.push({ line: blockStartLine, message: 'Pergunta está vazia.' })
    }
    if (!answer) {
      errors.push({ line: blockStartLine + 1, message: 'Resposta está vazia.' })
    }

    if (question && answer) {
      flashcards.push({ question, answer })
    }
  }

  if (errors.length > 0) {
    return { data: null, errors }
  }

  if (flashcards.length === 0) {
    return {
      data: null,
      errors: [
        {
          line: 1,
          message:
            'Nenhum flashcard válido encontrado. Verifique o formato do arquivo.',
        },
      ],
    }
  }

  return { data: flashcards, errors: null }
}

export const formatQuizQuestionsForExport = (
  questions: QuizQuestionData[],
): string => {
  return questions
    .map((q) => {
      const options = q.options.map((opt, i) => `O${i + 1}: ${opt}`).join('\n')
      return `Q: ${q.question}\n${options}\nA: ${q.correctAnswer}`
    })
    .join('\n\n')
}

export const parseQuizQuestionsFromFile = (
  fileContent: string,
): ParseResult<QuizQuestionData> => {
  if (fileContent.trim() === '') {
    return { data: [], errors: null }
  }

  const lines = fileContent.split(/\r?\n/)
  const questions: QuizQuestionData[] = []
  const errors: ImportError[] = []
  let i = 0

  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === '') {
      i++
    }
    if (i >= lines.length) break

    const blockStartLine = i + 1
    let question: string | null = null
    const options: string[] = []
    let correctAnswer: string | null = null
    let blockHasErrors = false

    if (i < lines.length && lines[i].startsWith('Q: ')) {
      question = lines[i].substring(3).trim()
      if (!question) {
        errors.push({ line: i + 1, message: 'Pergunta está vazia.' })
        blockHasErrors = true
      }
      i++
    } else {
      errors.push({
        line: i + 1,
        message: 'Bloco inválido. Esperava uma pergunta começando com "Q: ".',
      })
      blockHasErrors = true
      while (i < lines.length && lines[i].trim() !== '') i++
      continue
    }

    // Parse options O1: through O5: (supports 4 or 5 options)
    for (let j = 1; j <= 5; j++) {
      const optionPrefix = `O${j}: `
      if (i < lines.length && lines[i].startsWith(optionPrefix)) {
        const optionText = lines[i].substring(optionPrefix.length).trim()
        if (!optionText) {
          errors.push({ line: i + 1, message: `Opção ${j} está vazia.` })
          blockHasErrors = true
        }
        options.push(optionText)
        i++
      } else if (j <= 4) {
        // O1-O4 are required, O5 is optional
        errors.push({
          line: i + 1,
          message: `Esperava a opção ${j} (começando com "${optionPrefix}").`,
        })
        blockHasErrors = true
      }
    }

    if (i < lines.length && lines[i].startsWith('A: ')) {
      correctAnswer = lines[i].substring(3).trim()
      if (!correctAnswer) {
        errors.push({ line: i + 1, message: 'Resposta está vazia.' })
        blockHasErrors = true
      } else if (!options.includes(correctAnswer)) {
        errors.push({
          line: i + 1,
          message:
            'A resposta correta não corresponde a nenhuma das opções fornecidas.',
        })
        blockHasErrors = true
      }
      i++
    } else {
      errors.push({
        line: i + 1,
        message: `Questão na linha ${blockStartLine} não tem uma resposta (deve começar com "A: ").`,
      })
      blockHasErrors = true
      while (i < lines.length && lines[i].trim() !== '') i++
      continue
    }

    if (!blockHasErrors) {
      questions.push({
        question: question!,
        options,
        correctAnswer: correctAnswer!,
      })
    }
  }

  if (errors.length > 0) {
    return { data: null, errors }
  }

  if (questions.length === 0) {
    return {
      data: null,
      errors: [
        {
          line: 1,
          message:
            'Nenhuma questão válida encontrada. Verifique o formato do arquivo.',
        },
      ],
    }
  }

  return { data: questions, errors: null }
}

export const parseQuestionBankFromFile = (
  fileContent: string,
): ParseResult<QuestionBankData> => {
  if (fileContent.trim() === '') {
    return { data: [], errors: null }
  }

  const questions: QuestionBankData[] = []
  const errors: ImportError[] = []
  const blocks = fileContent
    .split('---')
    .map((b) => b.trim())
    .filter(Boolean)
  let lineOffset = 0

  for (const block of blocks) {
    const lines = block.split(/\r?\n/)
    const blockStartLine = lineOffset + 1
    let hasError = false

    const getValue = (prefix: string) => {
      const line = lines.find((l) => l.startsWith(prefix))
      return line ? line.substring(prefix.length).trim() : null
    }

    const question = getValue('QUESTION:')
    if (!question) {
      errors.push({
        line: blockStartLine,
        message: 'Campo "QUESTION:" não encontrado ou vazio.',
      })
      hasError = true
    }

    const type = getValue('TYPE:') || 'multiple_choice'
    let options: string[] = []
    let answer: string | null = null

    if (type === 'multiple_choice') {
      const optionsBlockIndex = lines.findIndex((l) => l.startsWith('OPTIONS:'))
      if (optionsBlockIndex !== -1) {
        for (let i = optionsBlockIndex + 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (/^[A-Z]\)/.test(line)) {
            options.push(line.substring(line.indexOf(')') + 1).trim())
          } else {
            break
          }
        }
      }
      if (options.length === 0) {
        errors.push({
          line: blockStartLine,
          message:
            'Campo "OPTIONS:" não encontrado para questão de múltipla escolha.',
        })
        hasError = true
      }
      const answerLetter = getValue('ANSWER:')
      if (answerLetter) {
        const answerIndex = answerLetter.charCodeAt(0) - 'A'.charCodeAt(0)
        if (answerIndex >= 0 && answerIndex < options.length) {
          answer = options[answerIndex]
        } else {
          errors.push({
            line: blockStartLine,
            message: `Letra da resposta "${answerLetter}" é inválida.`,
          })
          hasError = true
        }
      } else {
        errors.push({
          line: blockStartLine,
          message: 'Campo "ANSWER:" não encontrado.',
        })
        hasError = true
      }
    } else {
      answer = getValue('ANSWER:')
      if (!answer) {
        errors.push({
          line: blockStartLine,
          message: 'Campo "ANSWER:" não encontrado para questão dissertativa.',
        })
        hasError = true
      }
    }

    const explanation = getValue('EXPLANATION:') || undefined
    const points = parseInt(getValue('POINTS:') || '1', 10)

    if (!hasError) {
      questions.push({
        question: question!,
        options,
        answer: answer!,
        explanation,
        points,
        type,
      })
    }

    lineOffset += lines.length + 1
  }

  if (errors.length > 0) {
    return { data: null, errors }
  }

  return { data: questions, errors: null }
}

// ─── Templates ─────────────────────────────────────────────────────────────

export const QUESTION_BANK_TEMPLATE = `QUESTION: Qual é a capital do Brasil?
TYPE: multiple_choice
OPTIONS:
A) São Paulo
B) Rio de Janeiro
C) Brasília
D) Salvador
ANSWER: C
EXPLANATION: Brasília é a capital federal do Brasil desde 1960.
POINTS: 1

---

QUESTION: Em que ano o Brasil foi descoberto?
TYPE: multiple_choice
OPTIONS:
A) 1492
B) 1500
C) 1532
D) 1549
ANSWER: B
EXPLANATION: Pedro Álvares Cabral chegou ao Brasil em 22 de abril de 1500.
POINTS: 1

---

QUESTION: Quem escreveu "Dom Casmurro"?
TYPE: multiple_choice
OPTIONS:
A) José de Alencar
B) Machado de Assis
C) Clarice Lispector
D) Guimarães Rosa
ANSWER: B
EXPLANATION: Machado de Assis publicou Dom Casmurro em 1899.
POINTS: 1
`

export const FLASHCARD_TEMPLATE = `Q: Qual é a fórmula da água?
A: H2O - duas moléculas de hidrogênio e uma de oxigênio.

Q: O que é fotossíntese?
A: Processo pelo qual as plantas convertem luz solar em energia química, produzindo oxigênio e glicose.

Q: Qual a velocidade da luz no vácuo?
A: Aproximadamente 300.000 km/s (299.792.458 m/s).
`

export const downloadTxtFile = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
