import { getAuthInstance } from '@/lib/firebase/config';

export async function downloadBridgeZip(): Promise<void> {
  const auth = getAuthInstance();
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch('/api/download/bridge', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Download failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tradeintel-bridge.zip';
  a.click();
  URL.revokeObjectURL(url);
}
