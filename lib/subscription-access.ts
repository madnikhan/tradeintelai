import { isSubscriptionActive, type SubscriptionStatus } from '@/lib/stripe/types';

export function isSubscriptionBypassed(uid?: string, email?: string | null): boolean {
  if (process.env.NODE_ENV === 'development' && process.env.SUBSCRIPTION_SKIP_IN_DEV === 'true') {
    return true;
  }
  const bypassUids = (process.env.SUBSCRIPTION_BYPASS_UIDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const bypassEmails = (process.env.SUBSCRIPTION_BYPASS_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (uid && bypassUids.includes(uid)) return true;
  if (email && bypassEmails.includes(email.toLowerCase())) return true;
  return false;
}

export function canAccessApp(
  status: SubscriptionStatus | undefined,
  uid?: string,
  email?: string | null
): boolean {
  if (isSubscriptionBypassed(uid, email)) return true;
  return isSubscriptionActive(status);
}
