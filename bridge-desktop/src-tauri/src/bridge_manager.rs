use crate::config::AppConfig;
use crate::paths::{self, bundled_bridge_root, resolve_python_executable};
use parking_lot::Mutex;
use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum BridgeState {
    Stopped,
    Starting,
    RunningDisconnected,
    RunningConnected,
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub struct CopyEaResult {
    pub dest_path: String,
    pub line_count: usize,
    pub source_bytes: u64,
    pub dest_bytes: u64,
    pub revealed_in_folder: bool,
    pub metaeditor_launched: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BridgeStatus {
    pub state: BridgeState,
    pub message: String,
    pub port: u16,
    pub mt5_connected: bool,
    pub mt5_files_dir: Option<String>,
    pub commands_dir: Option<String>,
    pub python_path: Option<String>,
    pub bridge_root: Option<String>,
}

pub fn health_check_url_quick(port: u16) -> String {
    format!("http://127.0.0.1:{port}/health?quick=1")
}

pub fn health_check_url_mt5(port: u16) -> String {
    format!("http://127.0.0.1:{port}/health?mt5=1")
}

fn bridge_log_path() -> Option<PathBuf> {
    dirs::data_local_dir().map(|d| d.join("TradeIntel Bridge").join("bridge.log"))
}

fn append_bridge_log(line: &str) {
    if let Some(path) = bridge_log_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
            let _ = writeln!(f, "{line}");
        }
    }
}

pub struct BridgeManager {
    inner: Arc<BridgeManagerInner>,
}

struct BridgeManagerInner {
    resource_dir: PathBuf,
    config: Mutex<AppConfig>,
    child: Mutex<Option<Child>>,
    status: Mutex<BridgeStatus>,
    polling: Mutex<bool>,
}

impl BridgeManager {
    pub fn new(resource_dir: PathBuf) -> Self {
        let mut config = AppConfig::load();
        let resolved = paths::resolve_mt5_files_dir(config.mt5_files_dir.as_deref());
        if let Some(ref detected) = resolved {
            if config.mt5_files_dir.as_deref() != Some(detected.to_string_lossy().as_ref()) {
                config.mt5_files_dir = Some(detected.to_string_lossy().to_string());
                let _ = config.save();
            }
        }

        let port = config.bridge_port;
        let status = BridgeStatus {
            state: BridgeState::Stopped,
            message: "Bridge stopped".to_string(),
            port,
            mt5_connected: false,
            mt5_files_dir: config.mt5_files_dir.clone(),
            commands_dir: None,
            python_path: None,
            bridge_root: Some(bundled_bridge_root(&resource_dir).to_string_lossy().to_string()),
        };

        Self {
            inner: Arc::new(BridgeManagerInner {
                resource_dir,
                config: Mutex::new(config),
                child: Mutex::new(None),
                status: Mutex::new(status),
                polling: Mutex::new(false),
            }),
        }
    }

    pub fn get_status(&self) -> BridgeStatus {
        self.inner.status.lock().clone()
    }

    pub fn get_config(&self) -> AppConfig {
        self.inner.config.lock().clone()
    }

    pub fn update_config(&self, config: AppConfig) -> Result<(), String> {
        let mut config = config;
        if let Some(ref raw) = config.mt5_files_dir {
            if raw.trim().is_empty() {
                config.mt5_files_dir = None;
            } else if let Some(normalized) = paths::normalize_mt5_files_dir(raw) {
                config.mt5_files_dir = Some(normalized.to_string_lossy().to_string());
            } else if paths::is_invalid_mt5_files_override(raw) {
                return Err(
                    "Invalid MT5 Files path (looks like a URL or placeholder). Use File → Open Data Folder → MQL5 → Files."
                        .to_string(),
                );
            } else {
                return Err(
                    "MT5 Files path must be the MQL5\\Files folder (or Terminal hash / MT5 install folder so we can append MQL5\\Files)."
                        .to_string(),
                );
            }
        }
        if config.mt5_files_dir.is_none() {
            if let Some(detected) = paths::detect_mt5_files_dir() {
                config.mt5_files_dir = Some(detected.to_string_lossy().to_string());
            }
        }
        config.save()?;
        {
            let mut current = self.inner.config.lock();
            *current = config.clone();
            let mut status = self.inner.status.lock();
            status.port = config.bridge_port;
            status.mt5_files_dir = config.mt5_files_dir.clone();
        }
        Ok(())
    }

