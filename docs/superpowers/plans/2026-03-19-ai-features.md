# AI Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 AI-powered features using Gemini Flash: question audit, quiz explanation, quiz generation from lessons, lesson chat, and AI study plan — with kill switch and cost monitoring.

**Architecture:** Single Edge Function `ai-assistant` handles all 5 actions. Features toggle on/off via `system_settings`. Usage tracked in `ai_usage_log` table. Client extracts PDF text and sends to Edge Function.

**Tech Stack:** Gemini 2.5 Flash, Supabase Edge Functions (Deno), React + TypeScript, pdf.js for PDF text extraction

**Spec:** `docs/superpowers/specs/2026-03-19-ai-features-design.md`

---

## File Structure

### New Files
| File | Purpose |
|------|---------|
| `supabase/functions/ai-assistant/index.ts` | Edge Function — routes 5 AI actions to Gemini |
| `src/services/ai/aiAssistantService.ts` | Client service — calls ai-assistant Edge Function |
| `src/services/ai/aiSettingsService.ts` | Read/write AI feature toggles from system_settings |
| `src/components/admin/AIFeaturesPanel.tsx` | Admin panel — feature toggles + usage dashboard |
| `src/components/admin/QuestionAuditModal.tsx` | Modal — audit questions with AI |
| `src/components/lessons/LessonAIChat.tsx` | Chat panel — student asks questions about lesson |
| `src/components/study-planner/AIStudyPlanGenerator.tsx` | Diagnostic + schedule generator |
| `src/lib/pdfTextExtractor.ts` | Extracts text from PDF URLs using pdf.js |
| `supabase/migrations/20260319_ai_features.sql` | DB migration — new columns + table |

### Modified Files
| File | Change |
|------|--------|
| `src/components/quizzes/QuizResult.tsx` | Add explanation display per question |
| `src/pages/QuestionBank.tsx` | Add "Auditar com IA" button in header |
| `src/components/admin/courses/LessonForm.tsx` | Add "Gerar Quiz com IA" button |
| `src/pages/courses/LessonPlayerPage.tsx` | Add AI chat tab |
| `src/pages/StudyPlannerPage.tsx` | Add "Gerar com IA" button |
| `src/pages/admin/integrations/AdminIntegrationsPage.tsx` | Add AIFeaturesPanel below AIProviderConfig |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260319_ai_features.sql`

- [ ] **Step 1: Write migration file**

```sql
-- AI Features: new columns and tables

-- 1. quiz_questions: add audit columns
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS ai_audited_at timestamptz;

-- 2. ai_usage_log: track all AI calls
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  feature text NOT NULL CHECK (feature IN ('audit', 'explain', 'quiz_gen', 'lesson_chat', 'study_plan')),
  tokens_input int DEFAULT 0,
  tokens_output int DEFAULT 0,
  cost_estimate_brl numeric(10,4) DEFAULT 0,
  model text DEFAULT 'gemini-2.5-flash',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Index for usage dashboard queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created ON ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature ON ai_usage_log(feature);

-- RLS for ai_usage_log (admin only read, Edge Function writes via service_role)
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read ai_usage_log" ON ai_usage_log
  FOR SELECT USING (
    get_auth_user_role() IN ('administrator', 'teacher')
  );

