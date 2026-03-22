import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PANDA_API_URL = "https://api-v2.pandavideo.com.br"

const ALLOWED_ORIGIN = Deno.env.get('APP_URL') || 'https://app.everestpreparatorios.com.br'

// Whitelist of allowed Panda API endpoint prefixes
const ALLOWED_ENDPOINTS = [
    '/videos',
    '/folders',
    '/players',
    '/shorts',
]

const ALLOWED_METHODS = ['GET', 'POST', 'PATCH', 'DELETE']

serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const { endpoint, method = 'GET', body } = await req.json()

        // Validate endpoint against whitelist
        if (!endpoint || typeof endpoint !== 'string' || !ALLOWED_ENDPOINTS.some(ep => endpoint.startsWith(ep))) {
            return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Validate HTTP method
        const upperMethod = method.toUpperCase()
        if (!ALLOWED_METHODS.includes(upperMethod)) {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Prevent path traversal (e.g. /videos/../../admin)
        if (endpoint.includes('..') || endpoint.includes('//')) {
            return new Response(JSON.stringify({ error: 'Invalid endpoint path' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const PANDA_API_KEY = Deno.env.get('PANDA_VIDEO_API_KEY')

        if (!PANDA_API_KEY) {
            return new Response(JSON.stringify({ error: 'Panda API key not configured in Supabase Secrets' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const response = await fetch(`${PANDA_API_URL}${endpoint}`, {
            method,
            headers: {
                'Authorization': `${PANDA_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        })

        const data = await response.json()

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: response.status,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
