/**
 * Script para gerar mapas mentais a partir de PDFs locais usando Gemini Flash.
 *
 * Uso:
 *   npx tsx scripts/generate-mind-maps.ts --dir "D:/Mapas da Lulu 3.0/72. (v) Português" --subject "Português" --color "blue"
 *   npx tsx scripts/generate-mind-maps.ts --dir "D:/Mapas da Lulu 3.0/53. (v) Direito Constitucional" --subject "Direito Constitucional" --color "purple"
 *
 * Requisitos:
 *   - SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY como env vars
 *   - GEMINI_API_KEY como env var
 */

import { createClient } from '@supabase/supabase-js'
import * as pdfjsLib from 'pdfjs-dist'
import * as fs from 'fs'
import * as path from 'path'

// ─── Config ─────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hnhzindsfuqnaxosujay.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = 'gemini-2.5-flash'

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Set SUPABASE_SERVICE_ROLE_KEY env var')
  process.exit(1)
}
if (!GEMINI_API_KEY) {
  console.error('❌ Set GEMINI_API_KEY env var')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ─── Args ───────────────────────────────────────────────

const args = process.argv.slice(2)
function getArg(name: string, fallback = ''): string {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback
}

const DIR = getArg('dir')
const SUBJECT = getArg('subject', 'Geral')
const COLOR = getArg('color', 'blue')

if (!DIR) {
  console.error('❌ Usage: npx tsx scripts/generate-mind-maps.ts --dir "path/to/pdfs" --subject "Matéria" --color "blue"')
  process.exit(1)
}

// ─── PDF Text Extraction ────────────────────────────────

async function extractTextFromPDF(filePath: string): Promise<string> {
  const data = new Uint8Array(fs.readFileSync(filePath))
  const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((item: any) => item.str).join(' ')
    if (text.trim()) pages.push(text.trim())
  }

  const fullText = pages.join('\n\n')
  // Limit to 50k chars for Gemini
  return fullText.length > 50000
    ? fullText.slice(0, 50000) + '\n\n[... texto truncado]'
    : fullText
}

// ─── Gemini API Call ────────────────────────────────────

async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini error ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ─── Find PDFs Recursively ──────────────────────────────

function findPDFs(dir: string): { filePath: string; topicName: string }[] {
  const results: { filePath: string; topicName: string }[] = []

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.name.toLowerCase().endsWith('.pdf')) {
        // Skip "Introdução", "Índice", "Todos os Mapas" files
        const lower = entry.name.toLowerCase()
        if (lower.includes('introduc') || lower.includes('indice') || lower.includes('índice') || lower.includes('todos os mapas')) {
          continue
        }
        // Topic name = PDF filename without extension
        const topicName = entry.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ').trim()
        results.push({ filePath: fullPath, topicName })
      }
    }
  }

  walk(dir)
  return results
}

// ─── JSON Parser with fixup ─────────────────────────────

