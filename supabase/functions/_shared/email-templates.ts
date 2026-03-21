// Shared email templates for Everest Preparatórios transactional emails
// All templates follow the same branding: orange header, white body, gray footer

interface EmailTemplate {
  subject: string
  html: string
}

function wrapTemplate(subtitle: string, bodyContent: string): string {
  return `<!DOCTYPE html>
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
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${subtitle}</p>
</td></tr>
<!-- Body -->
<tr><td style="padding:32px 24px;">
${bodyContent}
</td></tr>
<!-- Footer -->
<tr><td style="background-color:#f9fafb;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">Everest Preparat&#243;rios &#8212; Plataforma de Ensino<br/>Conquiste o topo da sua prepara&#231;&#227;o.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`
}

function ctaButton(text: string, url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td align="center">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${url}" style="height:48px;width:280px;v-text-anchor:middle;" arcsize="17%" fillcolor="#ff6b35"><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${text}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${url}" style="display:inline-block;background-color:#ff6b35;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;text-align:center;">${text}</a><!--<![endif]-->
</td></tr></table>`
}

export function welcomeEmail(
  firstName: string,
  productName: string,
  appUrl: string,
  expiresAt: string,
  tempPassword?: string | null,
): EmailTemplate {
  return {
    subject: `${firstName}, seu acesso ao Everest está pronto!`,
    html: wrapTemplate(
      'Bem-vindo(a) ao Everest!',
      `<h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:700;">Ol&#225;, ${firstName}! &#127881;</h2>
<p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">Seu acesso ao <strong>${productName}</strong> foi ativado com sucesso. Estamos muito felizes em ter voc&#234; conosco!</p>
<p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">A partir de agora voc&#234; tem acesso completo a:</p>
<ul style="margin:0 0 12px;padding-left:20px;color:#4b5563;font-size:15px;line-height:1.8;">
<li>Videoaulas com os melhores professores</li>
<li>Banco de quest&#245;es e simulados</li>
<li>Flashcards e plano de estudos</li>
<li>Comunidade exclusiva de alunos</li>
</ul>
<p style="margin:0 0 4px;color:#4b5563;font-size:15px;line-height:1.6;">Seu acesso &#233; v&#225;lido at&#233;: <strong>${expiresAt}</strong></p>
${tempPassword ? `<div style="margin:16px 0;padding:16px;background-color:#f3f4f6;border-radius:8px;border-left:4px solid #ff6b35;">
<p style="margin:0 0 8px;color:#1a1a2e;font-size:15px;font-weight:700;">Seus dados de acesso:</p>
<p style="margin:0;color:#4b5563;font-size:14px;line-height:1.8;"><strong>Senha tempor&#225;ria:</strong> ${tempPassword}<br/><em style="font-size:12px;color:#9ca3af;">Recomendamos trocar a senha no primeiro acesso.</em></p>
</div>` : ''}
${ctaButton('Acessar a Plataforma', appUrl)}
<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">Qualquer d&#250;vida, responda este e-mail. Estamos aqui para ajudar!</p>`,
    ),
  }
}

export function paymentFailedEmail(
  firstName: string,
  productName: string,
  retryUrl: string,
): EmailTemplate {
  return {
    subject: 'Problema com seu pagamento',
    html: wrapTemplate(
      'Aviso importante sobre seu pagamento',
      `<h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:700;">Ol&#225;, ${firstName}</h2>
<p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">Identificamos um problema com o pagamento do seu plano <strong>${productName}</strong>.</p>
<p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">Isso pode acontecer por v&#225;rios motivos: cart&#227;o expirado, limite insuficiente ou dados desatualizados. N&#227;o se preocupe, &#233; f&#225;cil resolver!</p>
<p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">Para evitar a interrup&#231;&#227;o do seu acesso, atualize seus dados de pagamento o quanto antes:</p>
${ctaButton('Atualizar Pagamento', retryUrl)}
<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">Se voc&#234; j&#225; resolveu, pode ignorar este e-mail. Caso precise de ajuda, &#233; s&#243; responder.</p>`,
    ),
  }
}