-- 3. Insert AI feature settings into system_settings
INSERT INTO system_settings (key, value) VALUES
  ('ai_features', '{
    "master": true,
    "audit": true,
    "lesson_chat": true,
    "quiz_gen": true,
    "study_plan": true,
    "rate_limit_per_minute": 10,
    "cost_alert_threshold": 500
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Push migration to Supabase**

Run: `npx supabase db push`
Expected: Migration applied successfully

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260319_ai_features.sql
git commit -m "feat: add AI features database migration"
```

---

## Task 2: AI Settings Service

**Files:**
- Create: `src/services/ai/aiSettingsService.ts`

- [ ] **Step 1: Create aiSettingsService**

```typescript
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export interface AIFeatureSettings {
  master: boolean
  audit: boolean
  lesson_chat: boolean
  quiz_gen: boolean
  study_plan: boolean
  rate_limit_per_minute: number
  cost_alert_threshold: number
}

const DEFAULT_SETTINGS: AIFeatureSettings = {
  master: true,
  audit: true,
  lesson_chat: true,
  quiz_gen: true,
  study_plan: true,
  rate_limit_per_minute: 10,
  cost_alert_threshold: 500,
}

export const aiSettingsService = {
  async getSettings(): Promise<AIFeatureSettings> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'ai_features')
        .single()

      if (error || !data) return DEFAULT_SETTINGS
      return { ...DEFAULT_SETTINGS, ...data.value }
    } catch (err) {
      logger.error('Error fetching AI settings:', err)
      return DEFAULT_SETTINGS
    }
  },

  async updateSettings(settings: Partial<AIFeatureSettings>): Promise<void> {
    try {
      const current = await this.getSettings()
      const updated = { ...current, ...settings }
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'ai_features',
          value: updated,
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        }, { onConflict: 'key' })

      if (error) throw error
    } catch (err) {
      logger.error('Error updating AI settings:', err)
      throw err
    }
  },

  isFeatureEnabled(settings: AIFeatureSettings, feature: keyof Omit<AIFeatureSettings, 'master' | 'rate_limit_per_minute' | 'cost_alert_threshold'>): boolean {
    return settings.master && settings[feature]
  },

  async getUsageStats(days: number = 30): Promise<{
    total_calls: number
    total_cost: number
    by_feature: Record<string, { calls: number; cost: number }>
  }> {
    try {
      const since = new Date()
      since.setDate(since.getDate() - days)

      const { data, error } = await supabase
        .from('ai_usage_log')
        .select('feature, cost_estimate_brl')
        .gte('created_at', since.toISOString())

      if (error) throw error

      const by_feature: Record<string, { calls: number; cost: number }> = {}
      let total_calls = 0
      let total_cost = 0

      for (const row of data || []) {
        total_calls++
        total_cost += Number(row.cost_estimate_brl) || 0
        if (!by_feature[row.feature]) {
          by_feature[row.feature] = { calls: 0, cost: 0 }
        }
        by_feature[row.feature].calls++
        by_feature[row.feature].cost += Number(row.cost_estimate_brl) || 0
      }

      return { total_calls, total_cost, by_feature }
    } catch (err) {
      logger.error('Error fetching AI usage stats:', err)
      return { total_calls: 0, total_cost: 0, by_feature: {} }
    }
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/ai/aiSettingsService.ts
git commit -m "feat: add AI settings service for feature toggles and usage stats"
```

---

## Task 3: PDF Text Extractor

**Files:**
- Create: `src/lib/pdfTextExtractor.ts`

- [ ] **Step 1: Install pdf.js**

Run: `npm install pdfjs-dist`

- [ ] **Step 2: Create pdfTextExtractor**

```typescript
import * as pdfjsLib from 'pdfjs-dist'

// Use CDN worker to avoid bundling issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

/**
 * Extracts all text from a PDF given its URL.
 * Returns plain text with pages separated by newlines.
 */
export async function extractTextFromPDF(pdfUrl: string): Promise<string> {
  const pdf = await pdfjsLib.getDocument(pdfUrl).promise
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item: any) => item.str)
      .join(' ')
    if (text.trim()) {
      pages.push(text.trim())
    }
  }

  return pages.join('\n\n')
}

/**
 * Extracts text from a PDF with a character limit.
 * Gemini Flash supports ~1M tokens but we cap at 50k chars to keep cost low.
 */
export async function extractTextFromPDFWithLimit(
  pdfUrl: string,
  maxChars: number = 50000
): Promise<string> {
  const fullText = await extractTextFromPDF(pdfUrl)
  if (fullText.length <= maxChars) return fullText
  return fullText.slice(0, maxChars) + '\n\n[... texto truncado por limite de tamanho]'
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdfTextExtractor.ts package.json package-lock.json
git commit -m "feat: add PDF text extractor using pdf.js"
```

---

## Task 4: Edge Function `ai-assistant`

**Files:**
- Create: `supabase/functions/ai-assistant/index.ts`

- [ ] **Step 1: Create the Edge Function**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AuditQuestion {
  id: string
  question_text: string
  options: any
  correct_answer: string
  question_type: string
}

interface RequestBody {
  action: 'audit_questions' | 'explain_question' | 'generate_quiz' | 'lesson_chat' | 'study_plan'
  // audit_questions
  questions?: AuditQuestion[]
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
  performance?: any
  available_hours_per_week?: number
  target_exam?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get active AI provider
    const { data: provider, error: providerError } = await supabase
      .from('ai_provider_configs')
      .select('*')
      .eq('is_active', true)
      .single()

    if (providerError || !provider) {
      return jsonResponse({ error: 'Nenhum provedor de IA ativo configurado.' }, 400)
    }

    // Check kill switch
    const { data: settingsRow } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'ai_features')
      .single()

    const settings = settingsRow?.value || { master: false }
    if (!settings.master) {
      return jsonResponse({ error: 'Features de IA desabilitadas pelo administrador.' }, 403)
    }

    const body: RequestBody = await req.json()

    // Extract user from auth header
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    const userId = user?.id

    // Rate limit check
    if (userId && settings.rate_limit_per_minute) {
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString()
      const { count } = await supabase
        .from('ai_usage_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', oneMinuteAgo)

      if ((count ?? 0) >= settings.rate_limit_per_minute) {
        return jsonResponse({ error: 'Limite de requisicoes atingido. Aguarde um momento.' }, 429)
      }
    }

    let result: any
    let feature: string

    switch (body.action) {
      case 'audit_questions':
        if (!settings.audit) return jsonResponse({ error: 'Auditoria de questoes desabilitada.' }, 403)
        feature = 'audit'
        result = await handleAudit(provider, body.questions || [])
        break
      case 'explain_question':
        feature = 'explain'
        result = await handleExplain(provider, body)
        break
      case 'generate_quiz':
        if (!settings.quiz_gen) return jsonResponse({ error: 'Geracao de quiz desabilitada.' }, 403)
        feature = 'quiz_gen'
        result = await handleGenerateQuiz(provider, body)
        break
      case 'lesson_chat':
        if (!settings.lesson_chat) return jsonResponse({ error: 'Chat de aula desabilitado.' }, 403)
        feature = 'lesson_chat'
        result = await handleLessonChat(provider, body)
        break
      case 'study_plan':
        if (!settings.study_plan) return jsonResponse({ error: 'Plano de estudos IA desabilitado.' }, 403)
        feature = 'study_plan'
        result = await handleStudyPlan(provider, body)
        break
      default:
        return jsonResponse({ error: 'Acao desconhecida.' }, 400)
    }

    // Log usage
    const tokensIn = result._tokens_input || 0
    const tokensOut = result._tokens_output || 0
    delete result._tokens_input
    delete result._tokens_output
    // Gemini Flash pricing: ~$0.075/1M input, ~$0.30/1M output (approx R$0.40/1M in, R$1.60/1M out)
    const costBrl = (tokensIn * 0.0000004) + (tokensOut * 0.0000016)

    await supabase.from('ai_usage_log').insert({
      user_id: userId,
      feature,
      tokens_input: tokensIn,
      tokens_output: tokensOut,
      cost_estimate_brl: Math.round(costBrl * 10000) / 10000,
      model: provider.model_name || 'gemini-2.5-flash',
    })

    return jsonResponse(result)
  } catch (err) {
    console.error('ai-assistant error:', err)
    return jsonResponse({ error: 'Erro interno do assistente de IA.' }, 500)
  }
})

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ─── GEMINI API CALL ────────────────────────────────────────────────

async function callGemini(provider: any, prompt: string, jsonMode = true): Promise<{ text: string; tokens_input: number; tokens_output: number }> {
  const model = provider.model_name || 'gemini-2.5-flash'
  const apiKey = provider.api_key

  const requestBody: any = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.3,
    },
  }

  if (jsonMode) {
    requestBody.generationConfig.responseMimeType = 'application/json'
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const usage = data.usageMetadata || {}

  return {
    text,
    tokens_input: usage.promptTokenCount || 0,
    tokens_output: usage.candidatesTokenCount || 0,
  }
}

// ─── HANDLERS ───────────────────────────────────────────────────────

async function handleAudit(provider: any, questions: AuditQuestion[]) {
  if (questions.length === 0) return { results: [] }

  const questionsText = questions.map((q, i) => {
    const opts = Array.isArray(q.options)
      ? q.options.map((o: string, j: number) => `  ${String.fromCharCode(65 + j)}) ${o}`).join('\n')
      : typeof q.options === 'object'
        ? Object.entries(q.options).map(([k, v]) => `  ${k}) ${v}`).join('\n')
        : String(q.options)
    return `QUESTAO ${i + 1} (id: ${q.id}, tipo: ${q.question_type}):
