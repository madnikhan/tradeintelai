import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { autoPilotStatusPath } from '@/lib/firebase/auto-pilot';
import type { AutoPilotDaemonStatus } from '@/lib/auto-pilot/types';

/** Daemon posts status every scan cycle (Firebase ID token). */
export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<AutoPilotDaemonStatus>;
    const db = await getAdminFirestore();
    await db.doc(autoPilotStatusPath(auth.userId)).set(
      {
        ...body,
        userId: auth.userId,
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
