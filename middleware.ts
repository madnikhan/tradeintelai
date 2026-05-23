import { NextRequest, NextResponse } from 'next/server';
import { isProtectedApiRoute, isTestApiRoute } from '@/lib/api-route-guards';

const isProduction = process.env.NODE_ENV === 'production';
const isTestEnv = process.env.NODE_ENV === 'test';

/**
 * Global API middleware:
 * - Blocks /api/test/* in production
 * - Requires Authorization header for all other /api/* in production
 * Full Firebase token verification happens in route handlers via verifyApiAuth.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Test routes are dev/CI only
  if (isTestApiRoute(pathname)) {
    if (isProduction) {
      return NextResponse.json(
        { error: 'Test API routes are disabled in production' },
        { status: 404 }
      );
    }
    return NextResponse.next();
  }

  if (!isProtectedApiRoute(pathname)) {
    return NextResponse.next();
  }

  // In development and test, allow routes to apply verifyApiAuth dev bypass
  if (!isProduction && !isTestEnv) {
    return NextResponse.next();
  }

  // Production: require Bearer token at the edge (full verify in route handler)
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ') || authHeader.length < 20) {
    return NextResponse.json(
      { error: 'Missing or invalid authorization header. Expected: Bearer <token>' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