Enunciado: ${q.question_text}
Alternativas:
${opts}
Resposta marcada: ${q.correct_answer}`
  }).join('\n\n---\n\n')

  const prompt = `Voce e um revisor especialista de questoes para concursos militares brasileiros (CIAAR, ESFCEX, EsPCEx).
Para CADA questao abaixo, faca:
1. ORTOGRAFIA: Se houver erros de ortografia ou gramatica no enunciado ou alternativas, retorne o texto corrigido. Se nao houver erros, retorne null.
2. GABARITO: Verifique se a resposta marcada como correta esta realmente correta. Se tiver duvida ou se estiver errada, marque correct_answer_suspect=true com justificativa. Se estiver correta, correct_answer_suspect=false.
3. EXPLICACAO: Gere uma explicacao detalhada (3-5 frases) de por que a resposta correta esta certa e por que as principais alternativas erradas estao erradas.

Responda em JSON com esta estrutura exata:
{
  "results": [
    {
      "id": "uuid da questao",
      "question_text_fixed": "texto corrigido ou null se sem erros",
      "options_fixed": ["alternativas corrigidas"] ou null,
      "correct_answer_suspect": false,
      "suspect_reason": null,
      "explanation": "explicacao detalhada"
    }
  ]
}

QUESTOES:

${questionsText}`

  const { text, tokens_input, tokens_output } = await callGemini(provider, prompt)
  const parsed = JSON.parse(text)

  return {
    ...parsed,
    _tokens_input: tokens_input,
    _tokens_output: tokens_output,
  }
}

async function handleExplain(provider: any, body: RequestBody) {
  const opts = Array.isArray(body.options)
    ? body.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')
    : ''

  const prompt = `Voce e um professor especialista em concursos militares brasileiros.
Explique de forma clara e detalhada (3-5 frases) por que a resposta correta esta certa e por que as principais alternativas erradas estao erradas.

Questao (${body.question_type}):
${body.question_text}

Alternativas:
${opts}

Resposta correta: ${body.correct_answer}

Responda em JSON: { "explanation": "sua explicacao aqui" }`

  const { text, tokens_input, tokens_output } = await callGemini(provider, prompt)
  const parsed = JSON.parse(text)

  return {
    ...parsed,
    _tokens_input: tokens_input,
    _tokens_output: tokens_output,
  }
}

async function handleGenerateQuiz(provider: any, body: RequestBody) {
  const prompt = `Voce e um professor especialista em concursos militares brasileiros (CIAAR, ESFCEX, EsPCEx).
Com base no conteudo abaixo, crie ${body.num_questions || 10} questoes no estilo de prova.

Requisitos:
- Tipo: ${body.gen_question_type === 'true_false' ? 'Certo ou Errado (CEBRASPE)' : body.gen_question_type === 'mixed' ? 'Misto (multipla escolha e certo/errado)' : 'Multipla escolha com 5 alternativas (A-E)'}
- Dificuldade: ${body.difficulty || 'mixed'}
- Cada questao deve ter: enunciado claro, alternativas, resposta correta, e explicacao detalhada
- Varie os topicos abordados no conteudo

