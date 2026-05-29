/**
 * Telegram Bot API helpers (server-side only).
 */

const TELEGRAM_API = 'https://api.telegram.org/bot';

export function getTelegramBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export function getTelegramChannelId(): string | null {
  return process.env.TELEGRAM_CHANNEL_ID?.trim() || null;
}

export function isTelegramChannelEnabled(): boolean {
  return process.env.TELEGRAM_CHANNEL_ENABLED !== 'false';
}

export function getTelegramBotUsername(): string {
  return process.env.TELEGRAM_BOT_USERNAME?.trim() || 'TradeIntelBot';
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: { parseMode?: 'HTML' | 'Markdown' }
): Promise<boolean> {
  const token = getTelegramBotToken();
  if (!token) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not configured');
    return false;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[telegram] sendMessage failed:', res.status, body);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[telegram] sendMessage error:', e);
    return false;
  }
}

export async function sendTelegramChannelMessage(text: string): Promise<boolean> {
  if (!isTelegramChannelEnabled()) return false;
  const channelId = getTelegramChannelId();
  if (!channelId) return false;
  return sendTelegramMessage(channelId, text);
}
