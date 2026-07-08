import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  generatePairingCode,
  PAIRING_CODE_TTL_MS,
} from '@/lib/firebase/bridge-agent';

/** Create a 6-digit pairing code for home bridge setup. */
export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getAdminFirestore();
    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString();

    await db.collection('bridgePairingCodes').doc(code).set({
      code,
      uid: auth.userId,
      expiresAt,
      used: false,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      code,
      expiresInMinutes: Math.round(PAIRING_CODE_TTL_MS / 60000),
      expiresAt,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create pairing code';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
