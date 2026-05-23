/**
 * Shared Firebase Admin initialization (server-side only).
 */

import { loadFirebaseServiceAccount } from '@/lib/parse-firebase-service-account';

type AdminModule = typeof import('firebase-admin');
type AdminApp = import('firebase-admin').app.App;

let initPromise: Promise<AdminApp | null> | null = null;

async function loadAdmin(): Promise<AdminModule> {
  return import('firebase-admin');
}

export async function getAdminApp(): Promise<AdminApp | null> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const admin = await loadAdmin();

    if (admin.apps.length > 0) {
      return admin.apps[0]!;
    }

    const serviceAccount = await loadFirebaseServiceAccount();
    if (!serviceAccount) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ No Firebase service account — Firestore Admin calls will fail');
      } else {
        console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY required for server-side Firestore');
      }
      return null;
    }

    const projectId =
      (serviceAccount.project_id as string | undefined) ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    console.log('✅ Loaded Firebase service account');
    return admin.initializeApp({
      credential: admin.credential.cert(
        serviceAccount as Parameters<typeof admin.credential.cert>[0]
      ),
      projectId,
    });
  })();

  return initPromise;
}

export async function getAdminFirestore() {
  const app = await getAdminApp();
  if (!app) {
    throw new Error('Firebase Admin is not configured');
  }
  const admin = await loadAdmin();
  return admin.firestore(app);
}

export async function getAdminAuth() {
  const app = await getAdminApp();
  if (!app) return null;
  const admin = await loadAdmin();
  return admin.auth(app);
}
