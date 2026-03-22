import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { PDFDocument, rgb, StandardFonts, degrees } from "https://esm.sh/pdf-lib@1.17.1"

/**
 * Edge Function: PDF Watermark
 *
 * Aplica watermark visível (nome do aluno diagonal) e invisível (metadados)
 * em PDFs antes de servir ao aluno. Funciona como proxy autenticado.
 *
 * Uso: POST /pdf-watermark
 * Body: { bucket: "acervo-digital", filePath: "livros/arquivo.pdf" }
 * Header: Authorization: Bearer <jwt>
 */

const ALLOWED_ORIGIN = Deno.env.get('APP_URL') || 'https://app.everestpreparatorios.com.br'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Autenticar usuário
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Buscar dados do usuário (nome, CPF)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('first_name, last_name, email, cpf')
      .eq('id', user.id)
      .single()

    const firstName = userData?.first_name || ''
    const lastName = userData?.last_name || ''
    const fullName = `${firstName} ${lastName}`.trim() || user.email || 'Aluno'
    const cpf = userData?.cpf || ''
    const email = user.email || ''

    // 3. Obter IP do request
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'IP desconhecido'

    // 4. Ler parâmetros
    const { bucket, filePath } = await req.json()

    if (!bucket || !filePath) {
      return new Response(JSON.stringify({ error: 'bucket e filePath são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Baixar PDF do storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(bucket)
      .download(filePath)

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: 'Arquivo não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const pdfBytes = await fileData.arrayBuffer()

    // 6. Carregar e modificar o PDF
    let pdfDoc: PDFDocument
    try {
      pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
    } catch {
      // Se não conseguir processar o PDF, retorna o original
      return new Response(fileData, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filePath.split('/').pop()}"`,
        },
      })
    }

    // 7. Watermark INVISÍVEL — metadados do PDF
    const now = new Date().toISOString()
    pdfDoc.setTitle(pdfDoc.getTitle() || filePath.split('/').pop() || 'Documento')
    pdfDoc.setAuthor(`Everest Preparatórios - Licenciado para: ${fullName}`)
    pdfDoc.setSubject(`Aluno: ${fullName} | Email: ${email} | CPF: ${cpf} | IP: ${clientIp} | Data: ${now}`)
    pdfDoc.setKeywords([
      `aluno:${fullName}`,
      `email:${email}`,
      `cpf:${cpf}`,
      `ip:${clientIp}`,
      `download:${now}`,
      `user_id:${user.id}`,
    ])
    pdfDoc.setProducer('Everest Preparatórios - Material Protegido')
    pdfDoc.setCreator('Everest Preparatórios')

    // 8. Watermark VISÍVEL — texto diagonal em cada página
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const pages = pdfDoc.getPages()
    const watermarkText = `${fullName} - ${email}`

    for (const page of pages) {
      const { width, height } = page.getSize()

      // Texto diagonal grande (semi-transparente)
      const fontSize = Math.min(width, height) * 0.04
      const textWidth = font.widthOfTextAtSize(watermarkText, fontSize)

      page.drawText(watermarkText, {
        x: (width - textWidth * Math.cos(Math.PI / 6)) / 2,
        y: height / 2,
        size: fontSize,
        font,
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.15,
        rotate: degrees(45),
      })

      // Texto pequeno no rodapé
      const footerText = `Licenciado para: ${fullName} | ${now.substring(0, 10)}`
      const footerSize = 7
      const footerWidth = font.widthOfTextAtSize(footerText, footerSize)

      page.drawText(footerText, {
        x: (width - footerWidth) / 2,
        y: 8,
        size: footerSize,
        font,
        color: rgb(0.75, 0.75, 0.75),
        opacity: 0.3,
      })
    }

    // 9. Serializar e retornar
    const watermarkedBytes = await pdfDoc.save()

    return new Response(watermarkedBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filePath.split('/').pop()}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Watermark error:', error)
    return new Response(JSON.stringify({ error: 'Erro ao processar PDF' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