function tryParseJson(text: string): any {
  // Remove markdown wrappers
  let json = text.trim()
  const codeBlock = json.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) json = codeBlock[1].trim()

  // Try direct parse
  try { return JSON.parse(json) } catch {}

  // Try to fix common Gemini JSON issues:
  // 1. Trailing commas before ] or }
  let fixed = json.replace(/,\s*([\]}])/g, '$1')
  try { return JSON.parse(fixed) } catch {}

  // 2. Unescaped quotes in strings — try replacing smart quotes
  fixed = fixed.replace(/[""]/g, '"').replace(/['']/g, "'")
  try { return JSON.parse(fixed) } catch {}

  // 3. Try extracting the largest JSON object
  const match = json.match(/\{[\s\S]*\}/)
  if (match) {
    const extracted = match[0].replace(/,\s*([\]}])/g, '$1')
    try { return JSON.parse(extracted) } catch {}
  }

  return null
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  console.log(`\n🧠 Gerando mapas mentais para: ${SUBJECT}`)
  console.log(`📁 Pasta: ${DIR}`)
  console.log(`🎨 Cor: ${COLOR}\n`)

  const pdfs = findPDFs(DIR)
  console.log(`📄 ${pdfs.length} PDFs encontrados\n`)

  if (pdfs.length === 0) {
    console.log('Nenhum PDF encontrado na pasta.')
    return
  }

  const systemPrompt = `Você é um especialista em criar mapas mentais para concursos brasileiros (CIAAR, CEBRASPE, PRF, PF).
Crie mapas mentais claros, hierárquicos e focados nos pontos mais cobrados em provas.
Responda EXCLUSIVAMENTE com JSON válido, sem markdown, sem texto adicional.`

  let success = 0
  let failed = 0

  for (let i = 0; i < pdfs.length; i++) {
    const { filePath, topicName } = pdfs[i]
    console.log(`[${i + 1}/${pdfs.length}] Processando: ${topicName}...`)

    try {
      // 1. Extract text
      const text = await extractTextFromPDF(filePath)
      if (text.length < 100) {
        console.log(`  ⚠️ Texto muito curto, pulando`)
        continue
      }

      // 2. Call Gemini
      const prompt = `Crie um mapa mental estruturado sobre "${topicName}" da matéria "${SUBJECT}".

Regras:
- Organize hierarquicamente: tema principal → subtemas → detalhes
- Cada nó tem: id (string numérica como "1", "1.1", "1.1.2"), label (título curto), detail (explicação 1-2 frases), type, children
- Types possíveis: concept (conceito teórico), example (exemplo prático), exception (exceção à regra), tip (dica de estudo/prova), rule (regra importante), warning (pegadinha/cuidado)
- Máximo 4 níveis de profundidade
- Foque nos pontos mais cobrados em concursos
- Inclua exemplos práticos e pegadinhas comuns
- Mínimo 15 nós, máximo 60 nós

Retorne JSON:
{
  "nodes": [
    {
      "id": "1",
      "label": "Título do tema",
      "type": "concept",
      "detail": "Explicação geral",
      "children": [
        {
          "id": "1.1",
          "label": "Subtema",
          "type": "concept",
          "detail": "Explicação do subtema",
          "children": [...]
        }
      ]
    }
  ]
}

CONTEÚDO:
${text}`

      // 3. Call Gemini with retry on JSON parse failure
      let parsed: any = null
      for (let attempt = 0; attempt < 3; attempt++) {
        const responseText = await callGemini(prompt, systemPrompt)
        parsed = tryParseJson(responseText)
        if (parsed?.nodes) break
        if (attempt < 2) {
          console.log(`  ⚠️ JSON inválido, tentativa ${attempt + 2}/3...`)
          await new Promise(r => setTimeout(r, 1500))
        }
      }

      if (!parsed || !parsed.nodes) {
        console.log(`  ❌ Gemini não retornou JSON válido após 3 tentativas`)
        failed++
        continue
      }

      // 4. Save to Supabase
      const { error } = await supabase.from('mind_maps').upsert({
        subject: SUBJECT,
        topic: topicName,
        title: topicName,
        data: parsed,
        icon: 'brain',
        color: COLOR,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'subject,topic',
      })

      if (error) {
        // If upsert conflict fails (no unique constraint), try insert
        const { error: insertError } = await supabase.from('mind_maps').insert({
          subject: SUBJECT,
          topic: topicName,
          title: topicName,
          data: parsed,
          icon: 'brain',
          color: COLOR,
        })
        if (insertError) {
          console.log(`  ❌ Erro ao salvar: ${insertError.message}`)
          failed++
          continue
        }
      }

      // Count nodes
      function countNodes(nodes: any[]): number {
        let c = 0
        for (const n of nodes) {
          c++
          if (n.children) c += countNodes(n.children)
        }
        return c
      }

      console.log(`  ✅ ${countNodes(parsed.nodes)} conceitos gerados`)
      success++

      // Small delay to respect rate limit
      await new Promise(r => setTimeout(r, 2000))

    } catch (err: any) {
      console.log(`  ❌ Erro: ${err.message}`)
      failed++
    }
  }

  console.log(`\n📊 Resultado: ${success} mapas gerados, ${failed} erros`)
}

main().catch(console.error)
