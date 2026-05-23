import Stripe from 'stripe';

let stripe: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_PRICE_ID?.trim());
}

export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error(
        'STRIPE_SECRET_KEY is not configured. Add it to .env.local or set SUBSCRIPTION_SKIP_IN_DEV=true for local dev.'
      );
    }
    stripe = new Stripe(key);
  }
  return stripe;
}

export function getStripePriceId(): string {
  const priceId = process.env.STRIPE_PRICE_ID?.trim();
  if (!priceId) {
    throw new Error('STRIPE_PRICE_ID is not configured');
  }
  return priceId;
}
