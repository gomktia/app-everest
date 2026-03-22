import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = Deno.env.get('APP_URL') || 'https://app.everestpreparatorios.com.br'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  action: 'correct' | 'transcribe'
  essayText?: string
  theme?: string
  correctionTemplate?: Record<string, unknown>
  studentName?: string
  imageUrls?: string[]
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

    // Get active AI provider (using service_role to read api_key)
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

    if (body.action === 'transcribe') {
      const text = await handleTranscribe(provider, body.imageUrls || [])
      return new Response(
        JSON.stringify({ text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (body.action === 'correct') {
      const result = await handleCorrection(provider, body)
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida. Use "correct" ou "transcribe".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
// Provider-specific API calls
// ============================================================

async function callProvider(
  provider: Record<string, unknown>,
  systemPrompt: string,
  userPrompt: string,
  imageUrls?: string[]
): Promise<string> {
  const providerType = provider.provider as string
  const apiKey = provider.api_key as string
  const model = provider.model_name as string
  const baseUrl = provider.base_url as string | null

  if (!apiKey) {
    throw new Error(`API key não configurada para o provedor ${providerType}`)
  }

  if (providerType === 'claude') {
    return await callClaude(apiKey, model || 'claude-sonnet-4-5-20250514', systemPrompt, userPrompt, imageUrls)
  }
  if (providerType === 'openai') {
    return await callOpenAI(apiKey, model || 'gpt-4o', baseUrl, systemPrompt, userPrompt, imageUrls)
  }
  if (providerType === 'antigravity') {
    return await callOpenAI(apiKey, model || 'default', baseUrl || 'https://api.antigravity.ai/v1', systemPrompt, userPrompt, imageUrls)
  }
  if (providerType === 'gemini') {
    return await callGemini(apiKey, model || 'gemini-2.5-flash', systemPrompt, userPrompt, imageUrls)
  }
  if (providerType === 'dify') {
    return await callDify(apiKey, baseUrl || 'https://api.dify.ai/v1', systemPrompt, userPrompt)
  }

  throw new Error(`Provedor não suportado: ${providerType}`)
}

async function callClaude(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  imageUrls?: string[]
): Promise<string> {
  const content: Record<string, unknown>[] = []

  if (imageUrls && imageUrls.length > 0) {
    for (const url of imageUrls) {
      content.push({
        type: 'image',
        source: { type: 'url', url },
      })
    }
  }
  content.push({ type: 'text', text: userPrompt })

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error (${response.status}): ${err}`)
  }

  const data = await response.json()
  return data.content[0].text
}

async function callOpenAI(
  apiKey: string,
  model: string,
  baseUrl: string | null,
  systemPrompt: string,
  userPrompt: string,
  imageUrls?: string[]
): Promise<string> {
  const messages: Record<string, unknown>[] = [
    { role: 'system', content: systemPrompt },
  ]

  if (imageUrls && imageUrls.length > 0) {
    const userContent: Record<string, unknown>[] = imageUrls.map((url) => ({
      type: 'image_url',
      image_url: { url },
    }))
    userContent.push({ type: 'text', text: userPrompt })
    messages.push({ role: 'user', content: userContent })
  } else {
    messages.push({ role: 'user', content: userPrompt })
  }

  const url = `${baseUrl || 'https://api.openai.com/v1'}/chat/completions`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error (${response.status}): ${err}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  imageUrls?: string[]
): Promise<string> {
  const parts: Record<string, unknown>[] = []

  if (imageUrls && imageUrls.length > 0) {
    for (const url of imageUrls) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: await fetchImageAsBase64(url),
        },
      })
    }
  }
  parts.push({ text: userPrompt })

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        maxOutputTokens: 65536,
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
  return candidate.content.parts[0].text
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Erro ao baixar imagem: ${response.status}`)
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function callDify(
  apiKey: string,
  baseUrl: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch(`${baseUrl}/chat-messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      inputs: {},
      query: `${systemPrompt}\n\n${userPrompt}`,
      response_mode: 'blocking',
      user: 'everest-correction',
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Dify API error (${response.status}): ${err}`)
  }

  const data = await response.json()
  return data.answer
}

// ============================================================
// Action Handlers
// ============================================================

function buildCorrectionSystemPrompt(_template: Record<string, unknown>): string {
  const expressionDebit = _template.expression_debit_value || 0.200
  const maxGrade = _template.max_grade || 10

  return `# CONTEXTO
Você é o melhor corretor de redação para os concursos da Força Aérea Brasileira (CIAAR: CADAR, CAMAR, CAFAR, etc.). Seu propósito é auxiliar na correção detalhada de redações, com base nos critérios mais rigorosos e nos referenciais teóricos consagrados.

# PERSONALIDADE
Você é técnico, meticuloso, crítico e didático. Sua análise é imparcial, focada em aprimorar a escrita do aluno. Demonstre ser um especialista com embasamento teórico sólido, oferecendo feedback construtivo e preciso. Sua comunicação é profissional e clara.

# REFERENCIAL TEÓRICO OBRIGATÓRIO
Suas correções e comentários serão fundamentados nos seguintes autores:
- CEGALLA, Domingos Paschoal. Novíssima Gramática da Língua Portuguesa. (Referência para gramática normativa, ortografia, pontuação, concordância, regência, crase, etc.)
- FIORIN, José Luiz; SAVIOLI, Francisco Platão. Para entender o texto: leitura e redação. (Referência para compreensão textual, coesão, coerência, estrutura dissertativa, argumentação e interpretação.)
- KOCH, Ingedore Villaça; ELIAS, Maria Vanda. Ler e Compreender: os sentidos do texto. (Referência para análise dos sentidos do texto, progressão temática, relações semânticas, construção de sentido, intertextualidade, etc.)

# FLUXO DE CORREÇÃO (MÉTODO)

A nota de partida do aluno é ${maxGrade}.

## 1. ERROS DE EXPRESSÃO
- Critério: Analisar TODOS os erros gramaticais (acentuação gráfica, morfologia, sintaxe, concordância verbal/nominal, regência, crase, ortografia, pontuação obrigatória, etc.).
- Débito: Cada erro gramatical conta -${expressionDebit} da nota final. Ajustes de estilo, clareza ou sugestões de reescrita, maior espaçamento entre palavras, bem como erros não gramaticais e de estilo não geram débitos, mas devem ser apontados nas sugestões de melhoria.
- REGRAS ESPECIAIS:
  - Considere como ERRO o uso do pronome relativo "onde" quando o antecedente NÃO indica lugar físico.
  - Considere como ERRO o uso de "Isto", "Este", "Neste" e variáveis quando utilizados para dar continuidade ao período anterior. O correto é "Nesse", "Nisso" e variáveis.
- Use o formato "P{n}, Per. {m}" para referenciar erros (P = parágrafo, Per = período).

## 2. ERROS DE ESTRUTURA
- Débito: Cada problema estrutural gera -0,500 de débito.
- Cada parágrafo deve ter no mínimo 3 períodos completos (oração encerrada por ponto final). A ausência gera débito.
- Verificar presença e adequação dos conectivos conforme especificações abaixo:

### Parágrafo 1 (Introdução):
  - Período 1: Apresentação temática neutra (alusão histórica, fatos, dados, exemplos, conceitos).
  - Período 2: Indicação da TESE (opinião do autor, com marcas de autoria/modalizadores).
  - Período 3: Indicação do desfecho do parágrafo.
  - Conectivos esperados entre P1 (TEMA) e P2 (TESE): Nesse contexto, Nesse viés, Nesse prisma, Nessa perspectiva, Nesse diapasão, Nesse ínterim.
  - Conectivos esperados entre P2 e P3 (DESFECHO): Dessa forma, Logo, Assim, Desse modo, Por conseguinte, Destarte, Sendo assim.

### Parágrafo 2 (Desenvolvimento 1):
  - Período 1: Indicação clara do argumento.
  - Período 2: Apresentação de elemento de informatividade.
  - Período 3: Desfecho com conclusão do parágrafo.
  - Conectivos entre Introdução e Dev1: Nesse contexto, Nesse viés, Nesse prisma, Nessa perspectiva, Nesse diapasão, Nesse ínterim.
  - Conectivos entre P1 (ARG) e P2 (INFO): Isso pode ser visto, Isso pode ser evidenciado, Esse fato se observa, Essa questão se comprova.
  - Conectivos entre P2 e P3 (DESFECHO): Dessa forma, Logo, Assim, Desse modo, Por conseguinte, Destarte, Sendo assim.

### Parágrafo 3 (Desenvolvimento 2):
  - Período 1: Indicação clara do argumento.
  - Período 2: Apresentação de elemento de informatividade.
  - Período 3: Desfecho com conclusão do parágrafo.
  - Conectivos entre Dev1 e Dev2 (Mesma Polaridade): Ademais, Outrossim, Em soma, Além disso, Somado a isso, Ainda.
  - Conectivos entre Dev1 e Dev2 (Polaridade Diversa): Porém, Todavia, Entretanto, Contudo, Em contraponto, Não obstante, Em contrapartida.
  - Conectivos entre P1 (ARG) e P2 (INFO): Tal fato pode ser identificado, Tal aspecto se mostra claro, Tal apontamento se apresenta.
  - Conectivos entre P2 e P3 (DESFECHO): Dessa forma, Logo, Assim, Desse modo, Por conseguinte, Destarte, Sendo assim.

### Parágrafo 4 (Conclusão):
  - Período 1: Retomada do tema/tese.
  - Período 2: Proposta de solução.
  - Período 3: Indicação dos resultados esperados.
  - Conectivos entre Dev2 e Conclusão: Portanto, Logo, Assim, Com isso, Diante do exposto, Dessa forma, Em suma, Em síntese, Por fim.
  - Conectivos entre P1 (RETOMADA) e P2 (PROPOSTA): Portanto, é urgente que...; Logo, é necessário que...; Assim, torna-se primordial que...; Com isso, mostra-se fundamental que...; Diante do exposto, urge que...; Dessa forma, é vital que...; Em suma, é latente que...; Em síntese, torna-se importante que...; Por fim, evidencia-se como crucial que...
  - Conectivos entre P2 (PROPOSTA) e P3 (RESULTADOS): Assim, será possível amenizar...; Com isso, estaremos próximos de reverter...; Diante do exposto, tais problemáticas estarão mais próximas de uma solução...

## 3. ERROS DE CONTEÚDO
A TESE (opinião do aluno) deve estar preferencialmente no segundo período do parágrafo introdutório, ou, ao menos, presente durante o parágrafo de introdução, com marcas de autoria (modalizadores: advérbios e adjetivos).

### 3.1 Pertinência ao tema
- Se o texto aborda o tema proposto, e se a TESE e os argumentos abrangem os aspectos temáticos.
- Níveis de Débito:
  - Fuga TOTAL do tema: Redação recebe 0,000 de grau final (mesmo assim, continue a correção completa para feedback).
  - Grande fuga do tema: -1,500
  - Média fuga do tema: -1,000
  - Leve fuga do tema: -0,400
  - Totalmente pertinente ao tema: -0,000

### 3.2 Argumentação Coerente
- Se os argumentos apresentam resposta/explicação da TESE/OPINIÃO, ou trazem causas/consequências do afirmado na TESE.
- Níveis de Débito:
  - Não apresenta resposta/explicação: -1,500
  - Um responde e outro não, ou ambos vagos: -1,000
  - Ambos ou um indiretamente responde: -0,500
  - Ambos claros e detalhados: -0,000

### 3.3 Informatividade
- Presença e produtividade de elementos como alusões históricas, citações, dados, exemplos correlatos, analogias. Produtividade significa relação clara com tema/argumentos.
- Níveis de Débito:
  - Não há elementos produtivos: -1,500
  - Há somente um elemento produtivo: -1,000
  - Há dois elementos produtivos: -0,200
  - Há três ou mais elementos produtivos: -0,000

## 4. SUGESTÕES DETALHADAS DE MELHORIA
Oferecer sugestões práticas e ilustrativas, com exemplos de reescrita, teses, argumentos viáveis e elementos de informatividade produtivos, baseadas nos erros e ausências do texto do aluno.
- expression: sugestões específicas com base nos erros de expressão, incluindo exemplos de reescrita e citando regras gramaticais dos autores de referência.
- structure: o que se espera de cada parte (introdução, desenvolvimento, conclusão), com exemplos de reescrita.
- content: o que se espera da TESE (opinião, modalizadores, localização), dos argumentos (explicações, causas, consequências), da informatividade (elementos produtivos). Incluir exemplos de teses viáveis, argumentos e elementos de informatividade que o aluno poderia ter usado.

# INSTRUÇÃO FINAL
Se a redação apresentar fuga TOTAL do tema, atribua 0,000 de nota final, mas continue a correção completa (Expressão, Estrutura, Conteúdo e Sugestões) para que o aluno receba feedback sobre todos os aspectos da escrita.

## FORMATO DE RESPOSTA
Responda EXCLUSIVAMENTE com um JSON válido. Sem texto adicional, sem markdown code blocks. APENAS o JSON puro.`
}

function buildCorrectionUserPrompt(
  essayText: string,
  theme: string,
  studentName?: string
): string {
  const header = studentName ? `ALUNO: ${studentName}\n` : ''
  return `${header}TEMA DA REDAÇÃO: ${theme}

TEXTO DA REDAÇÃO:
${essayText}

Analise esta redação seguindo rigorosamente todos os critérios do sistema (Expressão, Estrutura, Conteúdo e Sugestões) e retorne o resultado como JSON com esta estrutura exata:
{
  "expressionErrors": [
    {
      "paragraph_number": 1,
      "sentence_number": 1,
      "error_text": "trecho EXATO copiado do texto do aluno",
      "error_explanation": "explicação detalhada do erro com base gramatical (cite a regra e o autor de referência quando pertinente)",
      "suggested_correction": "forma correta sugerida",
      "debit_value": 0.200
    }
  ],
  "structureAnalysis": [
    {
      "paragraph_number": 1,
      "paragraph_type": "introduction",
      "analysis_text": "Análise detalhada: verificar se há 3 períodos, se os conectivos estão adequados conforme a lista esperada, e se cada período cumpre sua função (Tema/Tese/Desfecho para introdução, Argumento/Informatividade/Desfecho para desenvolvimento, Retomada/Proposta/Resultados para conclusão). Citar quais conectivos o aluno usou e quais seriam mais adequados.",
      "debit_value": 0.000
    },
    {"paragraph_number": 2, "paragraph_type": "development_1", "analysis_text": "...", "debit_value": 0.000},
    {"paragraph_number": 3, "paragraph_type": "development_2", "analysis_text": "...", "debit_value": 0.000},
    {"paragraph_number": 4, "paragraph_type": "conclusion", "analysis_text": "...", "debit_value": 0.000}
  ],
  "contentAnalysis": [
    {
      "criterion_type": "pertinence",
      "criterion_name": "Pertinência ao tema",
      "analysis_text": "Análise detalhada da pertinência, incluindo a clareza e localização da TESE, se há projeto de texto (TESE + ARG1 + ARG2), e se os argumentos abrangem os aspectos temáticos.",
      "debit_level": "Totalmente pertinente | Leve fuga | Média fuga | Grande fuga | Fuga TOTAL",
      "debit_value": 0.000
    },
    {
      "criterion_type": "argumentation",
      "criterion_name": "Argumentação coerente",
      "analysis_text": "Análise detalhada dos argumentos em relação à TESE, se apresentam resposta/explicação, causas/consequências. Citar tópicos frasais.",
      "debit_level": "Ambos claros e detalhados | Ambos ou um indiretamente responde | Um responde e outro não, ou ambos vagos | Não apresenta resposta/explicação",
      "debit_value": 0.000
    },
    {
      "criterion_type": "informativity",
      "criterion_name": "Informatividade",
      "analysis_text": "Análise detalhada dos elementos de informatividade (alusões históricas, citações, dados, exemplos, analogias) e sua produtividade (relação com tema/argumentos). Listar cada elemento encontrado.",
      "debit_level": "Três ou mais elementos produtivos | Dois elementos produtivos | Somente um elemento produtivo | Não há elementos produtivos",
      "debit_value": 0.000
    }
  ],
  "improvementSuggestions": [
    {
      "category": "expression",
      "suggestion_text": "Sugestões específicas com exemplos de reescrita para cada erro de expressão. Citar regras gramaticais dos autores de referência (Cegalla, Fiorin/Savioli, Koch/Elias)."
    },
    {
      "category": "structure",
      "suggestion_text": "O que se espera de cada parte: Introdução (3 períodos: tema, tese com modalizadores, desfecho); Desenvolvimento (argumento, informatividade, desfecho); Conclusão (retomada, proposta de solução, resultados). Exemplos de reescrita para as partes problemáticas."
    },
    {
      "category": "content",
      "suggestion_text": "O que se espera da TESE (opinião com modalizadores no P2 da introdução), dos argumentos (explicações/causas/consequências da tese), da informatividade (elementos produtivos). Incluir exemplos concretos de teses viáveis, argumentos e elementos de informatividade que o aluno poderia ter usado para este tema."
    }
  ],
  "totalExpressionDebit": 0.000,
  "totalStructureDebit": 0.000,
  "totalContentDebit": 0.000,
  "finalGrade": 10.000
}

IMPORTANTE: Preencha debit_level com o nível exato escolhido dentre as opções listadas. Se "Fuga TOTAL" for selecionado em pertinência, finalGrade DEVE ser 0.000.`
}

async function handleCorrection(
  provider: Record<string, unknown>,
  body: RequestBody
): Promise<Record<string, unknown>> {
  if (!body.essayText || !body.theme || !body.correctionTemplate) {
    throw new Error('Dados obrigatórios: essayText, theme, correctionTemplate')
  }

  const systemPrompt = buildCorrectionSystemPrompt(body.correctionTemplate)
  const userPrompt = buildCorrectionUserPrompt(body.essayText, body.theme, body.studentName)

  const responseText = await callProvider(provider, systemPrompt, userPrompt)

  // Parse JSON from AI response (may be wrapped in markdown code blocks)
  let jsonStr = responseText.trim()

  // Remove markdown code blocks if present
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim()
  }

  // Try to find JSON object
  const jsonObjMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (!jsonObjMatch) {
    throw new Error('A IA não retornou JSON válido. Tente novamente.')
  }

  try {
    return JSON.parse(jsonObjMatch[0])
  } catch {
    throw new Error('Erro ao processar resposta da IA. JSON inválido.')
  }
}

async function handleTranscribe(
  provider: Record<string, unknown>,
  imageUrls: string[]
): Promise<string> {
  if (imageUrls.length === 0) {
    throw new Error('Nenhuma imagem fornecida para transcrição')
  }

  const systemPrompt = `Você é um sistema de OCR especializado em transcrever textos manuscritos em português brasileiro.

INSTRUÇÕES:
1. Transcreva o texto EXATAMENTE como escrito, mantendo parágrafos e quebras de linha
2. NÃO corrija erros de ortografia ou gramática — transcreva fielmente
3. Se não conseguir ler algum trecho, indique com [ilegível]
4. Separe cada parágrafo com uma linha em branco
5. Retorne APENAS o texto transcrito, sem comentários adicionais`

  const userPrompt = 'Transcreva o texto manuscrito desta(s) imagem(ns) de redação. Retorne apenas o texto, sem comentários:'

  return await callProvider(provider, systemPrompt, userPrompt, imageUrls)
}
