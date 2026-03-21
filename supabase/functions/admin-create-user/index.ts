import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify caller is admin/teacher
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user: caller }, error: authError } = await authClient.auth.getUser()
    if (authError || !caller) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const { data: callerProfile } = await authClient
      .from('users')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (!callerProfile || !['administrator', 'teacher'].includes(callerProfile.role)) {
      return jsonResponse({ error: 'Forbidden: admin/teacher only' }, 403)
    }

    const body = await req.json()
    const { action, email, first_name, last_name, class_id, user_id, new_email } = body

    // Handle update_email action
    if (action === 'update_email') {
      if (!user_id || !new_email) {
        return jsonResponse({ error: 'Missing user_id or new_email' }, 400)
      }
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        email: new_email.toLowerCase().trim(),
      })
      if (updateErr) {
        return jsonResponse({ error: updateErr.message }, 400)
      }
      return jsonResponse({ success: true, message: 'Email updated' })
    }

    if (!email || !first_name || !last_name) {
      return jsonResponse({ error: 'Missing required fields: email, first_name, last_name' }, 400)
    }

    // Admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Create auth user (no password - magic link only)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      email_confirm: true,
      user_metadata: { first_name, last_name },
    })

    if (createError) {
      return jsonResponse({ error: createError.message }, 400)
    }

    // Create public.users
    await supabaseAdmin.from('users').upsert({
      id: newUser.user.id,
      email: email.toLowerCase().trim(),
      first_name,
      last_name,
      role: 'student',
      is_active: true,
    }, { onConflict: 'id' })

    // Create student record
    await supabaseAdmin.from('students').upsert({
      user_id: newUser.user.id,
      student_id_number: `STU-${newUser.user.id.substring(0, 8)}`,
      enrollment_date: new Date().toISOString().split('T')[0],
    }, { onConflict: 'user_id' })

    // Enroll in class if provided
    if (class_id) {
      await supabaseAdmin.from('student_classes').insert({
        user_id: newUser.user.id,
        class_id,
        enrollment_date: new Date().toISOString().split('T')[0],
        source: 'manual',
      })
    }

    // Send welcome email via Resend
    if (RESEND_API_KEY) {
      const appUrl = Deno.env.get('APP_URL') || 'https://app.everestpreparatorios.com.br'

      const emailHtml = [
          '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>',
          '<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">',
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;"><tr><td align="center">',
          '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">',
          '<tr><td style="background:linear-gradient(135deg,#ea580c 0%,#c2410c 100%);padding:40px 40px 30px;text-align:center;">',
          '<h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Bem-vindo ao Everest!</h1>',
          '</td></tr>',
          '<tr><td style="padding:36px 40px;">',
          `<p style="margin:0 0 16px;font-size:17px;color:#1f2937;line-height:1.6;">Ol&#225; <strong>${first_name}</strong>,</p>`,
          `<p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.6;">Sua conta foi criada na plataforma <strong style="color:#ea580c;">Everest Preparat&#243;rios</strong>.</p>`,
          `<p style="margin:0 0 28px;font-size:16px;color:#374151;line-height:1.6;">Para acessar, clique no bot&#227;o abaixo e informe seu email <strong>${email}</strong>. Voc&#234; receber&#225; um link de acesso instant&#226;neo &#8212; sem senha!</p>`,
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 32px;">',
          `<a href="${appUrl}/login" style="background-color:#ea580c;color:#ffffff;padding:16px 48px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;box-shadow:0 2px 4px rgba(234,88,12,0.3);">Acessar Plataforma</a>`,
          '</td></tr></table>',
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background-color:#fff7ed;border-radius:8px;padding:16px 20px;border-left:4px solid #ea580c;">',
          '<p style="margin:0;font-size:14px;color:#9a3412;line-height:1.5;"><strong>Como funciona?</strong><br/>Digite seu email no login e receba um link m&#225;gico. Clicou, entrou! Sem senha para lembrar.</p>',
          '</td></tr></table>',
          '</td></tr>',
          '<tr><td style="background-color:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">',
          '<p style="margin:0;font-size:13px;color:#9ca3af;">Everest Preparat&#243;rios &#8212; Plataforma de Ensino</p>',
          '</td></tr></table></td></tr></table></body></html>',
        ].join('')

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Everest Preparatorios <noreply@app.everestpreparatorios.com.br>',
          to: [email],
          subject: 'Bem-vindo ao Everest! Seu acesso esta pronto',
          html: emailHtml,
        }),
      })
    }

    return jsonResponse({ success: true, user_id: newUser.user.id })
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500)
  }
})
