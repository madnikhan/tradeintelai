/**
 * Firebase Cloud Messaging (client-side registration).
 */

import { getMessaging, getToken, isSupported, type Messaging } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { getApp, getDb, isFirebaseConfigured } from '@/lib/firebase/config';
import { getUserId } from '@/lib/firebase/auth';

let messagingInstance: Messaging | null = null;

export async function isPushSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  return isSupported();
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (!isFirebaseConfigured()) return null;
  if (messagingInstance) return messagingInstance;
  const supported = await isPushSupported();
  if (!supported) return null;
  const app = getApp();
  if (!app) return null;
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

function deviceId(): string {
  const key = 'fcm_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `web_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export async function registerFcmToken(): Promise<string | null> {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn('[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY not set');
    return null;
  }

  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
  });

  const uid = getUserId();
  if (!uid || uid === 'anonymous') return token;

  const id = deviceId();
  await setDoc(
    doc(getDb(), 'users', uid, 'devices', id),
    {
      fcmToken: token,
      platform: 'web',
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return token;
}
