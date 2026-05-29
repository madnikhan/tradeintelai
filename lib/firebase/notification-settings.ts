/**
 * User notification preferences + Telegram link data (Firestore).
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '@/lib/firebase/config';
import { getUserId } from '@/lib/firebase/auth';
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from '@/lib/notifications/types';

export interface UserTelegramProfile {
  telegramChatId: string | null;
  telegramLinkedAt: string | null;
  telegramUsername?: string | null;
}

export interface UserNotificationSettings extends NotificationPrefs, UserTelegramProfile {}

const LOCAL_PREFS_KEY = 'notification_prefs';

function profileRef(uid: string) {
  return doc(getDb(), 'users', uid, 'settings', 'notifications');
}

export async function loadNotificationSettings(): Promise<UserNotificationSettings> {
  const defaults: UserNotificationSettings = {
    ...DEFAULT_NOTIFICATION_PREFS,
    telegramChatId: null,
    telegramLinkedAt: null,
    telegramUsername: null,
  };

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_PREFS_KEY);
      if (raw) Object.assign(defaults, JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }

  const uid = getUserId();
  if (!uid || uid === 'anonymous' || !isFirebaseConfigured()) {
    return defaults;
  }

  try {
    const snap = await getDoc(profileRef(uid));
    if (snap.exists()) {
      const data = snap.data();
      const merged = { ...defaults, ...data } as UserNotificationSettings;
      localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (e) {
    console.warn('loadNotificationSettings:', e);
  }
  return defaults;
}

export async function saveNotificationSettings(
  prefs: Partial<UserNotificationSettings>
): Promise<void> {
  const current = await loadNotificationSettings();
  const merged = { ...current, ...prefs, updatedAt: new Date().toISOString() };
  localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(merged));

  const uid = getUserId();
  if (!uid || uid === 'anonymous' || !isFirebaseConfigured()) return;
  await setDoc(profileRef(uid), merged, { merge: true });
}

/** Client-readable Telegram link status via API; local cache only here. */
export function getCachedTelegramLinked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(LOCAL_PREFS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return Boolean(data.telegramChatId);
  } catch {
    return false;
  }
}
