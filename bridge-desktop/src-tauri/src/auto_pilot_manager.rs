use crate::config::AppConfig;
use crate::paths::{bundled_bridge_root, resolve_python_executable};
use parking_lot::Mutex;
use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AutoPilotState {
    Stopped,
    Starting,
    Running,
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub struct AutoPilotStatus {
    pub state: AutoPilotState,
    pub message: String,
    pub pid: Option<u32>,
    pub log_path: Option<String>,
    pub config_path: Option<String>,
}

fn autopilot_log_path() -> Option<PathBuf> {
    dirs::data_local_dir().map(|d| d.join("TradeIntel Bridge").join("auto-pilot.log"))
}

fn append_autopilot_log(line: &str) {
    if let Some(path) = autopilot_log_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
            let _ = writeln!(f, "{line}");
        }
    }
}

pub struct AutoPilotManager {
    inner: Arc<AutoPilotInner>,
}

struct AutoPilotInner {
    resource_dir: PathBuf,
    child: Mutex<Option<Child>>,
    status: Mutex<AutoPilotStatus>,
}

impl AutoPilotManager {
    pub fn new(resource_dir: PathBuf) -> Self {
        let log_path = autopilot_log_path().map(|p| p.to_string_lossy().to_string());
        let status = AutoPilotStatus {
            state: AutoPilotState::Stopped,
            message: "Auto Pilot stopped".to_string(),
            pid: None,
            log_path,
            config_path: None,
        };
        Self {
            inner: Arc::new(AutoPilotInner {
                resource_dir,
                child: Mutex::new(None),
                status: Mutex::new(status),
            }),
        }
    }

    pub fn get_status(&self) -> AutoPilotStatus {
        self.inner.status.lock().clone()
    }

    pub fn read_log_tail(&self, max_lines: usize) -> String {
        let Some(path) = autopilot_log_path() else {
            return String::new();
        };
        let content = fs::read_to_string(&path).unwrap_or_default();
        let lines: Vec<&str> = content.lines().collect();
        if lines.len() <= max_lines {
            return content;
        }
        lines[lines.len() - max_lines..].join("\n")
    }

    pub fn start(&self, config: &AppConfig) -> Result<(), String> {
        {
            let child_guard = self.inner.child.lock();
            if child_guard.is_some() {
                return Ok(());
            }
        }

        let bridge_root = bundled_bridge_root(&self.inner.resource_dir);
        let daemon = bridge_root.join("auto-trader-daemon.py");
        if !daemon.exists() {
            return Err(format!(
                "Auto Pilot daemon not found at {}. Update bridge resources.",
                daemon.display()
            ));
        }

        let data_dir = bridge_root.join("data");
        let _ = fs::create_dir_all(&data_dir);
        let config_path = data_dir.join("auto-pilot-config.json");
        if !config_path.exists() {
            let default = r#"{"enabled":true,"preset":"trend","pairs":["EURUSD","GBPUSD"],"dryRun":true}"#;
            let _ = fs::write(&config_path, default);
        }

        let python = resolve_python_executable(&self.inner.resource_dir);
        {
            let mut status = self.inner.status.lock();
            status.state = AutoPilotState::Starting;
            status.message = "Starting Auto Pilot daemon…".to_string();
            status.config_path = Some(config_path.to_string_lossy().to_string());
        }

        let mut cmd = Command::new(&python);
        cmd.arg(&daemon)
            .current_dir(&bridge_root)
            .env("MT5_BRIDGE_ROOT", bridge_root.to_string_lossy().to_string())
            .env("MT5_BRIDGE_PORT", config.bridge_port.to_string())
            .env(
                "AUTO_PILOT_CONFIG_PATH",
                config_path.to_string_lossy().to_string(),
            )
            .env("AUTO_PILOT_SKIP_LICENSE", "1")
            .stdout(Stdio::null());

        if let Some(log_path) = autopilot_log_path() {
            if let Some(parent) = log_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if let Ok(log_file) = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
            {
                cmd.stderr(Stdio::from(log_file));
                append_autopilot_log("--- auto pilot start ---");
            } else {
                cmd.stderr(Stdio::null());
            }
        } else {
            cmd.stderr(Stdio::null());
        }

        let child = cmd.spawn().map_err(|e| {
            let msg = format!("Failed to start Auto Pilot: {e}");
            let mut status = self.inner.status.lock();
            status.state = AutoPilotState::Error;
            status.message = msg.clone();
            msg
        })?;

        let pid = child.id();
        *self.inner.child.lock() = Some(child);
        {
            let mut status = self.inner.status.lock();
            status.state = AutoPilotState::Running;
            status.message = "Auto Pilot running (Windows VPS recommended)".to_string();
            status.pid = Some(pid);
        }
        Ok(())
    }

    pub fn stop(&self) {
        if let Some(mut child) = self.inner.child.lock().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        let mut status = self.inner.status.lock();
        status.state = AutoPilotState::Stopped;
        status.message = "Auto Pilot stopped".to_string();
        status.pid = None;
        append_autopilot_log("--- auto pilot stop ---");
    }

    pub fn poll_child(&self) {
        let mut child_opt = self.inner.child.lock();
        if let Some(child) = child_opt.as_mut() {
            match child.try_wait() {
                Ok(Some(code)) => {
                    *child_opt = None;
                    let mut status = self.inner.status.lock();
                    status.state = AutoPilotState::Error;
                    status.message = format!("Auto Pilot exited ({code})");
                    status.pid = None;
                }
                Ok(None) => {}
                Err(e) => {
                    let mut status = self.inner.status.lock();
                    status.state = AutoPilotState::Error;
                    status.message = format!("Auto Pilot poll error: {e}");
                }
            }
        }
    }
}
