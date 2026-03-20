import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================
// Types
// ============================================================

type Action = 'audit_questions' | 'explain_question' | 'generate_quiz' | 'lesson_chat' | 'study_plan'

interface RequestBody {
  action: Action
  // audit_questions
  questions?: Array<{
    id: string
    question_text: string
    options?: string[]
    correct_answer: string
    question_type: string
  }>
  // explain_question
  question_text?: string
  options?: string[]
  correct_answer?: string
  question_type?: string
  // generate_quiz
  content_text?: string
  num_questions?: number
  difficulty?: string
  gen_question_type?: string
  // lesson_chat
  question?: string
  lesson_content?: string
  lesson_title?: string
  module_name?: string
  // study_plan
  performance?: Record<string, unknown>
  available_hours_per_week?: number
  target_exam?: string
}

interface Provider {
  id: string
  provider: string
  display_name: string
  api_key: string
  model_name: string
  base_url: string | null
  is_active: boolean
  config: Record<string, unknown> | null
}

interface GeminiUsage {
  promptTokenCount: number
  candidatesTokenCount: number
}

// ============================================================
// Main Handler
// ============================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Extract user from auth header
    const authHeader = req.headers.get('Authorization')
    let userId: string | null = null
    if (authHeader) {
      const anonClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data: { user } } = await anonClient.auth.getUser()
      userId = user?.id ?? null
    }

    // 1. Get active AI provider
    const { data: provider, error: providerError } = await supabase
      .from('ai_provider_configs')
      .select('*')
      .eq('is_active', true)
      .single()

    if (providerError || !provider) {
      return new Response(
        JSON.stringify({ error: 'Nenhum provedor de IA ativo configurado. Configure em Admin > Integrações.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body: RequestBody = await req.json()

    // 2. Check kill switch from system_settings
    const { data: aiSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'ai_features')
      .single()

    if (aiSetting?.value) {
      const settings = typeof aiSetting.value === 'string'
        ? JSON.parse(aiSetting.value)
        : aiSetting.value

      if (settings.master === false) {
        return new Response(
          JSON.stringify({ error: 'Funcionalidades de IA estão desativadas pelo administrador.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const featureKey = body.action
      if (settings[featureKey] === false) {
        return new Response(
          JSON.stringify({ error: `A funcionalidade "${body.action}" está desativada pelo administrador.` }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 3. Check rate limit (count rows in ai_usage_log for this user in last 60 seconds)
    if (userId) {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
      const { count } = await supabase
        .from('ai_usage_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', oneMinuteAgo)

      // Default rate limit: 10 req/min; provider config may override
      const rateLimitPerMinute = (provider as Provider).config?.rate_limit_per_minute as number ?? 10
      if ((count ?? 0) >= rateLimitPerMinute) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições por minuto atingido. Aguarde um momento e tente novamente.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 4. Route to handler
    let result: Record<string, unknown>
    let usage: GeminiUsage = { promptTokenCount: 0, candidatesTokenCount: 0 }

    switch (body.action) {
      case 'audit_questions':
        ;({ result, usage } = await handleAuditQuestions(provider as Provider, body))
        break
      case 'explain_question':
        ;({ result, usage } = await handleExplainQuestion(provider as Provider, body))
        break
      case 'generate_quiz':
        ;({ result, usage } = await handleGenerateQuiz(provider as Provider, body))
        break
      case 'lesson_chat':
        ;({ result, usage } = await handleLessonChat(provider as Provider, body))
        break
      case 'study_plan':
        ;({ result, usage } = await handleStudyPlan(provider as Provider, body))
        break
      default:
        return new Response(
          JSON.stringify({ error: `Ação inválida: ${(body as RequestBody).action}. Use: audit_questions, explain_question, generate_quiz, lesson_chat, study_plan.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // 5. Log usage to ai_usage_log
    const tokensIn = usage.promptTokenCount
    const tokensOut = usage.candidatesTokenCount
    const costEstimateBrl = (tokensIn * 0.0000004) + (tokensOut * 0.0000016)

    await supabase.from('ai_usage_log').insert({
      user_id: userId,
      feature: body.action,
      tokens_input: tokensIn,
      tokens_output: tokensOut,
      cost_estimate_brl: costEstimateBrl,
      model: (provider as Provider).model_name,
    })

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================================
// Gemini API call (JSON mode)
// ============================================================

async function callGeminiJson(
  provider: Provider,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ text: string; usage: GeminiUsage }> {
  const apiKey = provider.api_key
  const model = provider.model_name || 'gemini-2.0-flash'

  if (!apiKey) {
    throw new Error(`API key não configurada para o provedor ${provider.provider}`)
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini API error (${response.status}): ${err}`)
  }

  const data = await response.json()
  const candidate = data.candidates?.[0]
  if (!candidate?.content?.parts?.[0]?.text) {
    throw new Error('Gemini não retornou resposta válida')
  }

  const usage: GeminiUsage = {
    promptTokenCount: data.usageMetadata?.promptTokenCount ?? 0,
    candidatesTokenCount: data.usageMetadata?.candidatesTokenCount ?? 0,
  }

  return { text: candidate.content.parts[0].text, usage }
}

function parseJsonResponse(text: string): Record<string, unknown> {
  let jsonStr = text.trim()
  // Remove markdown code blocks if present
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim()
  }
  // Find JSON object or array
  const jsonMatch = jsonStr.match(/^[\[{][\s\S]*[\]}]$/) || jsonStr.match(/[\[{][\s\S]*[\]}]/)
  if (!jsonMatch) {
    throw new Error('A IA não retornou JSON válido. Tente novamente.')
  }
  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    throw new Error('Erro ao processar resposta da IA. JSON inválido.')
  }
}

// ============================================================
// Action Handlers
// ============================================================

async function handleAuditQuestions(
  provider: Provider,
  body: RequestBody
): Promise<{ result: Record<string, unknown>; usage: GeminiUsage }> {
  if (!body.questions || body.questions.length === 0) {
    throw new Error('Campo obrigatório: questions (array de questões)')
  }

  const systemPrompt = `Você é um especialista em elaboração de questões para concursos militares brasileiros (CIAAR, CEBRASPE, ENEM).
Sua tarefa é auditar questões de concurso, verificando:
1. Erros de ortografia e gramática no enunciado e alternativas
2. Se a resposta correta indicada está realmente correta
3. Se as alternativas estão bem formuladas e sem ambiguidade
4. Gerar uma explicação didática para o gabarito

Responda EXCLUSIVAMENTE com JSON válido, sem markdown, sem texto adicional.`

  const userPrompt = `Audite as seguintes questões e retorne um JSON com esta estrutura exata:
{
  "results": [
    {
      "id": "id_da_questao",
      "question_text_fixed": "enunciado corrigido (ou igual ao original se não houver erros)",
      "options_fixed": ["alternativa A corrigida", "alternativa B corrigida"],
      "correct_answer_suspect": false,
      "suspect_reason": "motivo pelo qual a resposta correta parece errada, ou null se estiver correta",
      "explanation": "explicação detalhada de por que a resposta correta está certa e as demais estão erradas"
    }
  ]
}

QUESTÕES PARA AUDITAR:
${JSON.stringify(body.questions, null, 2)}`

  const { text, usage } = await callGeminiJson(provider, systemPrompt, userPrompt)
  const result = parseJsonResponse(text)
  return { result, usage }
}

async function handleExplainQuestion(
  provider: Provider,
  body: RequestBody
): Promise<{ result: Record<string, unknown>; usage: GeminiUsage }> {
  if (!body.question_text || !body.correct_answer) {
    throw new Error('Campos obrigatórios: question_text, correct_answer')
  }

  const systemPrompt = `Você é um professor especializado em concursos militares brasileiros (CIAAR, CEBRASPE) e em preparação para o ENEM.
Sua tarefa é explicar questões de forma clara, didática e objetiva, adequada para estudantes de nível médio a superior.
Responda EXCLUSIVAMENTE com JSON válido, sem markdown, sem texto adicional.`

  const optionsText = body.options && body.options.length > 0
    ? `\nAlternativas:\n${body.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')}`
    : ''

  const userPrompt = `Explique a questão abaixo. Retorne um JSON com esta estrutura exata:
{
  "explanation": "explicação completa: por que a resposta correta está certa, por que cada alternativa errada está errada (cite conceitos, regras ou fatos relevantes), e dicas para questões similares"
}

QUESTÃO:
Tipo: ${body.question_type || 'múltipla escolha'}
Enunciado: ${body.question_text}${optionsText}
Resposta correta: ${body.correct_answer}`

  const { text, usage } = await callGeminiJson(provider, systemPrompt, userPrompt)
  const result = parseJsonResponse(text)
  return { result, usage }
}

async function handleGenerateQuiz(
  provider: Provider,
  body: RequestBody
): Promise<{ result: Record<string, unknown>; usage: GeminiUsage }> {
  if (!body.content_text) {
    throw new Error('Campo obrigatório: content_text')
  }

  const numQuestions = body.num_questions ?? 5
  const difficulty = body.difficulty ?? 'medium'
  const questionType = body.gen_question_type ?? 'multiple_choice'

  const difficultyMap: Record<string, string> = {
    easy: 'fácil (conceitos básicos, vocabulário direto)',
    medium: 'médio (aplicação de conceitos, interpretação)',
    hard: 'difícil (análise crítica, situações complexas, interdisciplinaridade)',
  }
  const difficultyDesc = difficultyMap[difficulty] ?? difficulty

  const typeMap: Record<string, string> = {
    multiple_choice: 'múltipla escolha com 5 alternativas (A-E), apenas uma correta',
    true_false: 'verdadeiro ou falso',
    open: 'dissertativa/aberta',
  }
  const typeDesc = typeMap[questionType] ?? questionType

  const systemPrompt = `Você é um elaborador de questões especializado em concursos militares brasileiros (CIAAR: CADAR, CAMAR, CAFAR) e CEBRASPE.
Suas questões seguem o estilo dessas bancas: enunciados precisos, alternativas plausíveis, pegadinhas técnicas quando apropriado.
Responda EXCLUSIVAMENTE com JSON válido, sem markdown, sem texto adicional.`

  const userPrompt = `Com base no conteúdo abaixo, gere ${numQuestions} questão(ões) no estilo CIAAR/CEBRASPE.

Nível de dificuldade: ${difficultyDesc}
Tipo de questão: ${typeDesc}

Retorne um JSON com esta estrutura exata:
{
  "questions": [
    {
      "question_text": "enunciado da questão",
      "question_type": "${questionType}",
      "options": ["alternativa A", "alternativa B", "alternativa C", "alternativa D", "alternativa E"],
      "correct_answer": "letra ou texto da alternativa correta",
      "explanation": "por que esta é a resposta correta",
      "difficulty": "${difficulty}",
      "tags": ["tag1", "tag2"]
    }
  ]
}

Para questões verdadeiro/falso, options deve ser ["Verdadeiro", "Falso"].
Para questões dissertativas, options deve ser [] e correct_answer deve ser um gabarito esperado.

CONTEÚDO:
${body.content_text}`

  const { text, usage } = await callGeminiJson(provider, systemPrompt, userPrompt)
  const result = parseJsonResponse(text)
  return { result, usage }
}

async function handleLessonChat(
  provider: Provider,
  body: RequestBody
): Promise<{ result: Record<string, unknown>; usage: GeminiUsage }> {
  if (!body.question || !body.lesson_content) {
    throw new Error('Campos obrigatórios: question, lesson_content')
  }

  const systemPrompt = `Você é um assistente de estudos integrado a uma aula específica. Sua função é responder perguntas dos alunos EXCLUSIVAMENTE com base no conteúdo da aula fornecida.

REGRAS OBRIGATÓRIAS:
1. Responda APENAS com informações presentes no conteúdo da aula
2. Se a pergunta não estiver relacionada ao conteúdo da aula, recuse educadamente e oriente o aluno a focar no tema
3. Máximo de 200 palavras por resposta
4. Seja didático, claro e direto
5. Nunca invente informações que não estejam no conteúdo fornecido

Responda EXCLUSIVAMENTE com JSON válido, sem markdown, sem texto adicional.`

  const contextInfo = [
    body.module_name ? `Módulo: ${body.module_name}` : '',
    body.lesson_title ? `Aula: ${body.lesson_title}` : '',
  ].filter(Boolean).join('\n')

  const userPrompt = `${contextInfo ? contextInfo + '\n\n' : ''}CONTEÚDO DA AULA:
${body.lesson_content}

PERGUNTA DO ALUNO:
${body.question}

Retorne um JSON com esta estrutura exata:
{
  "answer": "sua resposta em até 200 palavras, ou mensagem de recusa se for fora do tema",
  "is_on_topic": true
}

Se a pergunta for fora do tema da aula, retorne is_on_topic: false e explique gentilmente que só pode responder sobre o conteúdo desta aula.`

  const { text, usage } = await callGeminiJson(provider, systemPrompt, userPrompt)
  const result = parseJsonResponse(text)
  return { result, usage }
}

async function handleStudyPlan(
  provider: Provider,
  body: RequestBody
): Promise<{ result: Record<string, unknown>; usage: GeminiUsage }> {
  if (!body.performance || body.available_hours_per_week === undefined) {
    throw new Error('Campos obrigatórios: performance, available_hours_per_week')
  }

  const targetExam = body.target_exam ?? 'concurso militar (CIAAR/CEBRASPE)'

  const systemPrompt = `Você é um coach de estudos especializado em aprovação em concursos militares brasileiros (CIAAR, ENEM, CEBRASPE).
Sua expertise inclui: planejamento de estudos, técnicas de memorização, gestão de tempo e diagnóstico de dificuldades.
Crie planos personalizados, realistas e motivadores.
Responda EXCLUSIVAMENTE com JSON válido, sem markdown, sem texto adicional.`

  const userPrompt = `Com base nos dados de desempenho do aluno, crie um plano de estudos personalizado para: ${targetExam}

DADOS DE DESEMPENHO:
${JSON.stringify(body.performance, null, 2)}

Horas disponíveis por semana: ${body.available_hours_per_week}h

Retorne um JSON com esta estrutura exata:
{
  "diagnosis": [
    {
      "subject": "nome da matéria",
      "level": "fraco | regular | bom | excelente",
      "priority": "alta | média | baixa",
      "observation": "observação sobre o desempenho nesta matéria"
    }
  ],
  "weekly_schedule": [
    {
      "day": "Segunda-feira",
      "sessions": [
        {
          "subject": "nome da matéria",
          "duration_minutes": 60,
          "focus": "tópico específico a estudar",
          "technique": "técnica recomendada (ex: leitura ativa, resolução de exercícios, revisão espaçada)"
        }
      ]
    }
  ],
  "tips": [
    "dica personalizada com base nos pontos fracos identificados"
  ]
}

O cronograma deve ser realista para ${body.available_hours_per_week}h/semana, priorizando matérias com maior peso no ${targetExam} e maior dificuldade do aluno.`

  const { text, usage } = await callGeminiJson(provider, systemPrompt, userPrompt)
  const result = parseJsonResponse(text)
  return { result, usage }
}
