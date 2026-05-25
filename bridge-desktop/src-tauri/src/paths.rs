use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

const ACTIVITY_WINDOW_SECS: u64 = 24 * 3600;

/// Reject placeholder / invalid user paths.
pub fn is_invalid_mt5_files_override(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.contains("paste_")
        || lower.contains("files_here")
        || lower.contains("bridge_url=")
        || lower.contains("vercel.app")
        || lower.contains("trycloudflare.com")
        || lower.contains("ngrok")
}

/// Normalize user override to MQL5/Files (append MQL5/Files if terminal hash or root given).
pub fn normalize_mt5_files_dir(path: &str) -> Option<PathBuf> {
    let trimmed = path.trim().trim_matches('"').trim_matches('\'');
    if trimmed.is_empty() || is_invalid_mt5_files_override(trimmed) {
        return None;
    }

    let mut p = PathBuf::from(trimmed);

    // If path ends with mt5-commands or mt5-responses, use parent Files folder
    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if name == "mt5-commands" || name == "mt5-responses" {
        p = p.parent()?.to_path_buf();
    }

    let path_str = p.to_string_lossy().to_lowercase();
    if path_str.ends_with("mql5/files") || path_str.ends_with("mql5\\files") {
        return Some(p);
    }

    // Terminal\<hash> without MQL5\Files
    if path_str.contains("metaquotes") && path_str.contains("terminal") {
        let with_mql5 = p.join("MQL5").join("Files");
        if with_mql5.is_dir() {
            return Some(with_mql5);
        }
    }

    // Program Files\MetaTrader 5 without MQL5\Files
    if path_str.contains("metatrader") && !path_str.contains("mql5") {
        let with_mql5 = p.join("MQL5").join("Files");
        if with_mql5.is_dir() {
            return Some(with_mql5);
        }
    }

    if p.is_dir() {
        return Some(p);
    }

    None
}

/// Create mt5-commands and mt5-responses under the Files folder.
pub fn ensure_mt5_bridge_dirs(files_dir: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(files_dir.join("mt5-commands"))?;
    std::fs::create_dir_all(files_dir.join("mt5-responses"))?;
    Ok(())
}

fn dir_has_recent_activity(dir: &Path) -> bool {
    let cutoff = SystemTime::now()
        .checked_sub(Duration::from_secs(ACTIVITY_WINDOW_SECS))
        .unwrap_or(SystemTime::UNIX_EPOCH);

    let Ok(entries) = std::fs::read_dir(dir) else {
        return false;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Ok(meta) = entry.metadata() {
                if let Ok(modified) = meta.modified() {
                    if modified > cutoff {
                        return true;
                    }
                }
            }
        }
    }
    false
}

fn files_dir_activity_score(files_dir: &Path) -> u64 {
    let mut score = 0u64;
    for sub in ["mt5-commands", "mt5-responses"] {
        let dir = files_dir.join(sub);
        if dir_has_recent_activity(&dir) {
            score += 1000;
        }
    }
    if let Ok(meta) = std::fs::metadata(files_dir) {
        if let Ok(modified) = meta.modified() {
            if let Ok(duration) = modified.duration_since(SystemTime::UNIX_EPOCH) {
                score += duration.as_secs();
            }
        }
    }
    score
}

fn push_if_exists(candidates: &mut Vec<PathBuf>, path: PathBuf) {
    if path.is_dir() && !candidates.iter().any(|c| c == &path) {
        candidates.push(path);
    }
}

fn terminal_hashes_files_dirs(terminal_root: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(terminal_root) else {
        return out;
    };
    for entry in entries.flatten() {
        let files = entry.path().join("MQL5").join("Files");
        push_if_exists(&mut out, files);
    }
    out
}

/// Collect all known MT5 MQL5/Files candidate paths (platform-specific order).
pub fn collect_mt5_files_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let metaquotes = home.join("Library/Application Support/net.metaquotes.wine.metatrader5/drive_c");
            push_if_exists(
                &mut candidates,
                metaquotes
                    .join("Program Files")
                    .join("MetaTrader 5")
                    .join("MQL5")
                    .join("Files"),
            );
            push_if_exists(
                &mut candidates,
                metaquotes
                    .join("Program Files (x86)")
                    .join("MetaTrader 5")
                    .join("MQL5")
                    .join("Files"),
            );

            let username = std::env::var("USER").unwrap_or_default();
            for terminal_root in [
                home.join(".wine/drive_c/users")
                    .join(&username)
                    .join("AppData/Roaming/MetaQuotes/Terminal"),
                home.join(".wine/drive_c/Users")
                    .join(&username)
                    .join("AppData/Roaming/MetaQuotes/Terminal"),
                home.join(".wine/drive_c/users")
                    .join(username.to_lowercase())
                    .join("AppData/Roaming/MetaQuotes/Terminal"),
                home.join(".wine/drive_c/Users")
                    .join(username.to_lowercase())
                    .join("AppData/Roaming/MetaQuotes/Terminal"),
            ] {
                for files in terminal_hashes_files_dirs(&terminal_root) {
                    push_if_exists(&mut candidates, files);
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let terminal_root = PathBuf::from(&appdata).join("MetaQuotes").join("Terminal");
            for files in terminal_hashes_files_dirs(&terminal_root) {
                push_if_exists(&mut candidates, files);
            }
        }

        if let Ok(pf) = std::env::var("ProgramFiles") {
            push_if_exists(
                &mut candidates,
                PathBuf::from(&pf).join("MetaTrader 5").join("MQL5").join("Files"),
            );
        }
        if let Ok(pf86) = std::env::var("ProgramFiles(x86)") {
            push_if_exists(
                &mut candidates,
                PathBuf::from(&pf86).join("MetaTrader 5").join("MQL5").join("Files"),
            );
        }

        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let terminal_root = PathBuf::from(&local).join("MetaQuotes").join("Terminal");
            for files in terminal_hashes_files_dirs(&terminal_root) {
                push_if_exists(&mut candidates, files);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(home) = dirs::home_dir() {
            let username = std::env::var("USER").unwrap_or_default();
            let terminal_root = home
                .join(".wine/drive_c/users")
                .join(username.to_lowercase())
                .join("AppData/Roaming/MetaQuotes/Terminal");
            for files in terminal_hashes_files_dirs(&terminal_root) {
                push_if_exists(&mut candidates, files);
            }
        }
    }

    candidates
}

fn select_best_mt5_files_dir(candidates: &[PathBuf]) -> Option<PathBuf> {
    if candidates.is_empty() {
        return None;
    }

    let mut best: Option<(u64, PathBuf)> = None;
    for path in candidates {
        let score = files_dir_activity_score(path);
        match &best {
            Some((best_score, _)) if score <= *best_score => {}
            _ => best = Some((score, path.clone())),
        }
    }

    best.map(|(_, p)| p)
}

/// Auto-detect the best MT5 MQL5/Files directory.
pub fn detect_mt5_files_dir() -> Option<PathBuf> {
    let candidates = collect_mt5_files_candidates();
    let selected = select_best_mt5_files_dir(&candidates)?;
    let _ = ensure_mt5_bridge_dirs(&selected);
    Some(selected)
}

/// Resolve MT5 Files dir: user override (normalized) or auto-detect.
pub fn resolve_mt5_files_dir(user_override: Option<&str>) -> Option<PathBuf> {
    if let Some(raw) = user_override {
        if !raw.trim().is_empty() {
            if let Some(normalized) = normalize_mt5_files_dir(raw) {
                let _ = ensure_mt5_bridge_dirs(&normalized);
                return Some(normalized);
            }
        }
    }
    detect_mt5_files_dir()
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
