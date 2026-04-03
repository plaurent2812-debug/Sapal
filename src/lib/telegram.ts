/**
 * Utilitaire Telegram partagé
 * Centralise l'envoi de notifications Telegram (messages + documents)
 */

const TELEGRAM_API = 'https://api.telegram.org/bot'

function getConfig(): { token: string; chatId: string } | null {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    console.warn('Telegram non configuré (TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID manquant)')
    return null
  }
  return { token, chatId }
}

/**
 * Envoie un message texte (supporte Markdown)
 * @param replyMarkup - Optionnel : boutons inline Telegram
 */
export async function sendTelegramMessage(
  text: string,
  replyMarkup?: { inline_keyboard: { text: string; url?: string; callback_data?: string }[][] }
): Promise<boolean> {
  const config = getConfig()
  if (!config) return false

  try {
    await fetch(`${TELEGRAM_API}${config.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: 'Markdown',
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    })
    return true
  } catch (err) {
    console.error('Telegram sendMessage failed:', err)
    return false
  }
}

/**
 * Envoie un document PDF avec caption
 */
export async function sendTelegramDocument(
  buffer: Buffer,
  filename: string,
  caption: string
): Promise<boolean> {
  const config = getConfig()
  if (!config) return false

  try {
    const formData = new FormData()
    formData.append('chat_id', config.chatId)
    formData.append('document', new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }), filename)
    formData.append('caption', caption)

    await fetch(`${TELEGRAM_API}${config.token}/sendDocument`, {
      method: 'POST',
      body: formData,
    })
    return true
  } catch (err) {
    console.error('Telegram sendDocument failed:', err)
    return false
  }
}
