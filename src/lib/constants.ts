/**
 * Constantes globais da aplicação
 * Centraliza valores que precisam ser fáceis de alterar
 */

// TODO: Substituir pelo número real de suporte antes do lançamento
export const SUPPORT_WHATSAPP_NUMBER = '5555996295455'

export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`

export function getSupportWhatsAppUrl(message?: string): string {
  const text = message || 'Olá! Tenho interesse no acesso completo do Everest Preparatórios.'
  return `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(text)}`
}
