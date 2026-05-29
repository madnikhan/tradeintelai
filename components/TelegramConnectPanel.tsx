'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface TelegramStatus {
  linked: boolean;
  telegramUsername: string | null;
  telegramLinkedAt: string | null;
}

export function TelegramConnectPanel() {
  const { user } = useAuth();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const channelUrl = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL;

  const authFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const token = await user?.getIdToken();
      if (!token) throw new Error('Sign in required');
      return fetch(path, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          Authorization: `Bearer ${token}`,
        },
      });
    },
    [user]
  );

  const refreshStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authFetch('/api/telegram/status');
      if (res.ok) setStatus(await res.json());
    } catch {
      /* ignore */
    }
  }, [user, authFetch]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleConnect = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await authFetch('/api/telegram/link-token');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate link');
      setLinkUrl(data.linkUrl);
      window.open(data.linkUrl, '_blank', 'noopener,noreferrer');
      setMessage('Open Telegram and tap Start in the bot chat to connect.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Connect failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await authFetch('/api/telegram/status', { method: 'DELETE' });
      setLinkUrl(null);
      await refreshStatus();
      setMessage('Telegram disconnected.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Disconnect failed');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <p className="text-xs text-gray-500">Sign in to connect Telegram for trade execution alerts.</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Get a private message when a trade executes on your MT5 account. Requires TELEGRAM_BOT_TOKEN on the server.
      </p>
      {status?.linked ? (
        <div className="text-sm text-emerald-400">
          Connected
          {status.telegramUsername ? ` (@${status.telegramUsername})` : ''}
        </div>
      ) : (
        <div className="text-sm text-gray-400">Not connected</div>
      )}
      <div className="flex flex-wrap gap-2">
        {!status?.linked ? (
          <button
            type="button"
            onClick={() => void handleConnect()}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[#0088cc] hover:bg-[#0077b5] text-white text-sm font-medium min-h-[44px]"
          >
            Connect Telegram
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleDisconnect()}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[#1e2738] text-gray-300 hover:text-white text-sm min-h-[44px]"
          >
            Disconnect
          </button>
        )}
        <button
          type="button"
          onClick={() => void refreshStatus()}
          className="px-4 py-2 rounded-lg bg-[#1e2738] text-gray-300 text-sm min-h-[44px]"
        >
          Refresh
        </button>
      </div>
      {linkUrl ? (
        <p className="text-xs text-gray-500 break-all">
          Link:{' '}
          <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400">
            {linkUrl}
          </a>
        </p>
      ) : null}
      {channelUrl ? (
        <p className="text-xs text-gray-400">
          Public channel:{' '}
          <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400">
            Join for broadcast execution alerts
          </a>
        </p>
      ) : null}
      {message ? <p className="text-xs text-amber-400">{message}</p> : null}
    </div>
  );
}
