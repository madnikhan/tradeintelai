import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  hashBridgeToken,
  bridgeAgentDocPath,
  type BridgeTunnelType,
} from '@/lib/firebase/bridge-agent';

interface HeartbeatBody {
  bridgeUrl?: string | null;
  mt5Connected?: boolean;
  accountLogin?: string | number;
  tunnelType?: BridgeTunnelType;
  bridgeVersion?: string;
}

async function verifyBridgeToken(token: string): Promise<string | null> {
  const db = await getAdminFirestore();
  const tokenHash = hashBridgeToken(token);
  const snap = await db.collection('bridgeTokens').doc(tokenHash).get();
  if (!snap.exists) return null;
  return (snap.data()?.uid as string) || null;
}

/** Heartbeat from home bridge agent (Bearer bridge token). */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing bridge token' }, { status: 401 });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  let body: HeartbeatBody = {};
  try {
    body = await request.json();
  } catch {
    // empty body OK
  }

  try {
    const uid = await verifyBridgeToken(token);
    if (!uid) {
      return NextResponse.json({ error: 'Invalid bridge token' }, { status: 401 });
    }

    const db = await getAdminFirestore();
    const now = new Date().toISOString();
    const bridgeUrl = body.bridgeUrl?.trim() || null;

    const update: Record<string, unknown> = {
      status: 'online',
      lastSeen: now,
      mt5Connected: body.mt5Connected === true,
      agentTokenHash: hashBridgeToken(token),
    };

    if (body.accountLogin != null) update.accountLogin = body.accountLogin;
    if (body.bridgeVersion) update.bridgeVersion = body.bridgeVersion;
    if (body.tunnelType) update.tunnelType = body.tunnelType;
    if (bridgeUrl) update.bridgeUrl = bridgeUrl;

    await db.doc(bridgeAgentDocPath(uid)).set(update, { merge: true });

    if (bridgeUrl) {
      await db.doc(`users/${uid}/settings/bridge`).set(
        {
          bridgeUrl,
          bridgeSetupComplete: true,
          updatedAt: now,
        },
        { merge: true }
      );
    }

    return NextResponse.json({ success: true, uid, lastSeen: now });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Heartbeat failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Read bridge presence for authenticated user. */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Firebase ID token from dashboard
  const { verifyApiAuth } = await import('@/lib/api-auth');
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getAdminFirestore();
    const snap = await db.doc(bridgeAgentDocPath(auth.userId)).get();
    if (!snap.exists) {
      return NextResponse.json({ paired: false, status: 'offline' });
    }
    return NextResponse.json({ paired: true, ...snap.data() });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to read presence';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