    pub fn start(&self) -> Result<(), String> {
        {
            let child_guard = self.inner.child.lock();
            if child_guard.is_some() {
                return Ok(());
            }
        }

        let mut config = self.inner.config.lock().clone();
        let bridge_root = bundled_bridge_root(&self.inner.resource_dir);
        let connector = bridge_root.join("wine-mt5-connector.py");
        if !connector.exists() {
            return Err(format!(
                "Bridge script not found at {}. Run npm run prepare:resources",
                connector.display()
            ));
        }

        let mt5_files = paths::resolve_mt5_files_dir(config.mt5_files_dir.as_deref());
        if let Some(ref files) = mt5_files {
            let path_str = files.to_string_lossy().to_string();
            config.mt5_files_dir = Some(path_str.clone());
            let _ = config.save();
            {
                let mut cfg = self.inner.config.lock();
                *cfg = config.clone();
            }
            append_bridge_log(&format!("MT5_FILES_DIR={path_str}"));
        } else {
            paths::log_mt5_detection_failure(config.mt5_files_dir.as_deref(), append_bridge_log);
            let msg = paths::MT5_FILES_NOT_FOUND_HELP.to_string();
            let mut status = self.inner.status.lock();
            status.state = BridgeState::Error;
            status.message = msg.clone();
            return Err(msg);
        }

        let python = resolve_python_executable(&self.inner.resource_dir);
        let port = config.bridge_port;

        {
            let mut status = self.inner.status.lock();
            status.state = BridgeState::Starting;
            status.message = "Starting bridge…".to_string();
            status.python_path = Some(python.to_string_lossy().to_string());
            status.bridge_root = Some(bridge_root.to_string_lossy().to_string());
        }

        let mut cmd = Command::new(&python);
        cmd.arg(&connector)
            .current_dir(&bridge_root)
            .env("MT5_BRIDGE_PORT", port.to_string())
            .env(
                "MT5_BRIDGE_ROOT",
                bridge_root.to_string_lossy().to_string(),
            )
            .stdout(Stdio::null());

        if let Some(log_path) = bridge_log_path() {
            if let Some(parent) = log_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if let Ok(log_file) = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
            {
                cmd.stderr(Stdio::from(log_file));
                append_bridge_log(&format!(
                    "--- bridge start python={}",
                    python.display()
                ));
            } else {
                cmd.stderr(Stdio::null());
            }
        } else {
            cmd.stderr(Stdio::null());
        }

        if let Some(ref files) = mt5_files {
            cmd.env("MT5_FILES_DIR", files.to_string_lossy().to_string());
        }

        let child = cmd.spawn().map_err(|e| {
            let msg = format!("Failed to start bridge: {e}");
            let mut status = self.inner.status.lock();
            status.state = BridgeState::Error;
            status.message = msg.clone();
            msg
        })?;

        *self.inner.child.lock() = Some(child);
        self.ensure_polling();

        Ok(())
    }

    /// Autostart only when MT5 Files path resolves — avoids Error state on first Windows launch.
    pub fn try_autostart(&self) {
        let config = self.get_config();
        if !config.autostart_bridge {
            return;
        }
        if paths::resolve_mt5_files_dir(config.mt5_files_dir.as_deref()).is_some() {
            let _ = self.start();
        } else {
            let mut status = self.inner.status.lock();
            status.state = BridgeState::Stopped;
            status.message = "Setup required: open MT5 once, then Detect MT5 folder or paste path in Advanced → Save."
                .to_string();
        }
    }

    pub fn stop(&self) {
        if let Some(mut child) = self.inner.child.lock().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        let mut status = self.inner.status.lock();
        status.state = BridgeState::Stopped;
        status.message = "Bridge stopped".to_string();
        status.mt5_connected = false;
    }

