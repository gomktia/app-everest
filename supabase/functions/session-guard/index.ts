import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * Edge Function: Session Guard
 *
 * Limita sessões simultâneas por usuário. Chamada no login para invalidar
 * sessões anteriores além do limite (max 2 dispositivos).
 *
 * Uso: POST /session-guard
 * Body: { maxSessions?: number }
 * Header: Authorization: Bearer <jwt>
 *
 * Fluxo:
 * 1. Registra a sessão atual na tabela user_sessions
 * 2. Conta sessões ativas do usuário
 * 3. Se exceder o limite, remove as mais antigas
 */

const ALLOWED_ORIGIN = Deno.env.get('APP_URL') || 'https://app.everestpreparatorios.com.br'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_MAX_SESSIONS = 2

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

    // 2. Parâmetros
    let maxSessions = DEFAULT_MAX_SESSIONS
    try {
      const body = await req.json()
      if (body.maxSessions && typeof body.maxSessions === 'number') {
        maxSessions = Math.max(1, Math.min(body.maxSessions, 5))
      }
    } catch {
      // Body vazio, usa default
    }

    // 3. Admin client para operações privilegiadas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // 4. Info da sessão atual
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    const sessionToken = req.headers.get('authorization')?.replace('Bearer ', '').substring(0, 32) || ''

    // 5. Registrar sessão atual
    await supabaseAdmin
      .from('user_sessions')
      .upsert({
        user_id: user.id,
        session_token: sessionToken,
        ip_address: clientIp,
        user_agent: userAgent,
        last_active_at: new Date().toISOString(),
      }, { onConflict: 'session_token' })

    // 6. Contar sessões ativas (últimas 24h)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: sessions } = await supabaseAdmin
      .from('user_sessions')
      .select('id, session_token, last_active_at')
      .eq('user_id', user.id)
      .gte('last_active_at', cutoff)
      .order('last_active_at', { ascending: false })

    if (!sessions || sessions.length <= maxSessions) {
      return new Response(JSON.stringify({
        ok: true,
        activeSessions: sessions?.length || 1,
        maxSessions,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 7. Excedeu limite — remover sessões mais antigas
    const sessionsToRemove = sessions.slice(maxSessions)
    const idsToRemove = sessionsToRemove.map(s => s.id)

    await supabaseAdmin
      .from('user_sessions')
      .delete()
      .in('id', idsToRemove)

    // 8. Invalidar os tokens antigos via auth admin
    // Nota: Supabase não permite invalidar tokens específicos,
    // mas podemos sinalizar para o frontend verificar

    return new Response(JSON.stringify({
      ok: true,
      activeSessions: maxSessions,
      maxSessions,
      removedSessions: sessionsToRemove.length,
      message: `${sessionsToRemove.length} sessão(ões) antiga(s) encerrada(s)`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Session guard error:', error)
    return new Response(JSON.stringify({ error: 'Erro ao verificar sessões' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
