import { readdir, readFile } from 'fs/promises';
import path from 'path';

export type BridgePlatform = 'windows' | 'mac' | 'linux';

const LOCAL_DIR = path.join(process.cwd(), 'private', 'downloads', 'bridge-desktop');
const DEFAULT_RELEASE_TAG = 'bridge-desktop-v1.0.0';
const DEFAULT_REPO = 'madnikhan/tradeintelai';

const PLATFORM_MATCHERS: Record<BridgePlatform, (filename: string) => boolean> = {
  windows: (f) => /\.msi$/i.test(f) || /\.exe$/i.test(f),
  mac: (f) => /\.dmg$/i.test(f),
  linux: (f) => /\.AppImage$/i.test(f),
};

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

export async function findLocalInstaller(
  platform: BridgePlatform
): Promise<{ filePath: string; filename: string } | null> {
  try {
    const files = await readdir(LOCAL_DIR);
    const filename = files.find((f) => PLATFORM_MATCHERS[platform](f));
    if (!filename) return null;
    return { filePath: path.join(LOCAL_DIR, filename), filename };
  } catch {
    return null;
  }
}

interface GithubAsset {
  id: number;
  name: string;
  url: string;
  browser_download_url: string;
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
  platform: BridgePlatform
): Promise<{ asset: GithubAsset; contentType: string } | null> {
  const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO;
  const tag = process.env.BRIDGE_DESKTOP_RELEASE_TAG || DEFAULT_RELEASE_TAG;
  const release =
    (await fetchReleaseByTag(repo, tag)) ?? (await fetchLatestBridgeRelease(repo));
  if (!release) return null;

  const asset = release.assets.find((a) => PLATFORM_MATCHERS[platform](a.name));
  if (!asset) return null;

  return { asset, contentType: CONTENT_TYPES[platform] };
}

export async function downloadGithubAsset(asset: GithubAsset): Promise<ArrayBuffer> {
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
  return res.arrayBuffer();
}

export async function readLocalInstaller(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}
