import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { getUserSubscription } from '@/lib/stripe/subscription-store';
import { canAccessApp } from '@/lib/subscription-access';
import {
  type BridgePlatform,
  CONTENT_TYPES,
  downloadGithubAsset,
  findGithubReleaseInstaller,
  findLocalInstaller,
  readLocalInstaller,
} from '@/lib/bridge-desktop-artifacts';

function detectPlatform(userAgent: string, override?: string | null): BridgePlatform {
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

  const local = await findLocalInstaller(platform);
  if (local) {
    const buffer = await readLocalInstaller(local.filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': CONTENT_TYPES[platform],
        'Content-Disposition': `attachment; filename="${local.filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Bridge-Platform': platform,
        'X-Bridge-Source': 'local',
      },
    });
  }

  const github = await findGithubReleaseInstaller(platform);
  if (github) {
    try {
      const buffer = await downloadGithubAsset(github.asset);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': github.contentType,
          'Content-Disposition': `attachment; filename="${github.asset.name}"`,
          'Cache-Control': 'private, no-store',
          'X-Bridge-Platform': platform,
          'X-Bridge-Source': 'github-release',
        },
      });
    } catch (e) {
      console.error('[bridge-desktop download] GitHub asset fetch failed:', e);
    }
  }

  return NextResponse.json(
    {
      error: `Desktop installer for ${platform} is not available yet. Installers are built automatically — try again in a few minutes.`,
      platform,
    },
    { status: 503 }
  );
}
