import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const KIWIFY_WEBHOOK_TOKEN = Deno.env.get('KIWIFY_WEBHOOK_TOKEN') ?? ''
const KIWIFY_CLIENT_SECRET = Deno.env.get('KIWIFY_CLIENT_SECRET') ?? ''

function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const special = '#@!&%'
  const all = upper + lower + digits + special

  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)]

  const required = [pick(upper), pick(lower), pick(digits), pick(special)]
  for (let i = 0; i < 4; i++) required.push(pick(all))

  for (let i = required.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [required[i], required[j]] = [required[j], required[i]]
  }
  return required.join('')
}

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
    // Read raw body for signature validation
    const rawBody = await req.text()

    // Validate: Kiwify signature (HMAC SHA256) or our custom token
    const kiwifySignature = req.headers.get('x-kiwify-signature') || req.headers.get('signature')
    const url = new URL(req.url)
    const token = url.searchParams.get('token') || req.headers.get('x-kiwify-token')

    let isValid = false

    // Method 1: Kiwify HMAC signature validation
    if (kiwifySignature && KIWIFY_CLIENT_SECRET) {
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(KIWIFY_CLIENT_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
      const computed = new TextDecoder().decode(hexEncode(new Uint8Array(sig)))
      isValid = computed === kiwifySignature
    }

    // Method 2: Custom token in URL
    if (!isValid && KIWIFY_WEBHOOK_TOKEN && token === KIWIFY_WEBHOOK_TOKEN) {
      isValid = true
    }

    // If neither method validates and we have secrets configured, reject
    if (!isValid && (KIWIFY_CLIENT_SECRET || KIWIFY_WEBHOOK_TOKEN)) {
      return jsonResponse({ error: 'Invalid webhook signature or token' }, 401)
    }

    const body = JSON.parse(rawBody)

    // Only process paid/approved orders
    if (body.order_status !== 'paid' && body.order_status !== 'approved') {
      return jsonResponse({ message: 'Ignored: not a paid order', status: body.order_status })
    }

    // Extract customer data from Kiwify payload
    const customerEmail = body.Customer?.email?.toLowerCase()?.trim()
    const customerName = body.Customer?.full_name || ''
    const productId = body.Product?.product_id || body.product_id
    const couponCode = body.Subscription?.charges?.coupon?.code || body.coupon_code || null

    if (!customerEmail || !productId) {
      return jsonResponse({ error: 'Missing customer email or product ID' }, 400)
    }

    // Parse name
    const nameParts = customerName.split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    // Admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Look up product → class mapping
    const { data: productMapping, error: productError } = await supabaseAdmin
      .from('kiwify_products')
      .select('class_id, product_name')
      .eq('kiwify_product_id', productId)
      .eq('is_active', true)
      .single()

    if (productError || !productMapping) {
      return jsonResponse({ error: `No class mapping found for product: ${productId}` }, 404)
    }

    // 2. Check if user already exists in public.users
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', customerEmail)
      .maybeSingle()

    let userId: string
    let tempPassword: string | null = null

    if (existingUser) {
      // User exists
      userId = existingUser.id
    } else {
      // 3. Create new auth user with random temporary password
      tempPassword = generateTempPassword()
      const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: customerEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName, temp_password: true },
      })

      if (createAuthError) {
        // User might exist in auth but not in public.users
        if (createAuthError.message?.includes('already been registered')) {
          const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
          const found = users?.find((u: { email?: string }) => u.email === customerEmail)
          if (!found) {
            return jsonResponse({ error: 'User exists in auth but could not be found' }, 500)
          }
          userId = found.id
        } else {
          return jsonResponse({ error: 'Failed to create auth user', detail: createAuthError.message }, 500)
        }
      } else {
        userId = newAuthUser.user.id
      }

      // 4. Create public.users record
      await supabaseAdmin.from('users').upsert({
        id: userId,
        email: customerEmail,
        first_name: firstName,
        last_name: lastName,
        role: 'student',
        is_active: true,
      }, { onConflict: 'id' })

      // Note: students table removed — student data lives in users + student_classes
    }

    // 5. Enroll in class (skip if already enrolled)
    const { data: existingEnrollment } = await supabaseAdmin
      .from('student_classes')
      .select('id')
      .eq('user_id', userId)
      .eq('class_id', productMapping.class_id)
      .maybeSingle()

    if (!existingEnrollment) {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 365)

      await supabaseAdmin.from('student_classes').insert({
        user_id: userId,
        class_id: productMapping.class_id,
        enrollment_date: new Date().toISOString().split('T')[0],
        source: 'kiwify',
        coupon_code: couponCode,
        subscription_expires_at: expiresAt.toISOString(),
      })
    }

    // 6. Send email via Resend (welcome for new users, confirmation for existing)
    if (RESEND_API_KEY) {
      const appUrl = Deno.env.get('APP_URL') || 'https://app.everestpreparatorios.com.br'

      const emailHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<!--[if mso]><style>table,td{font-family:Arial,sans-serif!important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#1a1a2e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;padding:24px 16px;">
<tr><td align="center">
<table role="presentation" style="width:100%;max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
<!-- Header -->
<tr><td style="background-color:#ff6b35;padding:32px 24px;text-align:center;">
<div style="width:56px;height:56px;background-color:rgba(255,255,255,0.2);border-radius:14px;margin:0 auto 16px;line-height:56px;font-size:28px;">&#9968;</div>
<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Everest Preparat&#243;rios</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Sua matr&#237;cula foi confirmada!</p>
</td></tr>
<!-- Body -->
<tr><td style="padding:32px 24px;">
<p style="margin:0 0 16px;font-size:16px;color:#1f2937;line-height:1.6;">Ol&#225; <strong>${firstName}</strong>,</p>
<p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.6;">Voc&#234; agora tem acesso ao curso <strong style="color:#ff6b35;">${productMapping.product_name}</strong>. Estamos prontos para te ajudar a conquistar o topo!</p>
<!-- Button (mobile-safe: full-width on small screens) -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:8px 0 24px;">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${appUrl}/login" style="height:50px;v-text-anchor:middle;width:280px;" arcsize="16%" fillcolor="#ff6b35"><center style="color:#fff;font-family:Arial;font-size:16px;font-weight:bold;">Acessar Plataforma</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${appUrl}/login" style="background-color:#ff6b35;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:block;text-align:center;max-width:280px;margin:0 auto;mso-padding-alt:0;box-sizing:border-box;">Acessar Plataforma</a><!--<![endif]-->
</td></tr></table>
<!-- Password box -->
${typeof tempPassword === 'string' ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
<tr><td style="background-color:#f3f4f6;border-radius:8px;padding:16px;border-left:4px solid #ff6b35;">
<p style="margin:0 0 8px;color:#1a1a2e;font-size:15px;font-weight:700;">Seus dados de acesso:</p>
<p style="margin:0;color:#4b5563;font-size:14px;line-height:1.8;"><strong>Senha tempor&#225;ria:</strong> ${tempPassword}<br/><em style="font-size:12px;color:#9ca3af;">Recomendamos trocar a senha no primeiro acesso.</em></p>
</td></tr></table>` : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="background-color:#fff7ed;border-radius:8px;padding:16px;border-left:3px solid #ff6b35;">
<p style="margin:0;font-size:13px;color:#9a3412;line-height:1.5;"><strong>&#128161; Como acessar?</strong><br/>Use seu email e senha cadastrados para entrar na plataforma.</p>
</td></tr></table>`}
</td></tr>
<!-- Footer -->
<tr><td style="background-color:#f9fafb;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">Everest Preparat&#243;rios &#8212; Plataforma de Ensino<br/>Conquiste o topo da sua prepara&#231;&#227;o.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Everest Preparatorios <noreply@app.everestpreparatorios.com.br>',
          to: [customerEmail],
          subject: `${firstName}, seu acesso ao Everest esta pronto!`,
          html: emailHtml,
        }),
      })
    }

    return jsonResponse({
      success: true,
      user_id: userId,
      class_id: productMapping.class_id,
      is_new_user: !existingUser,
      coupon: couponCode,
    })

  } catch (error) {
    return jsonResponse({ error: 'Internal server error', detail: (error as Error).message }, 500)
  }
})
