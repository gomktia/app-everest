import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hnhzindsfuqnaxosujay.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

/**
 * API Route that returns OG meta tags for invite links
 * Called by the middleware when a bot/crawler requests /invite/:slug
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = req.query.slug as string
  if (!slug) {
    return res.status(400).json({ error: 'Missing slug' })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: invite } = await supabase
      .from('invites')
      .select('title, description, cover_image_url, video_courses(name, thumbnail_url)')
      .eq('slug', slug)
      .eq('status', 'active')
      .single()

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' })
    }

    const course = invite.video_courses as any
    const title = invite.title || 'Convite - Everest Preparatórios'
    const description = invite.description || course?.name || 'Acesse a plataforma de estudos Everest Preparatórios'
    const image = invite.cover_image_url || course?.thumbnail_url || 'https://app.everestpreparatorios.com.br/og-image.png'
    const url = `https://app.everestpreparatorios.com.br/invite/${slug}`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate')

    return res.status(200).send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:site_name" content="Everest Preparatórios" />
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:title" content="${escapeHtml(title)}" />
  <meta property="twitter:description" content="${escapeHtml(description)}" />
  <meta property="twitter:image" content="${escapeHtml(image)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(url)}" />
</head>
<body>
  <p>Redirecionando para <a href="${escapeHtml(url)}">${escapeHtml(title)}</a>...</p>
</body>
</html>`)
  } catch (error) {
    return res.status(500).json({ error: 'Internal error' })
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