Responda em JSON:
{
  "questions": [
    {
      "question_text": "enunciado",
      "question_type": "multiple_choice" ou "true_false",
      "options": ["A) ...", "B) ...", ...],
      "correct_answer": "A",
      "explanation": "explicacao",
      "difficulty": 1-5,
      "tags": ["tag1", "tag2"]
    }
  ]
}

CONTEUDO DA AULA:

${body.content_text}`

  const { text, tokens_input, tokens_output } = await callGemini(provider, prompt)
  const parsed = JSON.parse(text)

  return {
    ...parsed,
    _tokens_input: tokens_input,
    _tokens_output: tokens_output,
  }
}

async function handleLessonChat(provider: any, body: RequestBody) {
  const prompt = `Voce e um tutor de um curso preparatorio para concursos militares brasileiros.
O aluno esta estudando a aula "${body.lesson_title}" do modulo "${body.module_name}".

REGRAS:
- Responda APENAS com base no conteudo da aula abaixo
- Se a pergunta NAO for relacionada ao conteudo, responda: "Essa duvida nao esta no conteudo desta aula. Tente perguntar algo relacionado ao tema da aula."
- Seja conciso (maximo 200 palavras)
- Use linguagem acessivel e didatica

CONTEUDO DA AULA:
${body.lesson_content}

PERGUNTA DO ALUNO:
${body.question}

Responda em JSON: { "answer": "sua resposta", "is_on_topic": true/false }`

  const { text, tokens_input, tokens_output } = await callGemini(provider, prompt)
  const parsed = JSON.parse(text)

  return {
    ...parsed,
    _tokens_input: tokens_input,
    _tokens_output: tokens_output,
  }
}

async function handleStudyPlan(provider: any, body: RequestBody) {
  const perfJson = JSON.stringify(body.performance, null, 2)

  const prompt = `Voce e um coach de estudos especialista em concursos militares brasileiros.
O aluno esta se preparando para: ${body.target_exam || 'concurso militar'}
Horas disponiveis por semana: ${body.available_hours_per_week || 20}

Com base no desempenho abaixo, crie:

1. DIAGNOSTICO: Para cada materia, indique nivel (fraco/medio/forte), % de acerto, e uma recomendacao especifica
2. CRONOGRAMA SEMANAL: Distribua as horas priorizando materias fracas. Use dias seg-dom com blocos de estudo
3. DICAS: 3-5 dicas especificas baseadas nos dados do aluno

DESEMPENHO DO ALUNO:
${perfJson}

Responda em JSON:
{
  "diagnosis": [
    { "subject": "materia", "accuracy_percent": 45, "level": "weak", "recommendation": "texto" }
  ],
  "weekly_schedule": [
    { "day": "Segunda", "blocks": [{ "subject": "materia", "hours": 2, "focus": "o que focar" }] }
  ],
  "tips": ["dica 1", "dica 2"]
}`

  const { text, tokens_input, tokens_output } = await callGemini(provider, prompt)
  const parsed = JSON.parse(text)

  return {
    ...parsed,
    _tokens_input: tokens_input,
    _tokens_output: tokens_output,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/ai-assistant/index.ts
git commit -m "feat: add ai-assistant Edge Function with 5 AI actions"
```

---

## Task 5: AI Assistant Client Service

**Files:**
- Create: `src/services/ai/aiAssistantService.ts`

- [ ] **Step 1: Create the client service**

```typescript
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export const aiAssistantService = {
  /**
   * Audit a batch of questions (max 10 at a time)
   */
  async auditQuestions(questions: {
    id: string
    question_text: string
    options: any
    correct_answer: string
    question_type: string
  }[]): Promise<{
    results: {
      id: string
      question_text_fixed: string | null
      options_fixed: string[] | null
      correct_answer_suspect: boolean
      suspect_reason: string | null
      explanation: string
    }[]
  }> {
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: { action: 'audit_questions', questions },
    })
    if (error) throw new Error(`Erro na auditoria: ${error.message}`)
    return data
  },

  /**
   * Generate explanation for a single question (fallback when no pre-generated explanation exists)
   */
  async explainQuestion(question: {
    question_text: string
    options: string[]
    correct_answer: string
    question_type: string
  }): Promise<{ explanation: string }> {
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: { action: 'explain_question', ...question },
    })
    if (error) throw new Error(`Erro ao gerar explicacao: ${error.message}`)
    return data
  },

  /**
   * Generate quiz questions from lesson content text
   */
  async generateQuiz(params: {
    content_text: string
    num_questions: number
    difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
    gen_question_type: 'multiple_choice' | 'true_false' | 'mixed'
  }): Promise<{
    questions: {
      question_text: string
      question_type: string
      options: string[]
      correct_answer: string
      explanation: string
      difficulty: number
      tags: string[]
    }[]
  }> {
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: { action: 'generate_quiz', ...params },
    })
    if (error) throw new Error(`Erro ao gerar quiz: ${error.message}`)
    return data
  },

  /**
   * Chat about a lesson — answer student question based on lesson PDF content
   */
  async lessonChat(params: {
    question: string
    lesson_content: string
    lesson_title: string
    module_name: string
  }): Promise<{ answer: string; is_on_topic: boolean }> {
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: { action: 'lesson_chat', ...params },
    })
    if (error) throw new Error(`Erro no chat: ${error.message}`)
    return data
  },

  /**
   * Generate AI-powered study plan based on student performance
   */
  async generateStudyPlan(params: {
    performance: any
    available_hours_per_week: number
    target_exam: string
  }): Promise<{
    diagnosis: { subject: string; accuracy_percent: number; level: string; recommendation: string }[]
    weekly_schedule: { day: string; blocks: { subject: string; hours: number; focus: string }[] }[]
    tips: string[]
  }> {
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: { action: 'study_plan', ...params },
    })
    if (error) throw new Error(`Erro ao gerar plano: ${error.message}`)
    return data
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/ai/aiAssistantService.ts
git commit -m "feat: add AI assistant client service"
```

