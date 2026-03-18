// Shared email sender using Resend API
// Used by Stripe and other Edge Functions for transactional emails

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

export async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Everest Preparatorios <noreply@app.everestpreparatorios.com.br>',
      to: [to],
      subject,
      html,
    }),
  })
}
