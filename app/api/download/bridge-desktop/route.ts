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
  parseMacArchParam,
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

function installerHeaders(
  platform: BridgePlatform,
  filename: string,
  source: string,
  contentLength?: string | number
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': CONTENT_TYPES[platform],
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
    'X-Bridge-Platform': platform,
    'X-Bridge-Source': source,
  };
  if (contentLength != null) {
    headers['Content-Length'] = String(contentLength);
  }
  return headers;
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
  const macArch =
    platform === 'mac' ? parseMacArchParam(request.nextUrl.searchParams.get('arch')) : null;

  const local = await findLocalInstaller(platform, macArch);
  if (local) {
    const buffer = await readLocalInstaller(local.filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: installerHeaders(platform, local.filename, 'local', local.size),
    });
  }

  const github = await findGithubReleaseInstaller(platform, macArch);
  if (github) {
    try {
      const { buffer, contentLength } = await downloadGithubAsset(github.asset);
      return new NextResponse(buffer, {
        headers: installerHeaders(
          platform,
          github.asset.name,
          'github-release',
          contentLength
        ),
      });
    } catch (e) {
      console.error('[bridge-desktop download] GitHub asset fetch failed:', e);
    }
  }

  const archHint =
    platform === 'mac' && macArch === 'x64'
      ? ' Intel (x64) Mac installer is not published yet — try Apple Silicon or contact support.'
      : '';

  return NextResponse.json(
    {
      error: `Desktop installer for ${platform} is not available yet.${archHint} Installers are built automatically — try again in a few minutes.`,
      platform,
      macArch: macArch ?? undefined,
    },
    { status: 503 }
  );
}
