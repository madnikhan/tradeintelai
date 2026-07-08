'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  subscribeBridgePresence,
  type BridgePresence,
} from '@/lib/bridge-presence';
import { normalizeBridgeBaseUrl } from '@/config/bridge-config';
import { loadUserBridgeSettings } from '@/lib/firebase/user-bridge-settings';
import { fetchBridgeCredentials } from '@/lib/bridge-watch-client';

const BridgeContext = createContext<BridgePresence & { loading: boolean }>({
  state: 'unknown',
  doc: null,
  bridgeUrl: null,
  loading: true,
});

export function useBridgePresence() {
  return useContext(BridgeContext);
}

export function BridgeProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [presence, setPresence] = useState<BridgePresence>({
    state: 'unknown',
    doc: null,
    bridgeUrl: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.uid) {
      setPresence({ state: 'not_paired', doc: null, bridgeUrl: null });
      setLoading(false);
      return;
    }

    let unsub = () => {};
    let cancelled = false;

    (async () => {
      await loadUserBridgeSettings();
      await fetchBridgeCredentials();
      if (cancelled) return;

      unsub = subscribeBridgePresence(user.uid, (p) => {
        if (p.bridgeUrl && typeof window !== 'undefined') {
          const normalized = normalizeBridgeBaseUrl(p.bridgeUrl);
          if (normalized) {
            localStorage.setItem('bridge_url', normalized);
          }
        }
        setPresence(p);
        setLoading(false);
      });
    })();

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user?.uid, authLoading]);

  return (
    <BridgeContext.Provider value={{ ...presence, loading }}>
      {children}
    </BridgeContext.Provider>
  );
}
