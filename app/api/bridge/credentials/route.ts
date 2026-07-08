import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { bridgeAgentDocPath } from '@/lib/firebase/bridge-agent';

/** Return bridge API token + URL for authenticated dashboard (server-side only storage). */
export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getAdminFirestore();
    const [agentSnap, privateSnap] = await Promise.all([
      db.doc(bridgeAgentDocPath(auth.userId)).get(),
      db.doc(`users/${auth.userId}/private/bridge`).get(),
    ]);

    const agent = agentSnap.data();
    const priv = privateSnap.data();

    if (!priv?.apiToken) {
      return NextResponse.json({ paired: false, error: 'Bridge not paired' }, { status: 404 });
    }

    return NextResponse.json({
      paired: true,
      bridgeUrl: agent?.bridgeUrl ?? null,
      apiToken: priv.apiToken,
      mt5Connected: agent?.mt5Connected === true,
      lastSeen: agent?.lastSeen ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load bridge credentials';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
