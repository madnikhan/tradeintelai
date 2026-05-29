/**
 * Server-side notification dispatch (Telegram + FCM).
 */

import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  sendTelegramMessage,
  sendTelegramChannelMessage,
  isTelegramChannelEnabled,
} from '@/lib/telegram/bot';
import {
  formatTradeExecutedChannel,
  formatTradeExecutedDm,
  formatExecutableSignalChannel,
} from '@/lib/telegram/messages';
import type {
  ExecutableSignalPayload,
  NotificationPrefs,
  TradeExecutedPayload,
} from '@/lib/notifications/types';
import { DEFAULT_NOTIFICATION_PREFS } from '@/lib/notifications/types';

const CHANNEL_DEDUPE_MS = 5 * 60 * 1000;

async function getUserNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  try {
    const db = await getAdminFirestore();
    const snap = await db.doc(`users/${userId}/settings/notifications`).get();
    if (snap.exists) {
      return { ...DEFAULT_NOTIFICATION_PREFS, ...snap.data() } as NotificationPrefs;
    }
  } catch (e) {
    console.warn('[dispatch] load prefs:', e);
  }
  return DEFAULT_NOTIFICATION_PREFS;
}

async function getUserTelegramChatId(userId: string): Promise<string | null> {
  try {
    const db = await getAdminFirestore();
    const snap = await db.doc(`users/${userId}/settings/notifications`).get();
    if (snap.exists) {
      const chatId = snap.data()?.telegramChatId;
      return chatId ? String(chatId) : null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function shouldDedupeChannel(key: string): Promise<boolean> {
  try {
    const db = await getAdminFirestore();
    const ref = db.doc(`telegramDedupe/${key}`);
    const snap = await ref.get();
    if (snap.exists) {
      const at = snap.data()?.at?.toMillis?.() ?? 0;
      if (Date.now() - at < CHANNEL_DEDUPE_MS) return true;
    }
    await ref.set({ at: new Date() });
    return false;
  } catch {
    return false;
  }
}

async function sendFcmToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  try {
    const db = await getAdminFirestore();
    const devicesSnap = await db.collection(`users/${userId}/devices`).get();
    if (devicesSnap.empty) return false;

    const admin = await import('firebase-admin');
    const messaging = admin.messaging();
    let sent = false;

    for (const deviceDoc of devicesSnap.docs) {
      const token = deviceDoc.data()?.fcmToken as string | undefined;
      if (!token) continue;
      try {
        await messaging.send({
          token,
          notification: { title, body },
          data: data ?? {},
          webpush: {
            fcmOptions: {
              link: data?.url ?? 'https://tradeintelai.vercel.app/dashboard',
            },
          },
        });
        sent = true;
      } catch (e) {
        console.warn('[dispatch] FCM token failed:', e);
      }
    }
    return sent;
  } catch (e) {
    console.warn('[dispatch] FCM:', e);
    return false;
  }
}

function inQuietHours(prefs: NotificationPrefs): boolean {
  const start = prefs.quietHoursStart;
  const end = prefs.quietHoursEnd;
  if (start == null || end == null) return false;
  const hour = new Date().getUTCHours();
  if (start <= end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export async function dispatchTradeExecuted(
  userId: string,
  payload: TradeExecutedPayload
): Promise<{ telegramDm: boolean; telegramChannel: boolean; push: boolean }> {
  const prefs = await getUserNotificationPrefs(userId);
  if (!prefs.tradeExecuted || inQuietHours(prefs)) {
    return { telegramDm: false, telegramChannel: false, push: false };
  }

  let telegramDm = false;
  let telegramChannel = false;
  let push = false;

  if (prefs.telegramEnabled) {
    const chatId = await getUserTelegramChatId(userId);
    if (chatId) {
      telegramDm = await sendTelegramMessage(chatId, formatTradeExecutedDm(payload));
    }
  }

  if (isTelegramChannelEnabled()) {
    const dedupeKey = `trade_${payload.symbol}_${payload.direction}`;
    const skip = await shouldDedupeChannel(dedupeKey);
    if (!skip) {
      telegramChannel = await sendTelegramChannelMessage(formatTradeExecutedChannel(payload));
    }
  }

  if (prefs.pushEnabled) {
    push = await sendFcmToUser(
      userId,
      'Trade Executed',
      `${payload.symbol} ${payload.direction} @ ${payload.entry}`,
      {
        type: 'trade_executed',
        symbol: payload.symbol,
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://tradeintelai.vercel.app'}/dashboard?tab=trade&symbol=${encodeURIComponent(payload.symbol)}`,
      }
    );
  }

  return { telegramDm, telegramChannel, push };
}

export async function dispatchExecutableSignal(
  userId: string,
  payload: ExecutableSignalPayload
): Promise<{ telegramChannel: boolean; push: boolean }> {
  const prefs = await getUserNotificationPrefs(userId);
  if (!prefs.executableSignal || inQuietHours(prefs)) {
    return { telegramChannel: false, push: false };
  }

  let telegramChannel = false;
  let push = false;

  if (isTelegramChannelEnabled()) {
    const dedupeKey = `signal_${payload.symbol}_${payload.recommendation}`;
    const skip = await shouldDedupeChannel(dedupeKey);
    if (!skip) {
      telegramChannel = await sendTelegramChannelMessage(
        formatExecutableSignalChannel(payload.symbol, payload.recommendation, payload.score)
      );
    }
  }

  if (prefs.pushEnabled) {
    push = await sendFcmToUser(
      userId,
      'Executable Signal',
      `${payload.symbol} ${payload.recommendation} (${Math.round(payload.score)})`,
      {
        type: 'executable_signal',
        symbol: payload.symbol,
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://tradeintelai.vercel.app'}/dashboard?tab=scan&symbol=${encodeURIComponent(payload.symbol)}&approve=1`,
      }
    );
  }

  return { telegramChannel, push };
}

export async function linkTelegramChat(
  userId: string,
  chatId: string,
  username?: string
): Promise<void> {
  const db = await getAdminFirestore();
  await db.doc(`users/${userId}/settings/notifications`).set(
    {
      telegramChatId: chatId,
      telegramLinkedAt: new Date().toISOString(),
      telegramUsername: username ?? null,
      telegramEnabled: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  await db.doc(`telegramLinks/${chatId}`).set({ userId, updatedAt: new Date() });
}

export async function unlinkTelegramChat(userId: string): Promise<void> {
  const db = await getAdminFirestore();
  const snap = await db.doc(`users/${userId}/settings/notifications`).get();
  const chatId = snap.data()?.telegramChatId;
  await db.doc(`users/${userId}/settings/notifications`).set(
    {
      telegramChatId: null,
      telegramLinkedAt: null,
      telegramUsername: null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  if (chatId) {
    await db.doc(`telegramLinks/${chatId}`).delete();
  }
}

export async function consumeTelegramLinkToken(
  token: string,
  chatId: string,
  username?: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const db = await getAdminFirestore();
  const ref = db.doc(`telegramLinkTokens/${token}`);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, error: 'Invalid or expired link token' };
  }
  const data = snap.data()!;
  const expiresAt = data.expiresAt?.toMillis?.() ?? 0;
  if (Date.now() > expiresAt) {
    await ref.delete();
    return { ok: false, error: 'Link token expired — generate a new one in Settings' };
  }
  const userId = data.userId as string;
  await linkTelegramChat(userId, chatId, username);
  await ref.delete();
  return { ok: true, userId };
}

export async function findUserIdByTelegramChat(chatId: string): Promise<string | null> {
  try {
    const db = await getAdminFirestore();
    const snap = await db.doc(`telegramLinks/${chatId}`).get();
    if (snap.exists) return (snap.data()?.userId as string) ?? null;
  } catch {
    /* ignore */
  }
  return null;
}

export async function createTelegramLinkToken(userId: string): Promise<string> {
  const { randomUUID } = await import('crypto');
  const db = await getAdminFirestore();
  const token = `LINK_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.doc(`telegramLinkTokens/${token}`).set({
    userId,
    expiresAt,
    createdAt: new Date(),
  });
  return token;
}
