import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { verifyApiAuth } from '@/lib/api-auth';
import { getUserSubscription } from '@/lib/stripe/subscription-store';
import { canAccessApp } from '@/lib/subscription-access';

const ZIP_CANDIDATES = [
  path.join(process.cwd(), 'private', 'downloads', 'tradeintel-bridge.zip'),
  path.join(process.cwd(), 'public', 'downloads', 'tradeintel-bridge.zip'),
];

export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = request.headers.get('x-user-email') || undefined;
  const sub = await getUserSubscription(auth.userId);
  if (!canAccessApp(sub.status, auth.userId, email)) {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
  }

  for (const zipPath of ZIP_CANDIDATES) {
    try {
      const buffer = await readFile(zipPath);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="tradeintel-bridge.zip"',
          'Cache-Control': 'private, no-store',
        },
      });
    } catch {
      /* try next path */
    }
  }

  return NextResponse.json(
    { error: 'Bridge package not built. Run npm run build:bridge' },
    { status: 503 }
  );
}
