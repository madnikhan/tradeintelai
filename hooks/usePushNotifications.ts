'use client';

import { useCallback, useEffect, useState } from 'react';
import { isPushSupported, registerFcmToken } from '@/lib/firebase/messaging';

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void isPushSupported().then(setSupported);
    if (typeof window !== 'undefined') {
      setEnabled(localStorage.getItem('push_notifications_enabled') === 'true');
    }
  }, []);

  const enable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await registerFcmToken();
      if (token) {
        localStorage.setItem('push_notifications_enabled', 'true');
        setEnabled(true);
      } else {
        setError('Permission denied or FCM not configured');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to enable push');
    } finally {
      setLoading(false);
    }
  }, []);

  const disable = useCallback(() => {
    localStorage.setItem('push_notifications_enabled', 'false');
    setEnabled(false);
  }, []);

  return { supported, enabled, loading, error, enable, disable };
}
