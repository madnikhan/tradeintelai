export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid';

export interface UserSubscription {
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  priceId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  updatedAt?: Date;
}

export function isSubscriptionActive(status: SubscriptionStatus | undefined): boolean {
  return status === 'active' || status === 'trialing';
}
