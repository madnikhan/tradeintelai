import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { verifyApiAuth } from '@/lib/api-auth';
import { getUserSubscription } from '@/lib/stripe/subscription-store';
import { canAccessApp } from '@/lib/subscription-access';

export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sub = await getUserSubscription(auth.userId);
  if (!canAccessApp(sub.status, auth.userId)) {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
  }

  const zipPath = path.join(process.cwd(), 'public', 'downloads', 'tradeintel-bridge.zip');
  try {
    const buffer = await readFile(zipPath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="tradeintel-bridge.zip"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Bridge package not built. Run scripts/build-bridge-download.sh' },
      { status: 503 }
    );
  }
}
