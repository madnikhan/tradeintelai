use crate::config::AppConfig;
use crate::paths::{self, bundled_bridge_root, resolve_python_executable};
use parking_lot::Mutex;
use serde::Serialize;
use std::path::PathBuf;
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
pub struct BridgeStatus {
    pub state: BridgeState,
    pub message: String,
    pub port: u16,
    pub mt5_connected: bool,
    pub mt5_files_dir: Option<String>,
    pub python_path: Option<String>,
    pub bridge_root: Option<String>,
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
            .stdout(Stdio::null())
            .stderr(Stdio::null());

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

            let url = format!("http://127.0.0.1:{port}/health");
            match reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(8))
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
                    if status.state != BridgeState::Starting {
                        status.state = BridgeState::RunningDisconnected;
                        status.message = "Bridge starting…".to_string();
                    }
                    status.mt5_connected = false;
                }
            }
        });
    }

    pub fn copy_ea_to_experts(&self) -> Result<String, String> {
        let bridge_root = bundled_bridge_root(&self.inner.resource_dir);
        let ea_src = bridge_root.join("MT5FileBridgeEA.mq5");
        if !ea_src.exists() {
            return Err("MT5FileBridgeEA.mq5 not found in bundle".to_string());
        }

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
        Ok(format!("Copied EA to {}", dest.display()))
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

use std::fs;
