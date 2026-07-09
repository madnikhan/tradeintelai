import { useCallback, useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke, isTauri, listen } from './lib/tauri';

type BridgeState =
  | 'stopped'
  | 'starting'
  | 'running_disconnected'
  | 'running_connected'
  | 'error';

type TunnelState = 'stopped' | 'starting' | 'running' | 'error';

interface BridgeStatus {
  state: BridgeState;
  message: string;
  port: number;
  mt5_connected: boolean;
  mt5_files_dir: string | null;
  commands_dir: string | null;
  python_path: string | null;
  bridge_root: string | null;
}

interface TunnelStatus {
  state: TunnelState;
  tunnel_url: string | null;
  message: string;
}

interface DependencyStatus {
  python_ready: boolean;
  cloudflared_ready: boolean;
  bridge_script_ready: boolean;
  all_ready: boolean;
  is_release: boolean;
  python_path: string | null;
  cloudflared_path: string | null;
  bridge_script_path: string | null;
}

interface AppConfig {
  bridge_port: number;
  mt5_files_dir: string | null;
  tunnel_url: string | null;
  dashboard_base_url: string | null;
  autostart_bridge: boolean;
}

interface ConnectDashboardResult {
  tunnel_url: string;
  dashboard_url: string;
  clipboard_copied: boolean;
}

interface CopyEaResult {
  dest_path: string;
  line_count: number;
  source_bytes: number;
  dest_bytes: number;
  revealed_in_folder: boolean;
  metaeditor_launched: boolean;
  message: string;
}

interface Mt5FilesCandidateInfo {
  path: string;
  has_commands_dir: boolean;
  has_responses_dir: boolean;
}

interface Mt5FilesCandidatesResult {
  candidates: Mt5FilesCandidateInfo[];
  selected_path: string | null;
  saved_override: string | null;
  appdata_terminal_root: string | null;
}

interface PickMt5FilesDirResult {
  normalized_path: string;
  converted_from_experts: boolean;
}

const STATE_LABEL: Record<BridgeState, string> = {
  stopped: 'Stopped',
  starting: 'Starting…',
  running_disconnected: 'Running — MT5 disconnected',
  running_connected: 'Connected',
  error: 'Error',
};

const STATE_COLOR: Record<BridgeState, string> = {
  stopped: '#6b7280',
  starting: '#eab308',
  running_disconnected: '#f59e0b',
  running_connected: '#10b981',
  error: '#ef4444',
};

const TUNNEL_LABEL: Record<TunnelState, string> = {
  stopped: 'Not connected',
  starting: 'Connecting…',
  running: 'Connected',
  error: 'Error',
};

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`check-item ${ok ? 'ok' : 'missing'}`}>
      <span className="check-icon">{ok ? '✓' : '○'}</span>
      {label}
    </li>
  );
}