    fn ensure_polling(&self) {
        let mut polling = self.inner.polling.lock();
        if *polling {
            return;
        }
        *polling = true;

        let inner = Arc::clone(&self.inner);
        thread::spawn(move || {
            let mut poll_tick: u64 = 0;
            loop {
            thread::sleep(Duration::from_secs(3));
            poll_tick = poll_tick.wrapping_add(1);

            let port = inner.config.lock().bridge_port;
            let mut child_dead = false;
            if let Some(child) = inner.child.lock().as_mut() {
                if let Ok(Some(_)) = child.try_wait() {
                    child_dead = true;
                }
            } else {
                child_dead = true;
            }

            if child_dead {
                let mut status = inner.status.lock();
                if status.state != BridgeState::Stopped {
                    status.state = BridgeState::Error;
                    status.message = "Bridge process exited".to_string();
                    status.mt5_connected = false;
                }
                continue;
            }

            let use_mt5_check = poll_tick % 5 == 0;
            let url = if use_mt5_check {
                health_check_url_mt5(port)
            } else {
                health_check_url_quick(port)
            };
            let timeout = if use_mt5_check {
                Duration::from_secs(8)
            } else {
                Duration::from_secs(5)
            };

            match reqwest::blocking::Client::builder()
                .timeout(timeout)
                .build()
                .and_then(|c| c.get(&url).send())
            {
                Ok(resp) if resp.status().is_success() => {
                    let body = resp.json::<serde_json::Value>().ok();
                    let mt5_connected = body
                        .as_ref()
                        .and_then(|v| v.get("mt5_connected").and_then(|b| b.as_bool()))
                        .unwrap_or(false);
                    let commands_dir = body
                        .as_ref()
                        .and_then(|v| v.get("commands_dir").and_then(|s| s.as_str()))
                        .map(|s| s.to_string());

                    let mut status = inner.status.lock();
                    if let Some(cmd) = commands_dir {
                        status.commands_dir = Some(cmd);
                    }
                    if use_mt5_check {
                        status.mt5_connected = mt5_connected;
                    }
                    if status.mt5_connected {
                        status.state = BridgeState::RunningConnected;
                        status.message = "MT5 connected".to_string();
                    } else if status.state != BridgeState::Starting {
                        status.state = BridgeState::RunningDisconnected;
                        let hint = status.commands_dir.as_deref().unwrap_or("");
                        if hint.is_empty() {
                            status.message = "Bridge running — attach MT5 EA".to_string();
                        } else {
                            status.message =
                                format!("Bridge running — attach MT5 EA (files: {hint})");
                        }
                    }
                }
                _ => {
                    let mut status = inner.status.lock();
                    if status.state == BridgeState::Starting {
                        status.message = "Waiting for bridge HTTP…".to_string();
                    } else if status.state != BridgeState::Stopped {
                        status.state = BridgeState::RunningDisconnected;
                        status.message = "Bridge unreachable — retry Start".to_string();
                    }
                    status.mt5_connected = false;
                }
            }
        }
        });
    }

    pub fn copy_ea_to_experts(&self) -> Result<CopyEaResult, String> {
        let bridge_root = bundled_bridge_root(&self.inner.resource_dir);
        let ea_src = bridge_root.join("MT5FileBridgeEA.mq5");
        if !ea_src.exists() {
            return Err("MT5FileBridgeEA.mq5 not found in bundle".to_string());
        }

        let (source_bytes, _) = validate_mq5_ea_file(&ea_src, "Bundled EA")?;

        let config = self.inner.config.lock().clone();
        let files_dir = paths::resolve_mt5_files_dir(config.mt5_files_dir.as_deref())
            .ok_or_else(|| {
                "MT5 Files folder not detected. Set path in settings or open MT5 → File → Open Data Folder → MQL5 → Files".to_string()
            })?;

        let experts = paths::experts_dir_from_files(&files_dir);
        fs::create_dir_all(&experts).map_err(|e| e.to_string())?;
        let dest = experts.join("MT5FileBridgeEA.mq5");
        std::fs::copy(&ea_src, &dest).map_err(|e| e.to_string())?;

        let (dest_bytes, dest_lines) = validate_mq5_ea_file(&dest, "Copied EA")?;

        let revealed = reveal_file_in_folder(&dest);
        let metaeditor = try_open_in_metaeditor(&dest);

        let message = format!(
            "Copied {dest_lines} lines ({dest_bytes} bytes) to {}",
            dest.display()
        );

        Ok(CopyEaResult {
            dest_path: dest.to_string_lossy().to_string(),
            line_count: dest_lines,
            source_bytes,
            dest_bytes,
            revealed_in_folder: revealed,
            metaeditor_launched: metaeditor,
            message,
        })
    }

