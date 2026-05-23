import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { getStripe } from '@/lib/stripe/stripe-client';
import { getUserSubscription } from '@/lib/stripe/subscription-store';

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const sub = await getUserSubscription(auth.userId);
    if (!sub.stripeCustomerId) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 400 });
    }

    const stripe = getStripe();
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${origin}/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Portal failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
