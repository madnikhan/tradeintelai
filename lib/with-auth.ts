/**
 * Shared API route authentication helpers.
 * Use at the start of every protected API route handler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
export { isTestApiRoute, isProtectedApiRoute } from '@/lib/api-route-guards';

export type ApiAuthResult = {
  authorized: boolean;
  userId?: string;
  error?: string;
};

/**
 * Verify auth for an API route. Returns null if authorized, or a 401 NextResponse.
 */
export async function requireApiAuth(
  request: NextRequest
): Promise<NextResponse | null> {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }
  return null;
}

/**
 * Verify auth and return user id. Throws 401 response via return value pattern.
 */
export async function requireApiAuthWithUser(
  request: NextRequest
): Promise<{ userId: string } | NextResponse> {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }
  return { userId: auth.userId || 'unknown' };
}
