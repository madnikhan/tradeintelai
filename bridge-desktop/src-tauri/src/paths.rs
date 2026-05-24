use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
pub fn detect_mt5_files_dir() -> Option<PathBuf> {
    let appdata = std::env::var("APPDATA").ok()?;
    let terminal_root = PathBuf::from(appdata).join("MetaQuotes").join("Terminal");
    if !terminal_root.is_dir() {
        return None;
    }
    let entries = std::fs::read_dir(&terminal_root).ok()?;
    for entry in entries.flatten() {
        let files = entry.path().join("MQL5").join("Files");
        if files.is_dir() {
            return Some(files);
        }
    }
    None
}

#[cfg(target_os = "macos")]
pub fn detect_mt5_files_dir() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    let username = std::env::var("USER").unwrap_or_default();
    let candidates = [
        home.join(".wine/drive_c/users")
            .join(&username)
            .join("AppData/Roaming/MetaQuotes/Terminal"),
        home.join(".wine/drive_c/Users")
            .join(&username)
            .join("AppData/Roaming/MetaQuotes/Terminal"),
    ];
    for terminal_root in candidates {
        if !terminal_root.is_dir() {
            continue;
        }
        if let Ok(entries) = std::fs::read_dir(&terminal_root) {
            for entry in entries.flatten() {
                let files = entry.path().join("MQL5").join("Files");
                if files.is_dir() {
                    return Some(files);
                }
            }
        }
    }
    None
}

#[cfg(target_os = "linux")]
pub fn detect_mt5_files_dir() -> Option<PathBuf> {
    detect_mt5_files_dir_mac_style()
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
pub fn detect_mt5_files_dir() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "linux")]
fn detect_mt5_files_dir_mac_style() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    let username = std::env::var("USER").unwrap_or_default();
    let terminal_root = home
        .join(".wine/drive_c/users")
        .join(username.to_lowercase())
        .join("AppData/Roaming/MetaQuotes/Terminal");
    if !terminal_root.is_dir() {
        return None;
    }
    let entries = std::fs::read_dir(&terminal_root).ok()?;
    for entry in entries.flatten() {
        let files = entry.path().join("MQL5").join("Files");
        if files.is_dir() {
            return Some(files);
        }
    }
    None
}

pub fn experts_dir_from_files(files_dir: &Path) -> PathBuf {
    files_dir
        .parent()
        .map(|p| p.join("Experts"))
        .unwrap_or_else(|| files_dir.join("Experts"))
}

pub fn bundled_bridge_root(resource_dir: &Path) -> PathBuf {
    resource_dir.join("bridge")
}

pub fn bundled_python_exe(resource_dir: &Path) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let p = resource_dir.join("python").join("python.exe");
        if p.exists() {
            return Some(p);
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let p = resource_dir.join("python").join("bin").join("python3");
        if p.exists() {
            return Some(p);
        }
        let p2 = resource_dir.join("python").join("bin").join("python");
        if p2.exists() {
            return Some(p2);
        }
    }
    None
}

pub fn bundled_cloudflared_exe(resource_dir: &Path) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let p = resource_dir.join("cloudflared").join("cloudflared.exe");
        if p.exists() {
            return Some(p);
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let p = resource_dir.join("cloudflared").join("cloudflared");
        if p.exists() {
            return Some(p);
        }
    }
    None
}

pub fn resolve_python_executable(resource_dir: &Path) -> PathBuf {
    if let Some(bundled) = bundled_python_exe(resource_dir) {
        return bundled;
    }
    if !cfg!(debug_assertions) {
        return PathBuf::from(if cfg!(target_os = "windows") {
            "python"
        } else {
            "python3"
        });
    }
    #[cfg(target_os = "windows")]
    {
        if let Ok(p) = which_python_windows() {
            return p;
        }
    }
    PathBuf::from(if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    })
}

pub fn resolve_cloudflared_executable(resource_dir: &Path) -> Option<PathBuf> {
    if let Some(bundled) = bundled_cloudflared_exe(resource_dir) {
        return Some(bundled);
    }
    if cfg!(debug_assertions) {
        return which_cloudflared().ok();
    }
    None
}

#[cfg(target_os = "windows")]
pub fn which_python_windows() -> Result<PathBuf, ()> {
    use std::process::Command;
    let output = Command::new("where").arg("python").output().map_err(|_| ())?;
    if !output.status.success() {
        return Err(());
    }
    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.contains("WindowsApps") {
            continue;
        }
        return Ok(PathBuf::from(line));
    }
    Err(())
}

pub fn which_cloudflared() -> Result<PathBuf, ()> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("where")
            .arg("cloudflared")
            .output()
            .map_err(|_| ())?;
        if !output.status.success() {
            return Err(());
        }
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            let line = line.trim();
            if !line.is_empty() {
                return Ok(PathBuf::from(line));
            }
        }
        Err(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        let output = Command::new("which")
            .arg("cloudflared")
            .output()
            .map_err(|_| ())?;
        if !output.status.success() {
            return Err(());
        }
        let line = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if line.is_empty() {
            return Err(());
        }
        Ok(PathBuf::from(line))
    }
}
