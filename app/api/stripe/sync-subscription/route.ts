import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { syncSubscriptionForUser } from '@/lib/stripe/sync-subscription';

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const email = request.headers.get('x-user-email') || undefined;

  try {
    const result = await syncSubscriptionForUser(auth.userId, email);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    console.error('sync-subscription:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