---

## Task 6: Admin AI Features Panel (Kill Switch + Monitoring)

**Files:**
- Create: `src/components/admin/AIFeaturesPanel.tsx`
- Modify: `src/pages/admin/integrations/AdminIntegrationsPage.tsx:490-492`

- [ ] **Step 1: Create AIFeaturesPanel component**

This component shows:
- Toggle switches for each AI feature (master + individual)
- Usage stats: total calls, total cost this month
- Simple table of usage by feature

```typescript
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, Brain, MessageSquare, BookOpen, Target, Power } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { aiSettingsService, type AIFeatureSettings } from '@/services/ai/aiSettingsService'

const FEATURES = [
  { key: 'audit' as const, label: 'Auditar Questoes', desc: 'Revisar ortografia, gabarito e gerar explicacoes', icon: Target },
  { key: 'quiz_gen' as const, label: 'Gerar Quiz da Aula', desc: 'Criar questoes a partir do PDF/PPT', icon: BookOpen },
  { key: 'lesson_chat' as const, label: 'Tirar Duvida da Aula', desc: 'Chat do aluno limitado ao conteudo da aula', icon: MessageSquare },
  { key: 'study_plan' as const, label: 'Plano de Estudos IA', desc: 'Diagnostico e cronograma personalizado', icon: Brain },
]

export function AIFeaturesPanel() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<AIFeatureSettings | null>(null)
  const [usage, setUsage] = useState<{ total_calls: number; total_cost: number; by_feature: Record<string, { calls: number; cost: number }> } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      aiSettingsService.getSettings(),
      aiSettingsService.getUsageStats(30),
    ]).then(([s, u]) => {
      setSettings(s)
      setUsage(u)
      setLoading(false)
    })
  }, [])

  const handleToggle = async (key: string, value: boolean) => {
    if (!settings) return
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    try {
      await aiSettingsService.updateSettings({ [key]: value })
      toast({ title: value ? 'Feature ativada' : 'Feature desativada' })
    } catch {
      setSettings(settings) // rollback
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-500/10 to-purple-600/5">
            <Sparkles className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <CardTitle>Features de IA</CardTitle>
            <CardDescription>Controle as funcionalidades de IA do sistema</CardDescription>
          </div>
        </div>
        {usage && (
          <div className="text-right text-sm">
            <div className="font-semibold">{usage.total_calls} chamadas</div>
            <div className="text-muted-foreground">R$ {usage.total_cost.toFixed(2)} este mes</div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-3">
            <Power className="h-5 w-5 text-primary" />
            <div>
              <Label className="text-base font-semibold">Ativar todas as features IA</Label>
              <p className="text-xs text-muted-foreground">Desligar este toggle desabilita todas as features de uma vez</p>
            </div>
          </div>
          <Switch
            checked={settings?.master ?? false}
            onCheckedChange={(v) => handleToggle('master', v)}
          />
        </div>

        {/* Individual toggles */}
        <div className="space-y-3">
          {FEATURES.map(({ key, label, desc, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="font-medium">{label}</Label>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {usage?.by_feature[key] && (
                  <Badge variant="outline" className="text-xs">
                    {usage.by_feature[key].calls} chamadas
                  </Badge>
                )}
                <Switch
                  checked={settings?.[key] ?? false}
                  disabled={!settings?.master}
                  onCheckedChange={(v) => handleToggle(key, v)}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Add AIFeaturesPanel to AdminIntegrationsPage**

In `src/pages/admin/integrations/AdminIntegrationsPage.tsx`, after `<AIProviderConfigPanel />` (line 492), add:

```typescript
// Add import at top
import { AIFeaturesPanel } from '@/components/admin/AIFeaturesPanel'

// After line 492 (<AIProviderConfigPanel />), add:
<AIFeaturesPanel />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AIFeaturesPanel.tsx src/pages/admin/integrations/AdminIntegrationsPage.tsx
git commit -m "feat: add AI features kill switch and monitoring panel"
```

---

## Task 7: Question Audit Modal

**Files:**
- Create: `src/components/admin/QuestionAuditModal.tsx`
- Modify: `src/pages/QuestionBank.tsx:349-357` (add button, this is the student page — also check admin question bank)

- [ ] **Step 1: Create QuestionAuditModal**

Component that:
1. Lets admin choose scope: all / without explanation / recent
2. Shows progress bar during audit
3. Displays results summary
4. Applies fixes directly to database

```typescript
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { aiAssistantService } from '@/services/ai/aiAssistantService'
import { logger } from '@/lib/logger'

