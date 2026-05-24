import { getBridgeBaseUrl } from '@/config/bridge-config';
import { loadUserBridgeSettings } from '@/lib/firebase/user-bridge-settings';

const LOCAL_SETUP_KEY = 'bridge_setup_complete';

export function hasConfiguredBridgeUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const url = getBridgeBaseUrl().trim();
  if (!url) return false;
  if (url === 'http://localhost:8080' && !localStorage.getItem('bridge_url')) {
    return false;
  }
  return Boolean(localStorage.getItem('bridge_url') || process.env.NEXT_PUBLIC_BRIDGE_URL);
}

export function isBridgeSetupCompleteLocally(): boolean {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem(LOCAL_SETUP_KEY) === 'true') return true;
  return hasConfiguredBridgeUrl();
}

export function markBridgeSetupComplete(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SETUP_KEY, 'true');
}

export async function isBridgeSetupComplete(): Promise<boolean> {
  if (isBridgeSetupCompleteLocally()) return true;
  try {
    const settings = await loadUserBridgeSettings();
    if (settings.bridgeSetupComplete) {
      markBridgeSetupComplete();
      return true;
    }
    if (settings.bridgeUrl?.trim()) {
      markBridgeSetupComplete();
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
