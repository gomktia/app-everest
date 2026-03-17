/**
 * Migra 260 attachments de aulas do MemberKit CDN para Supabase Storage.
 *
 * O que faz:
 * 1. Busca todos os lesson_attachments com URL do MemberKit
 * 2. Baixa cada arquivo
 * 3. Faz upload para Supabase Storage (bucket: course_materials)
 * 4. Atualiza a URL na tabela lesson_attachments
 *
 * Uso: npx tsx scripts/migrate-memberkit-attachments.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hnhzindsfuqnaxosujay.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuaHppbmRzZnVxbmF4b3N1amF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjkzNTk1MiwiZXhwIjoyMDY4NTExOTUyfQ.Fj2biXwZJNz-cqnma6_gJDMviVGo92ljDCIdFynojZ4'
const BUCKET = 'course_materials'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface Attachment {
  id: string
  lesson_id: string
  file_url: string
  file_name: string
  file_type: string
}

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9._-]/g, '_') // replace special chars
    .replace(/__+/g, '_') // collapse underscores
    .substring(0, 200) // limit length
}

function getExtension(fileType: string, fileName: string): string {
  if (fileType.includes('pdf')) return '.pdf'
  if (fileType.includes('presentationml')) return '.pptx'
  if (fileType.includes('wordprocessingml')) return '.docx'
  if (fileType.includes('spreadsheetml')) return '.xlsx'
  // Fallback to filename extension
  const match = fileName.match(/\.([a-zA-Z0-9]+)$/)
  return match ? `.${match[1]}` : '.pdf'
}

async function downloadFile(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Everest-Migration/1.0',
      },
    })
    if (!response.ok) {
      console.error(`  ❌ HTTP ${response.status} for ${url.substring(0, 80)}`)
      return null
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error: any) {
    console.error(`  ❌ Download failed: ${error.message}`)
    return null
  }
}

async function uploadToStorage(filePath: string, fileData: Buffer, contentType: string): Promise<string | null> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, fileData, {
      contentType,
      upsert: true,
    })

  if (error) {
    console.error(`  ❌ Upload failed: ${error.message}`)
    return null
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
  return urlData.publicUrl
}

async function main() {
  console.log('🚀 Iniciando migração de attachments MemberKit → Supabase Storage')
  console.log(`   Bucket: ${BUCKET}\n`)

  // 1. Fetch all MemberKit attachments with lesson context
  const { data: attachments, error } = await supabase
    .from('lesson_attachments')
    .select(`
      id,
      lesson_id,
      file_url,
      file_name,
      file_type,
      video_lessons!lesson_attachments_lesson_id_fkey(
        title,
        module_id,
        video_modules!inner(
          name,
          course_id,
          video_courses!inner(
            name
          )
        )
      )
    `)
    .like('file_url', '%memberkit%')
    .order('created_at')

  if (error) {
    console.error('❌ Erro ao buscar attachments:', error)
    return
  }

  const total = attachments?.length || 0
  console.log(`📋 Encontrados ${total} attachments no MemberKit\n`)

  if (total === 0) {
    console.log('✅ Nada para migrar!')
    return
  }

  let success = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < total; i++) {
    const att = attachments[i] as any
    const lesson = att.video_lessons
    const module = lesson?.video_modules
    const course = module?.video_courses

    const courseName = sanitizeFilename(course?.name || 'sem-curso')
    const moduleName = sanitizeFilename(module?.name || 'sem-modulo')
    const ext = getExtension(att.file_type, att.file_name)
    const fileName = sanitizeFilename(att.file_name.replace(/\.[^.]+$/, '')) + ext

    // Organize: course/module/filename
    const storagePath = `lessons/${courseName}/${moduleName}/${fileName}`

    console.log(`[${i + 1}/${total}] ${att.file_name.substring(0, 60)}`)
    console.log(`  📂 ${courseName} → ${moduleName}`)

    // 2. Download from MemberKit
    const fileData = await downloadFile(att.file_url)
    if (!fileData) {
      failed++
      continue
    }

    if (fileData.length < 100) {
      console.log(`  ⚠️ Arquivo muito pequeno (${fileData.length} bytes), pulando`)
      skipped++
      continue
    }

    console.log(`  ⬇️ Baixado: ${(fileData.length / 1024).toFixed(0)} KB`)

    // 3. Upload to Supabase Storage
    const newUrl = await uploadToStorage(storagePath, fileData, att.file_type)
    if (!newUrl) {
      failed++
      continue
    }

    // 4. Update URL in database
    const { error: updateError } = await supabase
      .from('lesson_attachments')
      .update({ file_url: newUrl })
      .eq('id', att.id)

    if (updateError) {
      console.error(`  ❌ Update DB failed: ${updateError.message}`)
      failed++
      continue
    }

    console.log(`  ✅ Migrado → ${storagePath}`)
    success++

    // Small delay to avoid rate limiting
    if (i % 10 === 9) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`📊 Resultado:`)
  console.log(`   ✅ Migrados: ${success}`)
  console.log(`   ❌ Falhas: ${failed}`)
  console.log(`   ⚠️ Pulados: ${skipped}`)
  console.log(`   📋 Total: ${total}`)
  console.log('='.repeat(50))

  if (failed > 0) {
    console.log('\n⚠️ Execute novamente para tentar os que falharam.')
  } else {
    console.log('\n🎉 Migração concluída! Agora é seguro cancelar o MemberKit.')
  }
}

main().catch(console.error)
