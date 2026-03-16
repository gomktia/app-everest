import type { VercelRequest, VercelResponse } from '@vercel/node'

const SUPABASE_URL = 'https://hnhzindsfuqnaxosujay.supabase.co'
// Use service role key (set in Vercel env vars) to bypass RLS, fallback to anon key
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuaHppbmRzZnVxbmF4b3N1amF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MzU5NTIsImV4cCI6MjA2ODUxMTk1Mn0.cT7fe1wjee9HfZw_IVD7K_exMqu-LtUxiClCD-sDLyU'
const API_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${API_KEY}`,
}

async function supabaseGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers })
  if (!res.ok) return null
  return res.json()
}

/**
 * API Route that returns OG meta tags for invite links.
 * Called by Vercel rewrite when a bot/crawler requests /invite/:slug
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = req.query.slug as string
  if (!slug) {
    return res.status(400).json({ error: 'Missing slug' })
  }

  try {
    // Fetch invite
    const invites = await supabaseGet(`invites?slug=eq.${encodeURIComponent(slug)}&status=eq.active&select=title,description,cover_image_url,course_id`)
    const invite = invites?.[0]

    if (!invite) {
      return sendHtml(res, slug, {
        title: 'Everest Preparatórios',
        description: 'Plataforma completa de estudos para concursos e vestibulares',
        image: 'https://app.everestpreparatorios.com.br/og-image.png',
      })
    }

    // Fetch course thumbnail if invite has course_id
    let courseName = ''
    let courseThumb = ''
    if (invite.course_id) {
      const courses = await supabaseGet(`video_courses?id=eq.${invite.course_id}&select=name,thumbnail_url&is_active=eq.true`)
      if (courses?.[0]) {
        courseName = courses[0].name || ''
        courseThumb = courses[0].thumbnail_url || ''
      }
    }

    const title = invite.title || 'Convite - Everest Preparatórios'
    const description = invite.description || courseName || 'Acesse a plataforma de estudos Everest Preparatórios'
    const image = invite.cover_image_url || courseThumb || 'https://app.everestpreparatorios.com.br/og-image.png'

    return sendHtml(res, slug, { title, description, image })
  } catch {
    return sendHtml(res, slug, {
      title: 'Everest Preparatórios',
      description: 'Plataforma completa de estudos para concursos e vestibulares',
      image: 'https://app.everestpreparatorios.com.br/og-image.png',
    })
  }
}

function sendHtml(res: VercelResponse, slug: string, meta: { title: string; description: string; image: string }) {
  const url = `https://app.everestpreparatorios.com.br/invite/${slug}`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate')

  return res.status(200).send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(meta.title)}</title>
  <meta name="description" content="${esc(meta.description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(meta.title)}" />
  <meta property="og:description" content="${esc(meta.description)}" />
  <meta property="og:image" content="${esc(meta.image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:site_name" content="Everest Preparatórios" />
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:title" content="${esc(meta.title)}" />
  <meta property="twitter:description" content="${esc(meta.description)}" />
  <meta property="twitter:image" content="${esc(meta.image)}" />
  <meta http-equiv="refresh" content="0;url=${esc(url)}" />
</head>
<body>
  <p>Redirecionando para <a href="${esc(url)}">${esc(meta.title)}</a>...</p>
</body>
</html>`)
}

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}
