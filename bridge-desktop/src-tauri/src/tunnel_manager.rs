use crate::paths;
use parking_lot::Mutex;
use regex::Regex;
use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TunnelState {
    Stopped,
    Starting,
    Running,
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub struct TunnelStatus {
    pub state: TunnelState,
    pub tunnel_url: Option<String>,
    pub message: String,
}

pub struct TunnelManager {
    inner: Arc<TunnelManagerInner>,
}

struct TunnelManagerInner {
    resource_dir: PathBuf,
    child: Mutex<Option<Child>>,
    status: Mutex<TunnelStatus>,
}

impl TunnelManager {
    pub fn new(resource_dir: PathBuf) -> Self {
        Self {
            inner: Arc::new(TunnelManagerInner {
                resource_dir,
                child: Mutex::new(None),
                status: Mutex::new(TunnelStatus {
                    state: TunnelState::Stopped,
                    tunnel_url: None,
                    message: "Tunnel stopped".to_string(),
                }),
            }),
        }
    }

    pub fn get_status(&self) -> TunnelStatus {
        self.inner.status.lock().clone()
    }

    pub fn start(&self, port: u16) -> Result<String, String> {
        {
            let status = self.inner.status.lock();
            if status.state == TunnelState::Running {
                if let Some(ref url) = status.tunnel_url {
                    return Ok(url.clone());
                }
            }
        }

        self.stop();

        let cloudflared = paths::resolve_cloudflared_executable(&self.inner.resource_dir)
            .ok_or_else(missing_cloudflared_error)?;
        let local_url = format!("http://127.0.0.1:{port}");

        {
            let mut status = self.inner.status.lock();
            status.state = TunnelState::Starting;
            status.tunnel_url = None;
            status.message = "Starting secure tunnel…".to_string();
        }

        let mut child = Command::new(&cloudflared)
            .args(["tunnel", "--url", &local_url])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start cloudflared: {e}"))?;

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let (tx, rx) = std::sync::mpsc::channel::<String>();

        if let Some(out) = stdout {
            let tx_out = tx.clone();
            thread::spawn(move || read_tunnel_output(out, tx_out));
        }
        if let Some(err) = stderr {
            thread::spawn(move || read_tunnel_output(err, tx));
        }

        *self.inner.child.lock() = Some(child);

        let deadline = Instant::now() + Duration::from_secs(45);
        while Instant::now() < deadline {
            if let Ok(line) = rx.recv_timeout(Duration::from_millis(500)) {
                if let Some(url) = extract_tunnel_url(&line) {
                    let mut status = self.inner.status.lock();
                    status.state = TunnelState::Running;
                    status.tunnel_url = Some(url.clone());
                    status.message = "Tunnel connected".to_string();
                    return Ok(url);
                }
            }

            if let Some(child) = self.inner.child.lock().as_mut() {
                if let Ok(Some(code)) = child.try_wait() {
                    let msg = format!("cloudflared exited (code {code})");
                    let mut status = self.inner.status.lock();
                    status.state = TunnelState::Error;
                    status.message = msg.clone();
                    self.inner.child.lock().take();
                    return Err(msg);
                }
            }
        }

        self.stop();
        Err("Tunnel URL not received in time. Please try Connect dashboard again.".to_string())
    }

    pub fn stop(&self) {
        if let Some(mut child) = self.inner.child.lock().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        let mut status = self.inner.status.lock();
        status.state = TunnelState::Stopped;
        status.tunnel_url = None;
        status.message = "Tunnel stopped".to_string();
    }
}

fn missing_cloudflared_error() -> String {
    if cfg!(debug_assertions) {
        "Secure tunnel tool not found. Run: npm run prepare:resources:release".to_string()
    } else {
        "Secure tunnel tool missing. Please reinstall TradeIntel Bridge.".to_string()
    }
}

fn read_tunnel_output<R: std::io::Read + Send + 'static>(
    reader: R,
    tx: std::sync::mpsc::Sender<String>,
) {
    let buffered = BufReader::new(reader);
    for line in buffered.lines().map_while(Result::ok) {
        let _ = tx.send(line);
    }
}

fn extract_tunnel_url(text: &str) -> Option<String> {
    static RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    let re = RE.get_or_init(|| {
        Regex::new(r"https://[a-zA-Z0-9-]+\.(trycloudflare\.com|cfargotunnel\.com)").unwrap()
    });
    re.find(text).map(|m| m.as_str().to_string())
}

pub fn build_dashboard_url(dashboard_base: &str, tunnel_url: &str) -> String {
    let base = dashboard_base.trim().trim_end_matches('/');
    let encoded = urlencoding::encode(tunnel_url.trim());
    format!("{base}/dashboard?bridge_url={encoded}")
}
