import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/stripe-client';
import {
  findUidByStripeCustomerId,
  upsertUserSubscription,
} from '@/lib/stripe/subscription-store';
import {
  mapStripeStatus,
  syncSubscriptionFromStripe,
} from '@/lib/stripe/sync-subscription';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid = session.client_reference_id || session.metadata?.firebaseUid;
        if (uid && session.subscription) {
          const subId =
            typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          const subscription = await getStripe().subscriptions.retrieve(subId);
          await syncSubscriptionFromStripe(subscription, uid);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        let uid: string | undefined = subscription.metadata?.firebaseUid || undefined;
        if (!uid) {
          const customerId =
            typeof subscription.customer === 'string'
              ? subscription.customer
              : subscription.customer.id;
          const found = await findUidByStripeCustomerId(customerId);
          if (found) uid = found;
        }
        if (uid) {
          if (event.type === 'customer.subscription.deleted') {
            await upsertUserSubscription(uid, { status: 'canceled', stripeSubscriptionId: subscription.id });
          } else {
            await syncSubscriptionFromStripe(subscription, uid);
          }
        }
        break;
      }
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const subRef = invoice.subscription;
        if (subRef) {
          const subId = typeof subRef === 'string' ? subRef : subRef.id;
          if (event.type === 'invoice.payment_failed') {
            const customerId =
              typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
            if (customerId) {
              const uid = await findUidByStripeCustomerId(customerId);
              if (uid) {
                await upsertUserSubscription(uid, { status: 'past_due', stripeCustomerId: customerId });
              }
            }
            break;
          }
          const subscription = await getStripe().subscriptions.retrieve(subId);
          const customerId =
            typeof subscription.customer === 'string'
              ? subscription.customer
              : subscription.customer.id;
          const uid =
            subscription.metadata?.firebaseUid ||
            (await findUidByStripeCustomerId(customerId)) ||
            undefined;
          if (uid) await syncSubscriptionFromStripe(subscription, uid);
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
