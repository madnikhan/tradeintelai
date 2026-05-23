/**
 * Per-user bridge URL settings (Firestore + localStorage fallback).
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '@/lib/firebase/config';
import { getUserId } from '@/lib/firebase/auth';

export type BridgeMode = 'direct' | 'router';

export interface UserBridgeSettings {
  bridgeUrl: string | null;
  bridgeMode: BridgeMode;
}

const LOCAL_KEY = 'user_bridge_settings';

function localFallback(): UserBridgeSettings {
  if (typeof window === 'undefined') {
    return { bridgeUrl: null, bridgeMode: 'direct' };
  }
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { bridgeUrl: null, bridgeMode: 'direct' };
}

export async function loadUserBridgeSettings(): Promise<UserBridgeSettings> {
  const uid = getUserId();
  if (!uid || uid === 'anonymous' || !isFirebaseConfigured()) {
    return localFallback();
  }
  try {
    const ref = doc(getDb(), 'users', uid, 'settings', 'bridge');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const settings: UserBridgeSettings = {
        bridgeUrl: data.bridgeUrl ?? null,
        bridgeMode: data.bridgeMode === 'router' ? 'router' : 'direct',
      };
      localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
      if (settings.bridgeUrl) {
        localStorage.setItem('bridge_url', settings.bridgeUrl);
      }
      return settings;
    }
  } catch (e) {
    console.warn('loadUserBridgeSettings:', e);
  }
  return localFallback();
}

export async function saveUserBridgeSettings(settings: UserBridgeSettings): Promise<void> {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
  if (settings.bridgeUrl) {
    localStorage.setItem('bridge_url', settings.bridgeUrl);
  }
  const uid = getUserId();
  if (!uid || uid === 'anonymous' || !isFirebaseConfigured()) return;
  const ref = doc(getDb(), 'users', uid, 'settings', 'bridge');
  await setDoc(ref, { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
}
