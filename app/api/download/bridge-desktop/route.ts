import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { verifyApiAuth } from '@/lib/api-auth';
import { getUserSubscription } from '@/lib/stripe/subscription-store';
import { canAccessApp } from '@/lib/subscription-access';

type Platform = 'windows' | 'mac' | 'linux';

const ARTIFACTS: Record<Platform, { file: string; contentType: string }> = {
  windows: {
    file: 'TradeIntelBridge_1.0.0_x64_en-US.msi',
    contentType: 'application/x-msi',
  },
  mac: {
    file: 'TradeIntelBridge_1.0.0_x64.dmg',
    contentType: 'application/x-apple-diskimage',
  },
  linux: {
    file: 'tradeintel-bridge_1.0.0_amd64.AppImage',
    contentType: 'application/x-executable',
  },
};

function detectPlatform(userAgent: string, override?: string | null): Platform {
  if (override === 'windows' || override === 'mac' || override === 'linux') {
    return override;
  }
  const ua = userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'mac';
  return 'linux';
}

export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const email = request.headers.get('x-user-email') || undefined;
  const sub = await getUserSubscription(auth.userId);
  if (!canAccessApp(sub.status, auth.userId, email)) {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
  }

  const platformParam = request.nextUrl.searchParams.get('platform');
  const platform = detectPlatform(request.headers.get('user-agent') || '', platformParam);
  const artifact = ARTIFACTS[platform];
  const baseDir = path.join(process.cwd(), 'private', 'downloads', 'bridge-desktop');
  const filePath = path.join(baseDir, artifact.file);

  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': artifact.contentType,
        'Content-Disposition': `attachment; filename="${artifact.file}"`,
        'Cache-Control': 'private, no-store',
        'X-Bridge-Platform': platform,
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: `Desktop installer for ${platform} not built yet. Build with: cd bridge-desktop && npm run build:desktop`,
        platform,
        expectedFile: artifact.file,
      },
      { status: 503 }
    );
  }
}
