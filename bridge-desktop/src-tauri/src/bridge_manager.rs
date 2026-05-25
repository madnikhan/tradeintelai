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
    pub python_path: Option<String>,
    pub bridge_root: Option<String>,
}

pub fn health_check_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}/health?quick=1")
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
        if config.mt5_files_dir.is_none() {
            if let Some(detected) = paths::detect_mt5_files_dir() {
                config.mt5_files_dir = Some(detected.to_string_lossy().to_string());
            }
        }

        let port = config.bridge_port;
        let status = BridgeStatus {
            state: BridgeState::Stopped,
            message: "Bridge stopped".to_string(),
            port,
            mt5_connected: false,
            mt5_files_dir: config.mt5_files_dir.clone(),
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

        let config = self.inner.config.lock().clone();
        let bridge_root = bundled_bridge_root(&self.inner.resource_dir);
        let connector = bridge_root.join("wine-mt5-connector.py");
        if !connector.exists() {
            return Err(format!(
                "Bridge script not found at {}. Run npm run prepare:resources",
                connector.display()
            ));
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

        if let Some(ref files) = config.mt5_files_dir {
            cmd.env("MT5_FILES_DIR", files);
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
        thread::spawn(move || loop {
            thread::sleep(Duration::from_secs(3));

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

            let url = health_check_url(port);
            match reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .and_then(|c| c.get(&url).send())
            {
                Ok(resp) if resp.status().is_success() => {
                    let mt5_connected = resp
                        .json::<serde_json::Value>()
                        .ok()
                        .and_then(|v| v.get("mt5_connected").and_then(|b| b.as_bool()))
                        .unwrap_or(false);

                    let mut status = inner.status.lock();
                    status.mt5_connected = mt5_connected;
                    if mt5_connected {
                        status.state = BridgeState::RunningConnected;
                        status.message = "MT5 connected".to_string();
                    } else {
                        status.state = BridgeState::RunningDisconnected;
                        status.message = "Bridge running — attach MT5 EA".to_string();
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
        let files_dir = config
            .mt5_files_dir
            .as_ref()
            .map(PathBuf::from)
            .or_else(paths::detect_mt5_files_dir)
            .ok_or_else(|| {
                "MT5 Files folder not detected. Set path in settings or open MT5 → File → Open Data Folder".to_string()
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
        let files_dir = config
            .mt5_files_dir
            .as_ref()
            .map(PathBuf::from)
            .or_else(paths::detect_mt5_files_dir)
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
        let files_dir = config
            .mt5_files_dir
            .as_ref()
            .map(PathBuf::from)
            .or_else(paths::detect_mt5_files_dir)
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
