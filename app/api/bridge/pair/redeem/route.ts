import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  generateBridgeToken,
  hashBridgeToken,
  bridgeAgentDocPath,
} from '@/lib/firebase/bridge-agent';

interface RedeemBody {
  code?: string;
  bridgeUrl?: string | null;
  tokenHash?: string;
}

/** Redeem pairing code from home bridge (no Firebase user auth — code is the secret). */
export async function POST(request: NextRequest) {
  let body: RedeemBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const code = body.code?.trim();
  if (!code || code.length !== 6) {
    return NextResponse.json({ error: 'Valid 6-digit code required' }, { status: 400 });
  }

  try {
    const db = await getAdminFirestore();
    const pairingRef = db.collection('bridgePairingCodes').doc(code);
    const pairingSnap = await pairingRef.get();

    if (!pairingSnap.exists) {
      return NextResponse.json({ error: 'Invalid or expired pairing code' }, { status: 404 });
    }

    const pairing = pairingSnap.data()!;
    if (pairing.used) {
      return NextResponse.json({ error: 'Pairing code already used' }, { status: 410 });
    }
    if (pairing.expiresAt && new Date(pairing.expiresAt as string) < new Date()) {
      return NextResponse.json({ error: 'Pairing code expired' }, { status: 410 });
    }

    const uid = pairing.uid as string;
    if (!uid) {
      return NextResponse.json({ error: 'Invalid pairing record' }, { status: 500 });
    }

    const bridgeToken = generateBridgeToken();
    const tokenHash = hashBridgeToken(bridgeToken);
    const bridgeUrl = body.bridgeUrl?.trim() || null;
    const now = new Date().toISOString();

    await db.doc(bridgeAgentDocPath(uid)).set(
      {
        bridgeUrl,
        tunnelType: bridgeUrl ? 'ephemeral' : 'named',
        status: 'online',
        lastSeen: now,
        mt5Connected: false,
        agentTokenHash: tokenHash,
        pairedAt: now,
      },
      { merge: true }
    );

    await db.collection('bridgeTokens').doc(tokenHash).set({
      uid,
      createdAt: now,
    });

    await db.doc(`users/${uid}/private/bridge`).set({
      apiToken: bridgeToken,
      updatedAt: now,
    });

    if (bridgeUrl) {
      await db.doc(`users/${uid}/settings/bridge`).set(
        {
          bridgeUrl,
          bridgeMode: 'direct',
          bridgeSetupComplete: true,
          updatedAt: now,
        },
        { merge: true }
      );
    }

    await pairingRef.update({ used: true, usedAt: now });

    return NextResponse.json({
      success: true,
      uid,
      bridgeToken,
      message: 'Bridge paired successfully',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Pairing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
