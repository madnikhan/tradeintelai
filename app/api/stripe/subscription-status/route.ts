import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { getUserSubscription } from '@/lib/stripe/subscription-store';
import { canAccessApp, isSubscriptionBypassed } from '@/lib/subscription-access';

export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const email = request.headers.get('x-user-email') || undefined;

  if (isSubscriptionBypassed(auth.userId, email)) {
    return NextResponse.json({
      status: 'active',
      active: true,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      bypassed: true,
    });
  }

  try {
    const sub = await getUserSubscription(auth.userId);
    const active = canAccessApp(sub.status, auth.userId, email);

    return NextResponse.json({
      status: sub.status,
      active,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Subscription lookup failed';
    console.warn('subscription-status Firestore error:', message);

    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        status: 'none',
        active: false,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        warning:
          'Firestore unavailable. Set SUBSCRIPTION_SKIP_IN_DEV=true or fix FIREBASE_SERVICE_ACCOUNT_KEY (use firebase-service-account.json).',
      });
    }

    return NextResponse.json({ error: 'Subscription service unavailable' }, { status: 503 });
  }
}
