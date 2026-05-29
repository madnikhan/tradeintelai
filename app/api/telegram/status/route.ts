import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { unlinkTelegramChat } from '@/lib/notifications/dispatch';

export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getAdminFirestore();
    const snap = await db.doc(`users/${auth.userId}/settings/notifications`).get();
    const data = snap.data();
    return NextResponse.json({
      linked: Boolean(data?.telegramChatId),
      telegramChatId: data?.telegramChatId ?? null,
      telegramUsername: data?.telegramUsername ?? null,
      telegramLinkedAt: data?.telegramLinkedAt ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  try {
    await unlinkTelegramChat(auth.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to unlink';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