interface QuestionAuditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type AuditScope = 'all' | 'no_explanation' | 'recent'

interface AuditResult {
  total: number
  fixed_spelling: number
  generated_explanations: number
  suspect_answers: number
}

export function QuestionAuditModal({ open, onOpenChange }: QuestionAuditModalProps) {
  const { toast } = useToast()
  const [scope, setScope] = useState<AuditScope>('no_explanation')
  const [fixSpelling, setFixSpelling] = useState(true)
  const [generateExplanations, setGenerateExplanations] = useState(true)
  const [checkAnswers, setCheckAnswers] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [result, setResult] = useState<AuditResult | null>(null)

  const handleStart = async () => {
    setIsRunning(true)
    setProgress(0)
    setResult(null)

    try {
      // 1. Fetch questions based on scope
      let query = supabase
        .from('quiz_questions')
        .select('id, question_text, options, correct_answer, question_type, explanation')
        .order('created_at', { ascending: false })

      if (scope === 'no_explanation') {
        query = query.or('explanation.is.null,explanation.eq.')
      } else if (scope === 'recent') {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        query = query.gte('created_at', weekAgo.toISOString())
      }

      const { data: questions, error } = await query.limit(5000)
      if (error) throw error
      if (!questions || questions.length === 0) {
        toast({ title: 'Nenhuma questao encontrada para auditar' })
        setIsRunning(false)
        return
      }

      const total = questions.length
      const auditResult: AuditResult = { total, fixed_spelling: 0, generated_explanations: 0, suspect_answers: 0 }

      // 2. Process in batches of 10
      const batchSize = 10
      for (let i = 0; i < total; i += batchSize) {
        const batch = questions.slice(i, i + batchSize)
        setProgressText(`Auditando questoes ${i + 1}-${Math.min(i + batchSize, total)} de ${total}...`)
        setProgress(Math.round((i / total) * 100))

        try {
          const response = await aiAssistantService.auditQuestions(
            batch.map(q => ({
              id: q.id,
              question_text: q.question_text,
              options: q.options,
              correct_answer: q.correct_answer,
              question_type: q.question_type,
            }))
          )

          // 3. Apply results
          for (const r of response.results) {
            const updates: Record<string, any> = {
              ai_audited_at: new Date().toISOString(),
            }

            if (fixSpelling && r.question_text_fixed) {
              updates.question_text = r.question_text_fixed
              auditResult.fixed_spelling++
            }
            if (fixSpelling && r.options_fixed) {
              updates.options = r.options_fixed
            }
            if (generateExplanations && r.explanation) {
              updates.explanation = r.explanation
              auditResult.generated_explanations++
            }
            if (checkAnswers && r.correct_answer_suspect) {
              updates.needs_review = true
              auditResult.suspect_answers++
            }

            await supabase
              .from('quiz_questions')
              .update(updates)
              .eq('id', r.id)
          }
        } catch (err) {
          logger.error(`Erro no lote ${i}-${i + batchSize}:`, err)
          // Continue with next batch
        }
      }

      setProgress(100)
      setProgressText('Auditoria concluida!')
      setResult(auditResult)
    } catch (err) {
      logger.error('Erro na auditoria:', err)
      toast({ title: 'Erro ao executar auditoria', variant: 'destructive' })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Auditar Questoes com IA
          </DialogTitle>
        </DialogHeader>

        {!isRunning && !result && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Escopo</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as AuditScope)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as questoes</SelectItem>
                  <SelectItem value="no_explanation">Apenas sem explicacao</SelectItem>
                  <SelectItem value="recent">Apenas da ultima semana</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="spelling" checked={fixSpelling} onCheckedChange={(v) => setFixSpelling(!!v)} />
                <Label htmlFor="spelling">Corrigir ortografia automaticamente</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="explanations" checked={generateExplanations} onCheckedChange={(v) => setGenerateExplanations(!!v)} />
                <Label htmlFor="explanations">Gerar explicacoes</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="answers" checked={checkAnswers} onCheckedChange={(v) => setCheckAnswers(!!v)} />
                <Label htmlFor="answers">Verificar gabaritos</Label>
              </div>
            </div>
          </div>
        )}

        {isRunning && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{progressText}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {result && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-semibold">Auditoria concluida!</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <div className="text-2xl font-bold">{result.total}</div>
                <div className="text-xs text-muted-foreground">Questoes auditadas</div>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                <div className="text-2xl font-bold text-blue-600">{result.fixed_spelling}</div>
                <div className="text-xs text-muted-foreground">Ortografia corrigida</div>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 text-center">
                <div className="text-2xl font-bold text-green-600">{result.generated_explanations}</div>
                <div className="text-xs text-muted-foreground">Explicacoes geradas</div>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10 text-center">
                <div className="text-2xl font-bold text-orange-600">{result.suspect_answers}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Gabaritos suspeitos
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!isRunning && !result && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleStart}>
                <Sparkles className="mr-2 h-4 w-4" />
                Iniciar Auditoria
              </Button>
            </>
          )}
          {result && (
            <Button onClick={() => { setResult(null); onOpenChange(false) }}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Add audit button to admin question management page**

Find the admin quiz/question management page and add the "Auditar com IA" button + modal.
Look in: `src/pages/admin/quizzes/` for the admin question bank page.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/QuestionAuditModal.tsx
git commit -m "feat: add question audit modal with AI batch processing"
```

---

## Task 8: Quiz Result Explanation Display

**Files:**
- Modify: `src/components/quizzes/QuizResult.tsx:214-241` (AccordionContent for each question)

- [ ] **Step 1: Add explanation prop to Question interface**

In `QuizResult.tsx`, update the `Question` interface (line 28-33):

```typescript
interface Question {
  id: number | string
  question: string
  correctAnswer: string
  options: string[]
  explanation?: string  // ADD THIS
}
```

- [ ] **Step 2: Display explanation in question review**

After the "Resposta correta" div (line 238), add the explanation block:

```typescript
{/* After the !isCorrect block showing correct answer, add: */}

{/* Explanation */}
{q.explanation ? (
  <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
    <div className="flex items-center gap-2 mb-2">
      <Lightbulb className="h-4 w-4 text-blue-500" />
      <span className="text-sm font-semibold text-blue-600">Explicacao</span>
    </div>
    <p className="text-sm text-foreground leading-relaxed">{q.explanation}</p>
  </div>
) : !isCorrect ? (
  <ExplainWithAIButton questionId={q.id} question={q} />
) : null}
```

- [ ] **Step 3: Create ExplainWithAIButton inline component**

Add within QuizResult.tsx a small component that calls `aiAssistantService.explainQuestion()` for questions without pre-generated explanation:

```typescript
const ExplainWithAIButton = ({ questionId, question }: { questionId: string | number; question: Question }) => {
  const [explanation, setExplanation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleExplain = async () => {
    setLoading(true)
    try {
      const result = await aiAssistantService.explainQuestion({
        question_text: question.question,
        options: question.options,
        correct_answer: question.correctAnswer,
        question_type: 'multiple_choice',
      })
      setExplanation(result.explanation)
      // Save to DB for future use
      await supabase.from('quiz_questions').update({ explanation: result.explanation }).eq('id', questionId)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  if (explanation) {
    return (
      <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold text-blue-600">Explicacao</span>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{explanation}</p>
      </div>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExplain} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Sparkles className="mr-2 h-3 w-3" />}
      Explicar com IA
    </Button>
  )
}
```

- [ ] **Step 4: Pass explanation data from QuizResultSummaryPage**

In `src/pages/QuizResultSummaryPage.tsx`, ensure the `explanation` field is included when building the topic object for `<QuizResult>`. Check that the quiz data fetch includes `explanation` from `quiz_questions`.

- [ ] **Step 5: Commit**

```bash
git add src/components/quizzes/QuizResult.tsx src/pages/QuizResultSummaryPage.tsx
git commit -m "feat: show AI explanation for wrong quiz answers"
```

---

## Task 9: Generate Quiz from Lesson (Professor)

**Files:**
- Modify: `src/components/admin/courses/LessonForm.tsx` (add button + modal)

- [ ] **Step 1: Create GenerateQuizModal component**

Can be inline in LessonForm.tsx or a separate file. The modal:
1. Shows the attached PDF/PPT name
2. Lets professor choose: num questions, difficulty, type
3. Extracts text from PDF using `extractTextFromPDFWithLimit()`
4. Calls `aiAssistantService.generateQuiz()`
5. Shows preview of generated questions
6. Saves to `quiz_questions` via `quizService`

Key integration point: After generating, link the new quiz to the lesson via `video_lessons.quiz_id`.

- [ ] **Step 2: Add "Gerar Quiz com IA" button to LessonForm**

In the quiz section of `LessonForm.tsx` (near the quiz picker), add a button that opens the modal. Only show if the lesson has PDF/PPT attachments.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/courses/LessonForm.tsx
git commit -m "feat: add AI quiz generation from lesson PDF/PPT"
```

---

## Task 10: Lesson AI Chat

**Files:**
- Create: `src/components/lessons/LessonAIChat.tsx`
- Modify: `src/pages/courses/LessonPlayerPage.tsx:177,1534-1572`

- [ ] **Step 1: Create LessonAIChat component**

A simple chat panel:
- Text input + send button
- Shows AI response
- Each question is independent (no history)
- Extracts PDF text on first load, caches in state

```typescript
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Loader2, Send, Sparkles, Bot, User } from 'lucide-react'
import { aiAssistantService } from '@/services/ai/aiAssistantService'
import { extractTextFromPDFWithLimit } from '@/lib/pdfTextExtractor'
import { logger } from '@/lib/logger'

interface Message {
  role: 'user' | 'ai'
  text: string
}

interface LessonAIChatProps {
  lessonTitle: string
  moduleName: string
  attachments: { name: string; url: string; type: string }[]
}

export function LessonAIChat({ lessonTitle, moduleName, attachments }: LessonAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [lessonContent, setLessonContent] = useState<string | null>(null)
  const contentLoadedRef = useRef(false)

  const loadContent = async () => {
    if (contentLoadedRef.current) return lessonContent
    contentLoadedRef.current = true

    const pdfAttachment = attachments.find(a =>
      a.url?.endsWith('.pdf') || a.type?.includes('pdf')
    )
    if (!pdfAttachment) {
      setLessonContent('')
      return ''
    }

    try {
      const text = await extractTextFromPDFWithLimit(pdfAttachment.url)
      setLessonContent(text)
      return text
    } catch (err) {
      logger.error('Erro ao extrair texto do PDF:', err)
      setLessonContent('')
      return ''
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMessage }])
    setLoading(true)

    try {
      const content = await loadContent()
      if (!content) {
        setMessages(prev => [...prev, { role: 'ai', text: 'Nao foi possivel carregar o conteudo desta aula. Verifique se ha um PDF anexado.' }])
        return
      }

      const result = await aiAssistantService.lessonChat({
        question: userMessage,
        lesson_content: content,
        lesson_title: lessonTitle,
        module_name: moduleName,
      })

      setMessages(prev => [...prev, { role: 'ai', text: result.answer }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Desculpe, ocorreu um erro. Tente novamente.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full max-h-[500px]">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-purple-500" />
        <span className="font-semibold text-sm">Tirar Duvida com IA</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-[200px]">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Pergunte algo sobre o conteudo desta aula</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'ai' && <Bot className="h-5 w-5 text-purple-500 mt-1 shrink-0" />}
            <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 border border-border/50'
            }`}>
              {msg.text}
            </div>
            {msg.role === 'user' && <User className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <Bot className="h-5 w-5 text-purple-500 mt-1" />
            <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Digite sua duvida..."
          disabled={loading}
        />
        <Button size="icon" onClick={handleSend} disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add chat tab to LessonPlayerPage**

In `src/pages/courses/LessonPlayerPage.tsx`:

1. Update activeTab type (line 177): add `'ai_chat'`
2. Add tab button after Resources tab (line ~1572)
3. Add tab content that renders `<LessonAIChat>`
4. Only show if AI feature is enabled (check `aiSettingsService`)

- [ ] **Step 3: Commit**

```bash
git add src/components/lessons/LessonAIChat.tsx src/pages/courses/LessonPlayerPage.tsx
git commit -m "feat: add AI chat for lesson questions"
```

---

## Task 11: AI Study Plan Generator

**Files:**
- Create: `src/components/study-planner/AIStudyPlanGenerator.tsx`
- Modify: `src/pages/StudyPlannerPage.tsx:550-575`

- [ ] **Step 1: Create AIStudyPlanGenerator component**

A modal/dialog that:
1. Collects student performance data (automatic from DB)
2. Asks for available hours/week and target exam
3. Calls `aiAssistantService.generateStudyPlan()`
4. Displays diagnosis + schedule
5. Button to save schedule to study planner

The component needs to:
- Query `quiz_answers` + `quiz_questions` grouped by subject for quiz performance
- Query `flashcard_progress` + `flashcards` grouped by topic
- Query `pomodoro_sessions` or study planner for study hours
- Build the `performance` object and send to Edge Function

- [ ] **Step 2: Add "Gerar com IA" button to StudyPlannerPage header**

In `src/pages/StudyPlannerPage.tsx` around line 566 (near "Adicionar Conteudo" button), add:

```typescript
<Button onClick={() => setShowAIPlan(true)} variant="outline">
  <Sparkles className="mr-2 h-4 w-4" />
  Gerar com IA
</Button>
```

And render `<AIStudyPlanGenerator open={showAIPlan} onOpenChange={setShowAIPlan} />`.

- [ ] **Step 3: Commit**

```bash
git add src/components/study-planner/AIStudyPlanGenerator.tsx src/pages/StudyPlannerPage.tsx
git commit -m "feat: add AI study plan generator with diagnosis and schedule"
```

---

## Task 12: Integration Test & Deploy

- [ ] **Step 1: Deploy Edge Function**

Run: `npx supabase functions deploy ai-assistant --no-verify-jwt`

- [ ] **Step 2: Test each feature manually**

1. Admin > Integracoes > Verificar toggles on/off
2. Admin > Banco de Questoes > Auditar com IA (small batch of 10)
3. Aluno > Quiz > Resultado > Ver explicacao
4. Professor > Aula > Gerar Quiz com IA
5. Aluno > Aula > Tirar Duvida com IA
6. Aluno > Plano de Estudos > Gerar com IA

- [ ] **Step 3: Test kill switch**

1. Desligar master toggle
2. Verificar que todos os botoes de IA desaparecem
3. Religar e testar que voltam

- [ ] **Step 4: Final commit and push**

```bash
git add -A
git commit -m "feat: complete AI features integration — audit, explain, quiz gen, chat, study plan"
git push
```

---

## Execution Order

Tasks can be partially parallelized:

```
Task 1 (migration) ──→ Task 4 (Edge Function) ──→ Task 12 (deploy + test)
       │                        │
       └─→ Task 2 (settings) ──┤
       └─→ Task 3 (pdf.js) ────┤
       └─→ Task 5 (client svc) ┤
                                │
                   Task 6 (admin panel) ─┐
                   Task 7 (audit modal) ─┤
                   Task 8 (quiz result) ─┤──→ Task 12
                   Task 9 (quiz gen) ────┤
                   Task 10 (chat) ───────┤
                   Task 11 (study plan) ─┘
```

Tasks 1-5 are foundational. Tasks 6-11 are independent UI features that can be built in parallel. Task 12 is final integration.
