import type { SubscriptionStatus, UserSubscription } from '@/lib/stripe/types';
import { getAdminFirestore } from '@/lib/firebase/admin';

function subscriptionRef(uid: string) {
  return getAdminFirestore().then((db) => db.doc(`users/${uid}/subscription/current`));
}

export async function getUserSubscription(uid: string): Promise<UserSubscription> {
  try {
    const ref = await subscriptionRef(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return { status: 'none' };
    }
    const data = snap.data()!;
    return {
      status: (data.status as SubscriptionStatus) || 'none',
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      priceId: data.priceId,
      currentPeriodStart: data.currentPeriodStart?.toDate?.(),
      currentPeriodEnd: data.currentPeriodEnd?.toDate?.(),
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      updatedAt: data.updatedAt?.toDate?.(),
    };
  } catch (error) {
    console.warn('getUserSubscription failed:', error);
    throw error;
  }
}

export async function upsertUserSubscription(
  uid: string,
  data: Partial<UserSubscription> & { status: SubscriptionStatus }
): Promise<void> {
  const ref = await subscriptionRef(uid);
  const admin = await import('firebase-admin');
  const payload: Record<string, unknown> = {
    status: data.status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (data.stripeCustomerId !== undefined) payload.stripeCustomerId = data.stripeCustomerId;
  if (data.stripeSubscriptionId !== undefined) payload.stripeSubscriptionId = data.stripeSubscriptionId;
  if (data.priceId !== undefined) payload.priceId = data.priceId;
  if (data.cancelAtPeriodEnd !== undefined) payload.cancelAtPeriodEnd = data.cancelAtPeriodEnd;
  if (data.currentPeriodStart instanceof Date) {
    payload.currentPeriodStart = admin.firestore.Timestamp.fromDate(data.currentPeriodStart);
  }
  if (data.currentPeriodEnd instanceof Date) {
    payload.currentPeriodEnd = admin.firestore.Timestamp.fromDate(data.currentPeriodEnd);
  }

  await ref.set(payload, { merge: true });
}

export async function findUidByStripeCustomerId(customerId: string): Promise<string | null> {
  const db = await getAdminFirestore();
  const snap = await db
    .collectionGroup('subscription')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const path = snap.docs[0].ref.path;
  const match = path.match(/^users\/([^/]+)\//);
  return match?.[1] ?? null;
}
