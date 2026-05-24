use crate::paths::{self, bundled_bridge_root};
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct DependencyStatus {
    pub python_ready: bool,
    pub cloudflared_ready: bool,
    pub bridge_script_ready: bool,
    pub all_ready: bool,
    pub is_release: bool,
    pub python_path: Option<String>,
    pub cloudflared_path: Option<String>,
    pub bridge_script_path: Option<String>,
}

pub fn verify_dependencies(resource_dir: &Path) -> DependencyStatus {
    let is_release = !cfg!(debug_assertions);

    let bundled_python = paths::bundled_python_exe(resource_dir);
    let python_ready = bundled_python.is_some()
        || (!is_release
            && (paths::resolve_python_executable(resource_dir).exists() || system_python_available()));

    let bundled_cloudflared = paths::bundled_cloudflared_exe(resource_dir);
    let cloudflared_ready = bundled_cloudflared.is_some()
        || (!is_release && paths::which_cloudflared().is_ok());

    let bridge_script = bundled_bridge_root(resource_dir).join("wine-mt5-connector.py");
    let bridge_script_ready = bridge_script.exists();

    let all_ready = python_ready && cloudflared_ready && bridge_script_ready;

    let python = paths::resolve_python_executable(resource_dir);
    let cloudflared = paths::resolve_cloudflared_executable(resource_dir);

    DependencyStatus {
        python_ready,
        cloudflared_ready,
        bridge_script_ready,
        all_ready,
        is_release,
        python_path: if python.exists() {
            Some(python.to_string_lossy().to_string())
        } else {
            bundled_python.map(|p| p.to_string_lossy().to_string())
        },
        cloudflared_path: cloudflared.map(|p| p.to_string_lossy().to_string()),
        bridge_script_path: if bridge_script.exists() {
            Some(bridge_script.to_string_lossy().to_string())
        } else {
            None
        },
    }
}

pub fn ensure_dependencies(resource_dir: &Path) -> Result<DependencyStatus, String> {
    let status = verify_dependencies(resource_dir);
    if status.all_ready {
        return Ok(status);
    }

    let mut missing = Vec::new();
    if !status.python_ready {
        missing.push("Python runtime");
    }
    if !status.cloudflared_ready {
        missing.push("secure tunnel (cloudflared)");
    }
    if !status.bridge_script_ready {
        missing.push("bridge files");
    }

    if status.is_release {
        Err(format!(
            "Missing bundled components: {}. Please reinstall TradeIntel Bridge.",
            missing.join(", ")
        ))
    } else {
        Err(format!(
            "Missing: {}. Run: npm run prepare:resources:release",
            missing.join(", ")
        ))
    }
}

fn system_python_available() -> bool {
    #[cfg(target_os = "windows")]
    {
        paths::which_python_windows().is_ok()
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("which")
            .arg("python3")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}
