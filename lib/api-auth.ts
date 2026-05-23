/**
 * API Authentication Middleware
 * Verifies Firebase Auth tokens for API route protection
 *
 * Production: requires Firebase Admin verifyIdToken (set FIREBASE_SERVICE_ACCOUNT_KEY)
 * Development: allows unauthenticated requests for local testing
 */

import { NextRequest } from 'next/server';
import { getAdminAuth as getSharedAdminAuth } from '@/lib/firebase/admin';

type FirebaseAdminAuth = Awaited<ReturnType<typeof getSharedAdminAuth>>;

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';

async function getAdminAuth(): Promise<FirebaseAdminAuth> {
  try {
    return await getSharedAdminAuth();
  } catch (error) {
    console.warn('⚠️ Firebase Admin not available:', error);
    return null;
  }
}

/**
 * Verify Firebase Auth token from request.
 * Returns user ID if valid.
 */
export async function verifyApiAuth(request: NextRequest): Promise<{
  authorized: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    const authHeader = request.headers.get('authorization');

    // Development: allow requests without auth for local testing
    if (isDevelopment && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return { authorized: true, userId: 'dev-user' };
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        authorized: false,
        error: 'Missing or invalid authorization header. Expected: Bearer <token>',
      };
    }

    const token = authHeader.split('Bearer ')[1]?.trim();
    if (!token) {
      return { authorized: false, error: 'Token not provided' };
    }

    const adminAuthInstance = await getAdminAuth();

    if (!adminAuthInstance) {
      // Signed-in UI still sends tokens in dev; allow when Admin SDK is not configured locally
      if (isDevelopment) {
        return { authorized: true, userId: 'dev-user' };
      }
      if (isProduction) {
        return {
          authorized: false,
          error:
            'Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY on the server.',
        };
      }
    }

    if (adminAuthInstance) {
      try {
        const decodedToken = await adminAuthInstance.verifyIdToken(token);
        return { authorized: true, userId: decodedToken.uid };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Invalid token';
        return { authorized: false, error: message };
      }
    }

    // Test environment without Admin SDK: accept well-formed JWT for CI scripts only
    if (isTest && token.length > 20 && token.split('.').length === 3) {
      return { authorized: true, userId: 'test-user' };
    }

    return { authorized: false, error: 'Authentication failed' };
  } catch (error: unknown) {
    console.error('Auth verification error:', error);
    return {
      authorized: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    };
  }
}

export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const auth = await verifyApiAuth(request);
  return auth.authorized;
}
