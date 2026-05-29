import { NextRequest, NextResponse } from 'next/server';
import {
  consumeTelegramLinkToken,
  findUserIdByTelegramChat,
  unlinkTelegramChat,
} from '@/lib/notifications/dispatch';
import { sendTelegramMessage } from '@/lib/telegram/bot';

interface TelegramUpdate {
  message?: {
    chat: { id: number; username?: string; first_name?: string };
    text?: string;
    from?: { username?: string };
  };
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = request.headers.get('x-telegram-bot-api-secret-token');
    if (header !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message?.text || !message.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();
  const username = message.from?.username ?? message.chat.username;

  if (text === '/stop' || text.startsWith('/stop ')) {
    const userId = await findUserIdByTelegramChat(chatId);
    if (userId) {
      await unlinkTelegramChat(userId);
      await sendTelegramMessage(
        chatId,
        'TradeIntel AI: Telegram notifications disconnected. Re-link anytime from Settings.'
      );
    } else {
      await sendTelegramMessage(chatId, 'You are not linked to a TradeIntel account.');
    }
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith('/start')) {
    const parts = text.split(/\s+/);
    const payload = parts[1];
    if (payload?.startsWith('LINK_')) {
      const result = await consumeTelegramLinkToken(payload, chatId, username);
      if (result.ok) {
        await sendTelegramMessage(
          chatId,
          'Connected to TradeIntel AI. You will receive trade execution alerts here.\n\nSend /stop to disconnect.'
        );
      } else {
        await sendTelegramMessage(chatId, result.error);
      }
    } else {
      await sendTelegramMessage(
        chatId,
        'Welcome to TradeIntel AI Bot.\n\nLink your account from TradeIntel Settings → Connect Telegram, then open the link provided.\n\nSend /stop to disconnect.'
      );
    }
  }

  return NextResponse.json({ ok: true });
}
