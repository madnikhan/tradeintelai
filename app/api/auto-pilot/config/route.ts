import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { verifyBridgeBearerToken } from '@/lib/bridge-token-auth';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  autoPilotConfigPath,
  mergeAutoPilotConfig,
} from '@/lib/firebase/auto-pilot';
import type { AutoPilotConfig } from '@/lib/auto-pilot/types';
import { getUserSubscription } from '@/lib/stripe/subscription-store';
import { canAccessApp } from '@/lib/subscription-access';

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const auth = await verifyApiAuth(request);
  if (auth.authorized && auth.userId) return auth.userId;

  const bridge = await verifyBridgeBearerToken(
    request.headers.get('authorization')
  );
  return bridge?.uid ?? null;
}

export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getAdminFirestore();
    const snap = await db.doc(autoPilotConfigPath(userId)).get();
    const config = mergeAutoPilotConfig(snap.data() as Partial<AutoPilotConfig>);
    return NextResponse.json({ config });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load config';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  try {
    const sub = await getUserSubscription(auth.userId);
    if (!canAccessApp(sub.status, auth.userId)) {
      return NextResponse.json(
        { error: 'Active subscription required' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Partial<AutoPilotConfig>;
    const config = mergeAutoPilotConfig({
      ...body,
      updatedAt: new Date().toISOString(),
    });
    const db = await getAdminFirestore();
    await db.doc(autoPilotConfigPath(auth.userId)).set(config, { merge: true });
    return NextResponse.json({ config });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to save config';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
