/**
 * Verify home-bridge Bearer token → uid (shared by heartbeat / Auto Pilot config sync).
 */

import { getAdminFirestore } from '@/lib/firebase/admin';
import { hashBridgeToken } from '@/lib/firebase/bridge-agent';

export async function verifyBridgeBearerToken(
  authHeader: string | null
): Promise<{ uid: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const db = await getAdminFirestore();
  const tokenHash = hashBridgeToken(token);
  const snap = await db.collection('bridgeTokens').doc(tokenHash).get();
  if (!snap.exists) return null;
  const uid = snap.data()?.uid as string | undefined;
  return uid ? { uid } : null;
}
