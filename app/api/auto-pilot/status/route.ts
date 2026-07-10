import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { autoPilotStatusPath } from '@/lib/firebase/auto-pilot';
import type { AutoPilotDaemonStatus } from '@/lib/auto-pilot/types';

export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getAdminFirestore();
    const snap = await db.doc(autoPilotStatusPath(auth.userId)).get();
    if (!snap.exists) {
      return NextResponse.json({
        status: null,
        message: 'No daemon heartbeat yet — start Auto Pilot from Bridge Desktop',
      });
    }
    return NextResponse.json({ status: snap.data() as AutoPilotDaemonStatus });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
