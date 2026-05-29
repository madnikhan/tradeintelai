import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { createTelegramLinkToken } from '@/lib/notifications/dispatch';
import { getTelegramBotUsername } from '@/lib/telegram/bot';

export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  try {
    const token = await createTelegramLinkToken(auth.userId);
    const botUsername = getTelegramBotUsername();
    const linkUrl = `https://t.me/${botUsername}?start=${token}`;
    return NextResponse.json({
      token,
      linkUrl,
      botUsername,
      expiresInMinutes: 15,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create link token';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