    pub fn open_ea_in_metaeditor(&self) -> Result<String, String> {
        let config = self.inner.config.lock().clone();
        let files_dir = paths::resolve_mt5_files_dir(config.mt5_files_dir.as_deref())
            .ok_or_else(|| "MT5 Files folder not detected".to_string())?;
        let dest = paths::experts_dir_from_files(&files_dir).join("MT5FileBridgeEA.mq5");
        if !dest.exists() {
            return Err("MT5FileBridgeEA.mq5 not found in Experts. Click Copy EA to Experts first.".to_string());
        }
        validate_mq5_ea_file(&dest, "Experts EA")?;
        if try_open_in_metaeditor(&dest) {
            Ok(format!("Opened in MetaEditor: {}", dest.display()))
        } else {
            reveal_file_in_folder(&dest);
            Err(format!(
                "Could not launch MetaEditor. File is at {} — open it manually and press F7 to compile.",
                dest.display()
            ))
        }
    }

    pub fn open_mt5_data_folder(&self) -> Result<(), String> {
        let config = self.inner.config.lock().clone();
        let files_dir = paths::resolve_mt5_files_dir(config.mt5_files_dir.as_deref())
            .ok_or_else(|| "MT5 Files folder not detected".to_string())?;

        open_path(&files_dir)
    }
}

/// Reject dashboard URLs or truncated clipboard paste masquerading as an EA file.
fn validate_mq5_ea_file(path: &Path, label: &str) -> Result<(u64, usize), String> {
    let meta = fs::metadata(path).map_err(|e| format!("{label}: cannot read file: {e}"))?;
    let bytes = meta.len();
    if bytes < 500 {
        return Err(format!(
            "{label} is only {bytes} bytes — expected full MT5FileBridgeEA.mq5 source (1200+ lines)"
        ));
    }

    let content =
        fs::read_to_string(path).map_err(|e| format!("{label}: cannot read text: {e}"))?;
    let trimmed = content.trim();

    if trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.contains("bridge_url=")
        || trimmed.contains("vercel.app")
        || trimmed.contains("trycloudflare.com")
    {
        return Err(format!(
            "{label} looks like a dashboard URL, not MQL5 code. Do not paste after Connect dashboard — click Copy EA again."
        ));
    }

    if !content.contains("#property") || !content.contains("OnInit") {
        return Err(format!(
            "{label} does not look like an Expert Advisor (missing #property / OnInit). Reinstall TradeIntel Bridge or copy again."
        ));
    }

    let line_count = content.lines().count();
    if line_count < 20 {
        return Err(format!(
            "{label} has only {line_count} lines — expected 1000+ lines of EA source"
        ));
    }

    Ok((bytes, line_count))
}

fn reveal_file_in_folder(path: &Path) -> bool {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &path.display().to_string()])
            .spawn()
            .is_ok()
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", path.to_string_lossy().as_ref()])
            .spawn()
            .is_ok()
    }
    #[cfg(target_os = "linux")]
    {
        path.parent()
            .map(|parent| Command::new("xdg-open").arg(parent).spawn().is_ok())
            .unwrap_or(false)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = path;
        false
    }
}

fn try_open_in_metaeditor(path: &Path) -> bool {
    let path_str = path.to_string_lossy();

    #[cfg(target_os = "windows")]
    {
        let candidates = [
            r"C:\Program Files\MetaTrader 5\metaeditor64.exe",
            r"C:\Program Files\MetaTrader 5\MetaEditor64.exe",
            r"C:\Program Files (x86)\MetaTrader 5\metaeditor64.exe",
        ];
        for exe in candidates {
            let exe_path = PathBuf::from(exe);
            if exe_path.exists() {
                return Command::new(&exe_path).arg(path).spawn().is_ok();
            }
        }
        return Command::new("cmd")
            .args(["/C", "start", "", path_str.as_ref()])
            .spawn()
            .is_ok();
    }

    #[cfg(target_os = "macos")]
    {
        for app in ["MetaEditor", "MetaTrader 5"] {
            if Command::new("open")
                .args(["-a", app, path_str.as_ref()])
                .spawn()
                .is_ok()
            {
                return true;
            }
        }
        return Command::new("open")
            .arg(path_str.as_ref())
            .spawn()
            .is_ok();
    }

    #[cfg(target_os = "linux")]
    {
        for exe in ["metaeditor64", "wine metaeditor64.exe"] {
            if Command::new("sh")
                .arg("-c")
                .arg(format!("{exe} '{}'", path.display()))
                .spawn()
                .is_ok()
            {
                return true;
            }
        }
        return false;
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = path_str;
        false
    }
}

fn open_path(path: &PathBuf) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
