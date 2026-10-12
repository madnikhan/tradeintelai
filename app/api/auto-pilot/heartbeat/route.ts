import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { verifyBridgeBearerToken } from '@/lib/bridge-token-auth';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { autoPilotStatusPath } from '@/lib/firebase/auto-pilot';
import type { AutoPilotDaemonStatus } from '@/lib/auto-pilot/types';

/** Daemon posts status every scan cycle (Firebase ID or bridge token). */
export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  let userId = auth.authorized ? auth.userId : null;
  if (!userId) {
    const bridge = await verifyBridgeBearerToken(
      request.headers.get('authorization')
    );
    userId = bridge?.uid ?? null;
  }
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<AutoPilotDaemonStatus>;
    const db = await getAdminFirestore();
    await db.doc(autoPilotStatusPath(userId)).set(
      {
        ...body,
        userId,
        heartbeatAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Heartbeat failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
