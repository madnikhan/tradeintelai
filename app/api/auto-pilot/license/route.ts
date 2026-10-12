import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { verifyBridgeBearerToken } from '@/lib/bridge-token-auth';
import { getUserSubscription } from '@/lib/stripe/subscription-store';
import { canAccessApp } from '@/lib/subscription-access';
import { createHmac, randomBytes } from 'crypto';

const LICENSE_TTL_SEC = 3600;

function signLicense(userId: string, expiresAt: number): string {
  const secret =
    process.env.AUTO_PILOT_LICENSE_SECRET ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.slice(0, 32) ||
    'dev-auto-pilot-secret';
  return createHmac('sha256', secret)
    .update(`${userId}:${expiresAt}`)
    .digest('hex');
}

/** Issue short-lived license token for Auto Pilot daemon (Firebase ID or bridge token). */
export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  let userId = auth.authorized ? auth.userId : null;
  if (!userId) {
    const bridge = await verifyBridgeBearerToken(
      request.headers.get('authorization')
    );
    userId = bridge?.uid ?? null;
  }
  if (!userId) {
    return NextResponse.json(
      { valid: false, error: auth.error ?? 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const sub = await getUserSubscription(userId);
    const active = canAccessApp(sub.status, userId);
    if (!active) {
      return NextResponse.json({
        valid: false,
        error: 'Active subscription required for Auto Pilot',
      });
    }

    const expiresAt = Math.floor(Date.now() / 1000) + LICENSE_TTL_SEC;
    const signature = signLicense(userId, expiresAt);
    const nonce = randomBytes(8).toString('hex');
    const token = `${userId}.${expiresAt}.${nonce}.${signature}`;

    return NextResponse.json({
      valid: true,
      token,
      expiresAt,
      userId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'License check failed';
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        valid: true,
        token: 'dev-license',
        expiresAt: Math.floor(Date.now() / 1000) + LICENSE_TTL_SEC,
        warning: message,
      });
    }
    return NextResponse.json({ valid: false, error: message }, { status: 503 });
  }
}
