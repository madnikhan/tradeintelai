import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { getStripe, getStripePriceId, isStripeConfigured } from '@/lib/stripe/stripe-client';
import { getUserSubscription, upsertUserSubscription } from '@/lib/stripe/subscription-store';
import { isSubscriptionBypassed } from '@/lib/subscription-access';

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const email = request.headers.get('x-user-email') || undefined;
  if (isSubscriptionBypassed(auth.userId, email)) {
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.json({ url: `${origin}/onboarding`, bypassed: true });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          'Stripe is not configured. Add STRIPE_SECRET_KEY and STRIPE_PRICE_ID to .env.local, or set SUBSCRIPTION_SKIP_IN_DEV=true.',
      },
      { status: 503 }
    );
  }
  try {
    const stripe = getStripe();
    const priceId = getStripePriceId();

    let customerId: string | undefined;
    try {
      const existing = await getUserSubscription(auth.userId);
      customerId = existing.stripeCustomerId;
    } catch (firestoreError) {
      console.warn(
        'Firestore unavailable during checkout; creating Stripe customer without cache:',
        firestoreError instanceof Error ? firestoreError.message : firestoreError
      );
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { firebaseUid: auth.userId },
        email: email || undefined,
      });
      customerId = customer.id;
      try {
        await upsertUserSubscription(auth.userId, {
          status: 'none',
          stripeCustomerId: customerId,
        });
      } catch (persistError) {
        console.warn(
          'Could not persist Stripe customer to Firestore (checkout continues):',
          persistError instanceof Error ? persistError.message : persistError
        );
      }
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: auth.userId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/subscribe?canceled=1`,
      subscription_data: {
        metadata: { firebaseUid: auth.userId },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Checkout failed';
    console.error('Stripe checkout error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