export function refundEmail(
  firstName: string,
  productName: string,
  amountFormatted: string,
  reason: string,
): EmailTemplate {
  return {
    subject: 'Confirmação de reembolso',
    html: wrapTemplate(
      'Confirma&#231;&#227;o de reembolso',
      `<h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:700;">Ol&#225;, ${firstName}</h2>
<p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">Confirmamos o reembolso do seu plano <strong>${productName}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
<tr><td style="padding:16px 20px;">
<p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Valor reembolsado</p>
<p style="margin:0 0 12px;color:#1a1a2e;font-size:22px;font-weight:700;">${amountFormatted}</p>
<p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Motivo</p>
<p style="margin:0;color:#4b5563;font-size:15px;">${reason}</p>
</td></tr></table>
<p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">O valor ser&#225; devolvido ao seu m&#233;todo de pagamento original em at&#233; 10 dias &#250;teis, dependendo da sua institui&#231;&#227;o financeira.</p>
<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">Sentimos muito em ver voc&#234; partir. Se quiser voltar, estaremos aqui!</p>`,
    ),
  }
}

export function cartRecoveryEmail(
  firstName: string,
  productName: string,
  recoveryUrl: string,
): EmailTemplate {
  return {
    subject: 'Você deixou algo no carrinho!',
    html: wrapTemplate(
      'Voc&#234; estava quase l&#225;!',
      `<h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:700;">Ol&#225;, ${firstName}!</h2>
<p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">Notamos que voc&#234; demonstrou interesse no <strong>${productName}</strong>, mas n&#227;o finalizou a compra.</p>
<p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">Sabemos que a prepara&#231;&#227;o para concursos militares exige dedica&#231;&#227;o &#8212; e n&#243;s queremos estar ao seu lado nessa jornada.</p>
<p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">Seu carrinho ainda est&#225; esperando por voc&#234;:</p>
${ctaButton('Finalizar Compra', recoveryUrl)}
<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">Se tiver alguma d&#250;vida sobre o curso, &#233; s&#243; responder este e-mail!</p>`,
    ),
  }
}

export function expirationWarningEmail(
  firstName: string,
  productName: string,
  daysLeft: number,
  renewUrl: string,
): EmailTemplate {
  return {
    subject: `Seu acesso expira em ${daysLeft} dias`,
    html: wrapTemplate(
      `Faltam ${daysLeft} dias para o seu acesso expirar`,
      `<h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:700;">Ol&#225;, ${firstName}</h2>
<p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">Seu acesso ao <strong>${productName}</strong> expira em <strong>${daysLeft} dias</strong>.</p>
<p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">Para continuar estudando sem interrup&#231;&#227;o, renove agora e mantenha acesso a todas as aulas, simulados e materiais:</p>
${ctaButton('Renovar Acesso', renewUrl)}
<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">Ap&#243;s a expira&#231;&#227;o, seu acesso ser&#225; suspenso automaticamente. Renove antes para n&#227;o perder seu progresso!</p>`,
    ),
  }
}

export function accessExpiredEmail(
  firstName: string,
  productName: string,
  renewUrl: string,
): EmailTemplate {
  return {
    subject: `Seu acesso ao ${productName} expirou`,
    html: wrapTemplate(
      'Seu acesso expirou',
      `<h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:700;">Ol&#225;, ${firstName}</h2>
<p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">Seu acesso ao <strong>${productName}</strong> expirou.</p>
<p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">Mas n&#227;o se preocupe! Todo o seu progresso, notas e hist&#243;rico de estudos est&#227;o salvos. Basta renovar para continuar de onde parou.</p>
<p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">Renove agora e volte a estudar com o Everest:</p>
${ctaButton('Renovar Agora', renewUrl)}
<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">Se tiver d&#250;vidas sobre a renova&#231;&#227;o, responda este e-mail.</p>`,
    ),
  }
}
