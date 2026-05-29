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

fn ends_with_mql5_files(path: &Path) -> bool {
    let s = path.to_string_lossy().to_lowercase();
    s.ends_with("mql5/files") || s.ends_with("mql5\\files")
}

/// Expand Windows %VAR% environment variables (matches Python expandvars).
#[cfg(target_os = "windows")]
fn expand_env_vars(path: &str) -> String {
    let mut result = path.to_string();
    for (key, value) in std::env::vars() {
        result = result.replace(&format!("%{key}%"), &value);
    }
    result
}

#[cfg(not(target_os = "windows"))]
fn expand_env_vars(path: &str) -> String {
    path.to_string()
}

/// Resolve a path to MQL5/Files, creating the folder when parent MT5 data dir exists.
fn resolve_to_mql5_files(mut p: PathBuf) -> Option<PathBuf> {
    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if name == "mt5-commands" || name == "mt5-responses" {
        p = p.parent()?.to_path_buf();
    }

    if ends_with_mql5_files(&p) {
        let _ = std::fs::create_dir_all(&p);
        return p.is_dir().then_some(p);
    }

    let path_str = p.to_string_lossy().to_lowercase();
    let with_mql5 = p.join("MQL5").join("Files");

    if path_str.contains("metaquotes") && path_str.contains("terminal") && p.is_dir() {
        let _ = std::fs::create_dir_all(&with_mql5);
        if with_mql5.is_dir() {
            return Some(with_mql5);
        }
    }

    if (path_str.contains("metatrader") || path_str.contains("mt5")) && p.is_dir() {
        let _ = std::fs::create_dir_all(&with_mql5);
        if with_mql5.is_dir() {
            return Some(with_mql5);
        }
    }

    None
}

/// Normalize user override to MQL5/Files (append MQL5/Files if terminal hash or install root given).
pub fn normalize_mt5_files_dir(path: &str) -> Option<PathBuf> {
    let expanded = expand_env_vars(path);
    let trimmed = expanded.trim().trim_matches('"').trim_matches('\'');
    if trimmed.is_empty() || is_invalid_mt5_files_override(trimmed) {
        return None;
    }

    resolve_to_mql5_files(PathBuf::from(trimmed))
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

/// User-facing steps when auto-detect fails (bridge cannot start without Files path).
pub const MT5_FILES_NOT_FOUND_HELP: &str = "MT5 Files folder not found. \
1) Open MetaTrader 5 and log in once. \
2) In MT5: File → Open Data Folder → open MQL5 → Files (create Files if missing). \
3) Copy that folder path into Advanced → MT5 Files path → Save settings. \
4) Click Start bridge again. \
Attaching the EA alone is not enough — the bridge needs the Files folder for commands.";

#[derive(serde::Serialize, Clone)]
pub struct Mt5FilesCandidateInfo {
    pub path: String,
    pub has_commands_dir: bool,
    pub has_responses_dir: bool,
}

#[derive(serde::Serialize)]
pub struct Mt5FilesCandidatesResult {
    pub candidates: Vec<Mt5FilesCandidateInfo>,
    pub selected_path: Option<String>,
    pub saved_override: Option<String>,
    pub appdata_terminal_root: Option<String>,
}

fn candidate_info(path: &Path) -> Mt5FilesCandidateInfo {
    Mt5FilesCandidateInfo {
        path: path.to_string_lossy().to_string(),
        has_commands_dir: path.join("mt5-commands").is_dir(),
        has_responses_dir: path.join("mt5-responses").is_dir(),
    }
}

/// Scan Program Files (x86) for broker-specific MT5 installs (e.g. HFM MetaTrader 5).
#[cfg(target_os = "windows")]
fn scan_program_files_for_mt5(candidates: &mut Vec<PathBuf>) {
    for env_key in ["ProgramFiles", "ProgramFiles(x86)"] {
        let Ok(root) = std::env::var(env_key) else {
            continue;
        };
        let root_path = PathBuf::from(&root);
        let Ok(entries) = std::fs::read_dir(&root_path) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_lowercase();
            if name.contains("metatrader") || name.contains("mt5") {
                push_if_exists(candidates, path.join("MQL5").join("Files"));
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn scan_program_files_for_mt5(_candidates: &mut Vec<PathBuf>) {}

fn terminal_hashes_files_dirs(terminal_root: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(terminal_root) else {
        return out;
    };
    for entry in entries.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let files = entry.path().join("MQL5").join("Files");
        if files.is_dir() {
            push_if_exists(&mut out, files);
        } else {
            // Terminal hash exists (MT5 ran once) — create MQL5/Files if missing
            let _ = std::fs::create_dir_all(&files);
            push_if_exists(&mut out, files);
        }
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

        scan_program_files_for_mt5(&mut candidates);
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

/// Log detection diagnostics (for bridge.log troubleshooting).
pub fn log_mt5_detection_failure(user_override: Option<&str>, log: impl Fn(&str)) {
    log("MT5 Files detection failed");
    if let Ok(appdata) = std::env::var("APPDATA") {
        log(&format!("APPDATA={appdata}"));
        let terminal_root = PathBuf::from(&appdata).join("MetaQuotes").join("Terminal");
        log(&format!(
            "Terminal root exists: {}",
            terminal_root.is_dir()
        ));
    }
    if let Some(raw) = user_override {
        if !raw.trim().is_empty() {
            log(&format!("Saved override (raw): {raw}"));
            if let Some(normalized) = normalize_mt5_files_dir(raw) {
                log(&format!(
                    "Saved override (normalized): {}",
                    normalized.display()
                ));
            } else {
                log("Saved override could not be normalized to MQL5\\Files");
            }
        }
    }
    let candidates = collect_mt5_files_candidates();
    log(&format!("Candidate count: {}", candidates.len()));
    for (i, c) in candidates.iter().enumerate() {
        log(&format!("  candidate[{i}]: {}", c.display()));
    }
}

/// List all candidate paths and which would be auto-selected (for UI diagnostics).
pub fn list_mt5_files_candidates(user_override: Option<&str>) -> Mt5FilesCandidatesResult {
    let appdata_terminal_root = std::env::var("APPDATA")
        .ok()
        .map(|a| PathBuf::from(a).join("MetaQuotes").join("Terminal"))
        .filter(|p| p.is_dir())
        .map(|p| p.to_string_lossy().to_string());

    let saved_override = user_override.and_then(|raw| {
        if raw.trim().is_empty() {
            None
        } else {
            normalize_mt5_files_dir(raw).map(|p| p.to_string_lossy().to_string())
        }
    });

    let paths = collect_mt5_files_candidates();
    let selected = saved_override
        .as_ref()
        .and_then(|s| normalize_mt5_files_dir(s))
        .or_else(|| select_best_mt5_files_dir(&paths));

    let mut candidates: Vec<Mt5FilesCandidateInfo> =
        paths.iter().map(|p| candidate_info(p)).collect();

    if let Some(ref override_path) = saved_override {
        let info = candidate_info(Path::new(override_path));
        if !candidates.iter().any(|c| c.path == info.path) {
            candidates.insert(0, info);
        }
    }

    Mt5FilesCandidatesResult {
        candidates,
        selected_path: selected.map(|p| p.to_string_lossy().to_string()),
        saved_override,
        appdata_terminal_root,
    }
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
