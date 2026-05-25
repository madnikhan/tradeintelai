import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';

export type BridgePlatform = 'windows' | 'mac' | 'linux';
export type MacArch = 'arm64' | 'x64';

const LOCAL_DIR = path.join(process.cwd(), 'private', 'downloads', 'bridge-desktop');
const DEFAULT_RELEASE_TAG = 'bridge-desktop-v1.0.0';
const DEFAULT_REPO = 'madnikhan/tradeintelai';

export const CONTENT_TYPES: Record<BridgePlatform, string> = {
  windows: 'application/x-msi',
  mac: 'application/x-apple-diskimage',
  linux: 'application/x-executable',
};

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'tradeintelai-bridge-download',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function isMacArm64Asset(filename: string): boolean {
  return /aarch64|arm64/i.test(filename);
}

function isMacX64Asset(filename: string): boolean {
  return (
    (/x64|x86_64|intel/i.test(filename) || /\.dmg$/i.test(filename)) &&
    !isMacArm64Asset(filename)
  );
}

function pickMacDmg(filenames: string[], macArch?: MacArch | null): string | undefined {
  const dmgs = filenames.filter((f) => /\.dmg$/i.test(f));
  if (dmgs.length === 0) return undefined;

  if (macArch === 'arm64') {
    return dmgs.find(isMacArm64Asset) ?? dmgs[0];
  }
  if (macArch === 'x64') {
    return dmgs.find(isMacX64Asset);
  }
  return dmgs.find(isMacArm64Asset) ?? dmgs[0];
}

function pickWindowsInstaller(filenames: string[]): string | undefined {
  const msi = filenames.find((f) => /\.msi$/i.test(f));
  if (msi) return msi;
  return filenames.find((f) => /\.exe$/i.test(f));
}

function pickLinuxInstaller(filenames: string[]): string | undefined {
  return filenames.find((f) => /\.AppImage$/i.test(f));
}

function pickInstallerFilename(
  filenames: string[],
  platform: BridgePlatform,
  macArch?: MacArch | null
): string | undefined {
  switch (platform) {
    case 'mac':
      return pickMacDmg(filenames, macArch);
    case 'windows':
      return pickWindowsInstaller(filenames);
    case 'linux':
      return pickLinuxInstaller(filenames);
  }
}

export async function findLocalInstaller(
  platform: BridgePlatform,
  macArch?: MacArch | null
): Promise<{ filePath: string; filename: string; size?: number } | null> {
  try {
    const files = await readdir(LOCAL_DIR);
    const filename = pickInstallerFilename(files, platform, macArch);
    if (!filename) return null;
    const filePath = path.join(LOCAL_DIR, filename);
    const st = await stat(filePath);
    return { filePath, filename, size: st.size };
  } catch {
    return null;
  }
}

interface GithubAsset {
  id: number;
  name: string;
  url: string;
  browser_download_url: string;
  size?: number;
}

interface GithubRelease {
  tag_name: string;
  assets: GithubAsset[];
}

async function fetchReleaseByTag(repo: string, tag: string): Promise<GithubRelease | null> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, {
    headers: githubHeaders(),
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchLatestBridgeRelease(repo: string): Promise<GithubRelease | null> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases`, {
    headers: githubHeaders(),
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const releases: GithubRelease[] = await res.json();
  return releases.find((r) => r.tag_name.startsWith('bridge-desktop-')) ?? null;
}

export async function findGithubReleaseInstaller(
  platform: BridgePlatform,
  macArch?: MacArch | null
): Promise<{ asset: GithubAsset; contentType: string } | null> {
  const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO;
  const tag = process.env.BRIDGE_DESKTOP_RELEASE_TAG || DEFAULT_RELEASE_TAG;
  const release =
    (await fetchReleaseByTag(repo, tag)) ?? (await fetchLatestBridgeRelease(repo));
  if (!release) return null;

  const filename = pickInstallerFilename(
    release.assets.map((a) => a.name),
    platform,
    macArch
  );
  if (!filename) return null;

  const asset = release.assets.find((a) => a.name === filename);
  if (!asset) return null;

  return { asset, contentType: CONTENT_TYPES[platform] };
}

export async function downloadGithubAsset(
  asset: GithubAsset
): Promise<{ buffer: ArrayBuffer; contentLength?: string }> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/octet-stream',
    'User-Agent': 'tradeintelai-bridge-download',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res = await fetch(asset.url, { headers });
  if (!res.ok && asset.browser_download_url) {
    res = await fetch(asset.browser_download_url, {
      headers: { 'User-Agent': 'tradeintelai-bridge-download' },
    });
  }
  if (!res.ok) {
    throw new Error(`GitHub asset download failed (${res.status})`);
  }

  const contentLength =
    res.headers.get('content-length') ??
    (asset.size != null ? String(asset.size) : undefined);

  return {
    buffer: await res.arrayBuffer(),
    contentLength,
  };
}

export async function readLocalInstaller(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

export function parseMacArchParam(value: string | null): MacArch | null {
  if (value === 'arm64' || value === 'aarch64') return 'arm64';
  if (value === 'x64' || value === 'x86_64' || value === 'intel') return 'x64';
  return null;
}
