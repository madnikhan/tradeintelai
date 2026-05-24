import Stripe from 'stripe';
import { upsertUserSubscription } from '@/lib/stripe/subscription-store';
import type { SubscriptionStatus } from '@/lib/stripe/types';

export function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'unpaid':
      return 'unpaid';
    default:
      return 'none';
  }
}

/** Basil API (2025-03-31+) stores billing periods on subscription items, not the subscription root. */
function getSubscriptionBillingPeriod(subscription: Stripe.Subscription): {
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
} {
  const item = subscription.items.data[0] as Stripe.SubscriptionItem & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const legacy = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };

  const startSec = item?.current_period_start ?? legacy.current_period_start;
  const endSec = item?.current_period_end ?? legacy.current_period_end;

  const result: { currentPeriodStart?: Date; currentPeriodEnd?: Date } = {};
  if (startSec) result.currentPeriodStart = new Date(startSec * 1000);
  if (endSec) result.currentPeriodEnd = new Date(endSec * 1000);
  return result;
}

export async function syncSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  uid: string
): Promise<void> {
  const billingPeriod = getSubscriptionBillingPeriod(subscription);
  await upsertUserSubscription(uid, {
    status: mapStripeStatus(subscription.status),
    stripeCustomerId:
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    priceId: subscription.items.data[0]?.price?.id,
    ...billingPeriod,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

export async function syncCheckoutSession(sessionId: string, uid: string): Promise<{
  active: boolean;
  status: SubscriptionStatus;
}> {
  const { getStripe } = await import('@/lib/stripe/stripe-client');
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  });

  const sessionUid = session.client_reference_id || session.metadata?.firebaseUid;
  if (sessionUid !== uid) {
    throw new Error('Checkout session does not belong to this user');
  }

  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return { active: false, status: 'none' };
  }

  if (!session.subscription) {
    return { active: false, status: 'none' };
  }

  const subscription =
    typeof session.subscription === 'string'
      ? await stripe.subscriptions.retrieve(session.subscription)
      : session.subscription;

  await syncSubscriptionFromStripe(subscription, uid);
  const status = mapStripeStatus(subscription.status);
  return {
    active: status === 'active' || status === 'trialing',
    status,
  };
}

export async function syncSubscriptionForUser(
  uid: string,
  email?: string
): Promise<{ active: boolean; status: SubscriptionStatus }> {
  const { getStripe } = await import('@/lib/stripe/stripe-client');
  const { getUserSubscription } = await import('@/lib/stripe/subscription-store');
  const stripe = getStripe();

  let customerId: string | undefined;
  try {
    const existing = await getUserSubscription(uid);
    customerId = existing.stripeCustomerId;
  } catch {
    // Firestore may be empty; fall back to Stripe lookup below
  }

  if (!customerId && email) {
    const customers = await stripe.customers.list({ email, limit: 5 });
    const match = customers.data.find((c) => c.metadata?.firebaseUid === uid) ?? customers.data[0];
    customerId = match?.id;
  }

  if (!customerId) {
    const customers = await stripe.customers.search({
      query: `metadata['firebaseUid']:'${uid}'`,
      limit: 1,
    });
    customerId = customers.data[0]?.id;
  }

  if (!customerId) {
    return { active: false, status: 'none' };
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  });

  const subscription =
    subscriptions.data.find((s) => s.status === 'active' || s.status === 'trialing') ??
    subscriptions.data[0];

  if (!subscription) {
    return { active: false, status: 'none' };
  }

  await syncSubscriptionFromStripe(subscription, uid);
  const status = mapStripeStatus(subscription.status);
  return {
    active: status === 'active' || status === 'trialing',
    status,
  };
}