export default function App() {
  const inDesktop = isTauri();
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus | null>(null);
  const [deps, setDeps] = useState<DependencyStatus | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [dashboardBase, setDashboardBase] = useState('https://tradeintelai.vercel.app');
  const [mt5Path, setMt5Path] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastEaPath, setLastEaPath] = useState<string | null>(null);
  const [mt5Candidates, setMt5Candidates] = useState<Mt5FilesCandidatesResult | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [pathNote, setPathNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!inDesktop) return;
    try {
      const s = await invoke<BridgeStatus>('get_bridge_status');
      const t = await invoke<TunnelStatus>('get_tunnel_status');
      const d = await invoke<DependencyStatus>('get_dependency_status');
      const c = await invoke<AppConfig>('get_app_config');
      setStatus(s);
      setTunnelStatus(t);
      setDeps(d);
      setConfig(c);
      setTunnelUrl(t.tunnel_url ?? c.tunnel_url ?? '');
      setDashboardBase(c.dashboard_base_url ?? 'https://tradeintelai.vercel.app');
      setMt5Path(c.mt5_files_dir ?? s.mt5_files_dir ?? '');
    } catch (e) {
      setMessage(String(e));
    }
  }, [inDesktop]);

  useEffect(() => {
    if (inDesktop) {
      getVersion().then(setAppVersion).catch(() => {});
    }
  }, [inDesktop]);

  useEffect(() => {
    if (!inDesktop) {
      setMessage('Open this app from the TradeIntel Bridge desktop window, not in a browser tab.');
      return;
    }
    refresh();
    let unlistenBridge: (() => void) | undefined;
    let unlistenDeps: (() => void) | undefined;
    listen<BridgeStatus>('bridge-status-changed', (payload) => {
      setStatus(payload);
    }).then((fn) => {
      unlistenBridge = fn;
    });
    listen<DependencyStatus>('dependency-status', (payload) => {
      setDeps(payload);
    }).then((fn) => {
      unlistenDeps = fn;
    });
    const interval = setInterval(() => {
      invoke<TunnelStatus>('get_tunnel_status')
        .then(setTunnelStatus)
        .catch(() => {});
    }, 3000);
    return () => {
      unlistenBridge?.();
      unlistenDeps?.();
      clearInterval(interval);
    };
  }, [inDesktop, refresh]);

  const allReady = deps?.all_ready ?? false;

  const handleConnectDashboard = async () => {
    if (!inDesktop || !allReady) return;
    setBusy(true);
    setMessage('Starting bridge and secure tunnel (this may take up to 30 seconds)…');
    try {
      const result = await invoke<ConnectDashboardResult>('connect_dashboard');
      setTunnelUrl(result.tunnel_url);
      setMessage(
        result.clipboard_copied
          ? 'Dashboard opened — link copied to clipboard'
          : 'Dashboard opened in your browser',
      );
      await refresh();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = async () => {
    if (!tunnelUrl) return;
    if (tunnelState !== 'running') {
      setMessage('Tunnel is not running — click Connect dashboard to start a fresh tunnel and link.');
      return;
    }
    const base = dashboardBase.trim().replace(/\/$/, '');
    const link = `${base}/dashboard?bridge_url=${encodeURIComponent(tunnelUrl.trim())}`;
    try {
      await navigator.clipboard.writeText(link);
      setMessage('Dashboard link copied');
    } catch {
      setMessage(link);
    }
  };

  const handleStart = async () => {
    if (!inDesktop) return;
    setBusy(true);
    try {
      await invoke('start_bridge');
      setMessage('Bridge starting…');
      await refresh();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    if (!inDesktop) return;
    try {
      await invoke('stop_tunnel');
      await invoke('stop_bridge');
      setMessage('Bridge and tunnel stopped');
      await refresh();
    } catch (e) {
      setMessage(String(e));
    }
  };

  const handleSave = async () => {
    if (!inDesktop || !config) return;
    const next: AppConfig = {
      ...config,
      tunnel_url: tunnelUrl.trim() || null,
      dashboard_base_url: dashboardBase.trim() || null,
      mt5_files_dir: mt5Path.trim() || null,
    };
    await invoke('save_app_config', { config: next });
    setMessage('Settings saved');
    await refresh();
  };

  const handleCopyEa = async () => {
    if (!inDesktop) return;
    const proceed = window.confirm(
      'Copy the full MT5FileBridgeEA.mq5 (1200+ lines) into your MT5 Experts folder?\n\n' +
        'Important: Do not paste (Cmd+V) into MetaEditor after Connect dashboard — that overwrites the EA with the dashboard URL.'
    );
    if (!proceed) return;

    setBusy(true);
    try {
      const result = await invoke<CopyEaResult>('copy_ea_to_experts');
      setLastEaPath(result.dest_path);
      const hints: string[] = [result.message];
      if (result.revealed_in_folder) {
        hints.push('Shown in Finder/Explorer — open MT5FileBridgeEA.mq5 there.');
      }
      if (result.metaeditor_launched) {
        hints.push('MetaEditor opened — press F7 to compile, then attach to a chart.');
      } else {
        hints.push('Open MetaEditor manually if it did not launch.');
      }
      setMessage(hints.join(' '));
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenEaInMetaEditor = async () => {
    if (!inDesktop) return;
    setBusy(true);
    try {
      const msg = await invoke<string>('open_ea_in_metaeditor');
      setMessage(msg);
    } catch (e: unknown) {
      const err = String(e);
      setMessage(err);
      if (lastEaPath) {
        setMessage(`${err} File: ${lastEaPath}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOpenMt5 = async () => {
    if (!inDesktop) return;
    try {
      await invoke('open_mt5_data_folder');
    } catch (e) {
      setMessage(String(e));
    }
  };

  const refreshMt5Candidates = useCallback(async () => {
    if (!inDesktop) return;
    try {
      const result = await invoke<Mt5FilesCandidatesResult>('list_mt5_files_candidates');
      setMt5Candidates(result);
    } catch (e) {
      setMessage(String(e));
    }
  }, [inDesktop]);

  const handleDetectMt5Folder = async () => {
    if (!inDesktop) return;
    setBusy(true);
    try {
      const path = await invoke<string | null>('detect_mt5_files_dir_cmd');
      if (path) {
        setMt5Path(path);
        setPathNote(null);
        setMessage(`MT5 Files folder detected: ${path}`);
        await refreshMt5Candidates();
        await refresh();
      }
    } catch (e) {
      setMessage(String(e));
      await refreshMt5Candidates();
    } finally {
      setBusy(false);
    }
  };

  const handleBrowseMt5Folder = async () => {
    if (!inDesktop) return;
    setBusy(true);
    try {
      const result = await invoke<PickMt5FilesDirResult>('pick_mt5_files_dir_cmd');
      setMt5Path(result.normalized_path);
      setPathNote(
        result.converted_from_experts
          ? 'Converted Experts folder to MQL5\\Files for the bridge.'
          : null
      );
      setMessage(`Using MT5 Files folder: ${result.normalized_path}`);
      await refreshMt5Candidates();
      await refresh();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSelectCandidate = async (path: string) => {
    if (!inDesktop) return;
    setBusy(true);
    try {
      const normalized = await invoke<string>('set_mt5_files_dir_cmd', { path });
      setMt5Path(normalized);
      setPathNote(null);
      setMessage(`Saved MT5 Files folder: ${normalized}`);
      await refreshMt5Candidates();
      await refresh();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (inDesktop) {
      void refreshMt5Candidates();
    }
  }, [inDesktop, refreshMt5Candidates]);

  const state = status?.state ?? 'stopped';
  const tunnelState = tunnelStatus?.state ?? 'stopped';
  const hasMt5FilesPath = Boolean(mt5Path.trim() || status?.mt5_files_dir);

  return (
    <div className="app">
      <header className="app-header">
        <img src="/logo.png" alt="" className="app-logo" />
        <div>
          <h1>TradeIntel Bridge</h1>
          <p className="subtitle">Install → EA in MT5 → Connect dashboard</p>
        </div>
      </header>

      {!inDesktop ? (
        <section className="panel note browser-only">
          <h2>Desktop app required</h2>
          <p>
            You opened the Vite dev server in a browser. Bridge controls only work inside the
            TradeIntel Bridge desktop window.
          </p>
        </section>
      ) : null}

      {deps ? (
        <section className="panel readiness-panel">
          <h2>App components</h2>
          <ul className="checklist">
            <CheckItem ok={deps.python_ready} label="Python runtime" />
            <CheckItem ok={deps.cloudflared_ready} label="Secure tunnel" />
            <CheckItem ok={deps.bridge_script_ready} label="Bridge files" />
          </ul>
          {!deps.all_ready && !deps.is_release ? (
            <p className="muted small dev-hint">
              Dev mode: run <code>npm run prepare:resources:release</code>
            </p>
          ) : null}
          {!deps.all_ready && deps.is_release ? (
            <p className="muted small">Please reinstall TradeIntel Bridge from the dashboard.</p>
          ) : null}
        </section>
      ) : null}

      <section className="panel connect-panel">
        <h2>Connect dashboard</h2>
        <p className="connect-desc">
          One click starts the bridge, opens a secure link to your dashboard, and copies the URL.
        </p>
        <button
          type="button"
          className="connect-btn"
          onClick={handleConnectDashboard}
          disabled={busy || !inDesktop || !allReady}
        >
          {busy ? 'Connecting…' : 'Connect dashboard'}
        </button>
        {tunnelState === 'running' && tunnelUrl ? (
          <div className="tunnel-url-row">
            <code className="tunnel-url">{tunnelUrl}</code>
            <button type="button" className="secondary small" onClick={handleCopyLink}>
              Copy link
            </button>
          </div>
        ) : tunnelUrl && tunnelState !== 'running' ? (
          <p className="path-warning" style={{ marginTop: '0.75rem' }}>
            Previous tunnel URL is no longer active. Click <strong>Connect dashboard</strong> again —
            do not reuse an old link.
          </p>
        ) : null}
        <p className="muted small">
          Tunnel: {TUNNEL_LABEL[tunnelState]}
          {tunnelStatus?.message ? ` — ${tunnelStatus.message}` : ''}
        </p>
      </section>

      <section className="status-card">
        <div className="status-row">
          <span className="dot" style={{ background: STATE_COLOR[state] }} />
          <div>
            <strong>{STATE_LABEL[state]}</strong>
            <p className="muted">{status?.message ?? 'Loading…'}</p>
          </div>
        </div>
        <div className="grid">
          <div>
            <span className="label">Bridge HTTP</span>
            <span>
              {status?.state === 'stopped' || status?.state === 'error'
                ? '—'
                : status?.port
                  ? `http://127.0.0.1:${status.port}/health`
                  : '—'}
            </span>
          </div>
          <div>
            <span className="label">Tunnel</span>
            <span>{tunnelState === 'running' ? 'Connected' : TUNNEL_LABEL[tunnelState]}</span>
          </div>
          <div>
            <span className="label">MT5 EA</span>
            <span>{status?.mt5_connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        {status?.commands_dir && !status.mt5_connected ? (
          <p className="muted small path-hint">
            Command files: <code>{status.commands_dir}</code>
          </p>
        ) : null}
        {mt5Path ? (
          <p className="muted small path-hint">
            MT5 Files: <code>{mt5Path}</code>
          </p>
        ) : null}
        {pathNote ? <p className="muted small path-note">{pathNote}</p> : null}
        {!hasMt5FilesPath && inDesktop ? (
          <p className="path-warning">
            Set your MT5 folder before starting the bridge — use <strong>Browse for MT5 folder</strong>{' '}
            or <strong>Detect MT5 folder</strong> below.
          </p>
        ) : null}
        {state === 'error' && !mt5Path ? (
          <div className="mt5-error-help">
            <p className="muted small">
              <strong>MT5 Files folder required.</strong> Attaching the EA is not enough — the bridge
              exchanges commands via <code>MQL5\Files</code>.
            </p>
            <ol className="steps compact">
              <li>Open MetaTrader 5 and log in once</li>
              <li>File → Open Data Folder → open <code>MQL5</code> → <code>Files</code></li>
              <li>
                Click <strong>Browse for MT5 folder</strong> or <strong>Detect MT5 folder</strong> below
              </li>
              <li>Save settings → Start bridge → enable Algo Trading + EA on chart</li>
            </ol>
          </div>
        ) : null}
      </section>

      <section className="actions">
        <button
          type="button"
          onClick={handleStart}
          disabled={busy || !inDesktop || !deps?.python_ready || !hasMt5FilesPath}
        >
          Start bridge only
        </button>
        <button type="button" className="secondary" onClick={handleStop} disabled={busy || !inDesktop}>
          Stop all
        </button>
      </section>

      <section className="panel">
        <h2>EA setup in MT5</h2>
        <p className="ea-warning">
          After <strong>Connect dashboard</strong>, your clipboard holds the dashboard URL —{' '}
          <strong>do not paste</strong> into MetaEditor or you will replace the EA with one line of text.
        </p>
        <ol className="steps">
          <li>Copy MT5FileBridgeEA.mq5 to MT5 Experts folder (full source, 1000+ lines)</li>
          <li>Compile in MetaEditor (F7) and attach to a chart</li>
          <li>Enable Algo Trading in MT5</li>
        </ol>
        <div className="actions">
          <button type="button" onClick={handleCopyEa} disabled={busy || !inDesktop}>
            Copy EA to Experts
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleOpenEaInMetaEditor}
            disabled={busy || !inDesktop}
          >
            Open in MetaEditor
          </button>
          <button type="button" className="secondary" onClick={handleOpenMt5} disabled={!inDesktop}>
            Open MT5 data folder
          </button>
        </div>
        {lastEaPath ? (
          <p className="muted small ea-path">
            Last copy: <code>{lastEaPath}</code>
          </p>
        ) : null}
      </section>

      <section className="panel">
        <h2>Mobile alerts</h2>
        <p className="muted small">
          For phone notifications while you trade: open the TradeIntel dashboard on your PC → Settings →{' '}
          <strong>Mobile &amp; Alerts</strong> → enable Alert Mode and connect Telegram. Keep this bridge
          running with MT5 EA connected.
        </p>
      </section>

      <section className="panel">
        <h2>MT5 data folder</h2>
        <p className="hfm-callout">
          <strong>HFM / broker installs:</strong> use <strong>Browse for MT5 folder</strong> and select your{' '}
          <code>MQL5\Experts</code> or <code>MQL5\Files</code> folder (e.g.{' '}
          <code>C:\Program Files\HFM Metatrader 5\MQL5\Experts</code>). The app converts Experts to Files
          automatically. You can also use File → Open Data Folder in MT5 → <code>MQL5\Files</code>.
        </p>
        <p className="muted small">
          Open MT5 at least once so Windows creates{' '}
          <code>AppData\Roaming\MetaQuotes\Terminal\…\MQL5\Files</code>.
        </p>
        <div className="actions">
          <button type="button" onClick={() => void handleBrowseMt5Folder()} disabled={busy || !inDesktop}>
            Browse for MT5 folder
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void handleDetectMt5Folder()}
            disabled={busy || !inDesktop}
          >
            Detect MT5 folder
          </button>
          <button type="button" className="secondary" onClick={() => void refreshMt5Candidates()} disabled={!inDesktop}>
            Refresh list
          </button>
        </div>
        {mt5Candidates && mt5Candidates.candidates.length === 0 ? (
          <p className="muted small warn-text">
            No folders found. Open MetaTrader 5 → File → Open Data Folder, then Detect again.
            {mt5Candidates.appdata_terminal_root ? (
              <>
                {' '}
                Expected under: <code>{mt5Candidates.appdata_terminal_root}</code>
              </>
            ) : null}
          </p>
        ) : null}
        {mt5Candidates?.saved_override ? (
          <p className="muted small">
            Saved path: <code>{mt5Candidates.saved_override}</code>
          </p>
        ) : null}
        {mt5Candidates && mt5Candidates.candidates.length > 0 ? (
          <ul className="candidate-list">
            {mt5Candidates.candidates.map((c) => (
              <li key={c.path} className={c.path === mt5Candidates.selected_path ? 'selected' : ''}>
                <button
                  type="button"
                  className="candidate-btn"
                  onClick={() => void handleSelectCandidate(c.path)}
                  disabled={busy || !inDesktop}
                >
                  <code>{c.path}</code>
                  {c.has_commands_dir || c.has_responses_dir ? ' · bridge activity' : ''}
                  {c.path === mt5Candidates.selected_path
                    ? c.path === mt5Candidates.saved_override
                      ? ' (saved)'
                      : ' (auto)'
                    : ''}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="panel advanced">
        <h2>Advanced</h2>
        <label className="field">
          Dashboard URL
          <input
            type="url"
            value={dashboardBase}
            onChange={(e) => setDashboardBase(e.target.value)}
            placeholder="https://tradeintelai.vercel.app"
          />
        </label>
        <label className="field">
          Tunnel URL (auto-filled by Connect)
          <input
            type="url"
            value={tunnelUrl}
            onChange={(e) => setTunnelUrl(e.target.value)}
            placeholder="https://your-tunnel.trycloudflare.com"
          />
        </label>
        <label className="field">
          MT5 Files path (optional paste)
          <input
            type="text"
            value={mt5Path}
            onChange={(e) => {
              setMt5Path(e.target.value);
              setPathNote(null);
            }}
            placeholder="C:\Program Files\HFM Metatrader 5\MQL5\Experts or ...\MQL5\Files"
          />
        </label>
        <p className="muted small">
          Paste <strong>Files</strong>, <strong>Experts</strong>, <strong>MQL5</strong>, or your Terminal data
          folder — not a dashboard URL. Prefer <strong>Browse for MT5 folder</strong> above.
        </p>
        <button type="button" onClick={handleSave} disabled={!inDesktop}>
          Save settings
        </button>
      </section>

      {message ? <p className="toast">{message}</p> : null}
      {appVersion ? (
        <p className="muted small version-footer">TradeIntel Bridge v{appVersion}</p>
      ) : null}
    </div>
  );
}
