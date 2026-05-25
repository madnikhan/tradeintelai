mod bridge_manager;
mod config;
mod dependency_manager;
mod paths;
mod tunnel_manager;

use bridge_manager::{health_check_url, BridgeManager, BridgeState, CopyEaResult};
use config::AppConfig;
use dependency_manager::{ensure_dependencies, verify_dependencies, DependencyStatus};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, State,
};
use tauri_plugin_opener::OpenerExt;
use tunnel_manager::{build_dashboard_url, TunnelManager};

const DEFAULT_DASHBOARD_BASE: &str = "https://tradeintelai.vercel.app";

struct AppState {
    manager: Arc<BridgeManager>,
    tunnel: Arc<TunnelManager>,
    resource_dir: PathBuf,
}

#[derive(serde::Serialize)]
struct ConnectDashboardResult {
    tunnel_url: String,
    dashboard_url: String,
    clipboard_copied: bool,
}

#[tauri::command]
fn get_bridge_status(state: State<AppState>) -> bridge_manager::BridgeStatus {
    state.manager.get_status()
}

#[tauri::command]
fn get_dependency_status(state: State<AppState>) -> DependencyStatus {
    verify_dependencies(&state.resource_dir)
}

#[tauri::command]
fn get_tunnel_status(state: State<AppState>) -> tunnel_manager::TunnelStatus {
    state.tunnel.get_status()
}

#[tauri::command]
fn get_app_config(state: State<AppState>) -> AppConfig {
    state.manager.get_config()
}

#[tauri::command]
fn save_app_config(state: State<AppState>, config: AppConfig) -> Result<(), String> {
    state.manager.update_config(config)
}

#[tauri::command]
fn start_bridge(state: State<AppState>) -> Result<(), String> {
    state.manager.start()
}

#[tauri::command]
fn stop_bridge(state: State<AppState>) {
    state.manager.stop()
}

#[tauri::command]
fn start_tunnel(state: State<AppState>) -> Result<String, String> {
    let port = state.manager.get_config().bridge_port;
    let url = state.tunnel.start(port)?;
    persist_tunnel_url(&state.manager, &url)?;
    Ok(url)
}

#[tauri::command]
fn stop_tunnel(state: State<AppState>) {
    state.tunnel.stop();
}

#[tauri::command]
fn copy_ea_to_experts(state: State<AppState>) -> Result<CopyEaResult, String> {
    state.manager.copy_ea_to_experts()
}

#[tauri::command]
fn open_ea_in_metaeditor(state: State<AppState>) -> Result<String, String> {
    state.manager.open_ea_in_metaeditor()
}

#[tauri::command]
fn open_mt5_data_folder(state: State<AppState>) -> Result<(), String> {
    state.manager.open_mt5_data_folder()
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn connect_dashboard(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ConnectDashboardResult, String> {
    let app_handle = app.clone();
    let manager = Arc::clone(&state.manager);
    let tunnel = Arc::clone(&state.tunnel);
    let resource_dir = state.resource_dir.clone();

    tauri::async_runtime::spawn_blocking(move || {
        run_connect_dashboard(&app_handle, &manager, &tunnel, &resource_dir)
    })
    .await
    .map_err(|e| format!("Connect failed: {e}"))?
}

fn run_connect_dashboard(
    app: &AppHandle,
    manager: &BridgeManager,
    tunnel: &TunnelManager,
    resource_dir: &PathBuf,
) -> Result<ConnectDashboardResult, String> {
    ensure_dependencies(resource_dir)?;
    manager.start()?;
    std::thread::sleep(Duration::from_millis(800));
    wait_for_bridge(manager)?;

    let port = manager.get_config().bridge_port;
    let tunnel_url = tunnel.start(port)?;

    let mut config = manager.get_config();
    config.tunnel_url = Some(tunnel_url.clone());
    manager.update_config(config)?;

    let config = manager.get_config();
    let dashboard_base = config
        .dashboard_base_url
        .as_deref()
        .unwrap_or(DEFAULT_DASHBOARD_BASE);
    let dashboard_url = build_dashboard_url(dashboard_base, &tunnel_url);

    let clipboard_copied = arboard::Clipboard::new()
        .and_then(|mut cb| cb.set_text(&dashboard_url))
        .is_ok();

    app.opener()
        .open_url(&dashboard_url, None::<&str>)
        .map_err(|e| e.to_string())?;

    Ok(ConnectDashboardResult {
        tunnel_url,
        dashboard_url,
        clipboard_copied,
    })
}

fn persist_tunnel_url(manager: &BridgeManager, tunnel_url: &str) -> Result<(), String> {
    let mut config = manager.get_config();
    config.tunnel_url = Some(tunnel_url.to_string());
    manager.update_config(config)
}

/// macOS Gatekeeper quarantine on bundled binaries blocks Python/cloudflared from spawning.
#[cfg(target_os = "macos")]
fn clear_quarantine_on_bundled_binaries(resource_root: &Path) {
    use std::process::Command;
    for rel in [
        "python/bin/python3",
        "python/bin/python",
        "cloudflared/cloudflared",
    ] {
        let p = resource_root.join(rel);
        if p.exists() {
            let _ = Command::new("xattr")
                .args(["-dr", "com.apple.quarantine"])
                .arg(&p)
                .output();
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn clear_quarantine_on_bundled_binaries(_resource_root: &Path) {}

fn wait_for_bridge(manager: &BridgeManager) -> Result<(), String> {
    let port = manager.get_config().bridge_port;
    let url = health_check_url(port);
    let deadline = Instant::now() + Duration::from_secs(30);
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    while Instant::now() < deadline {
        if let Ok(resp) = client.get(&url).send() {
            if resp.status().is_success() {
                return Ok(());
            }
        }
        if let Some(status) = check_bridge_process_exited(manager) {
            return Err(status);
        }
        std::thread::sleep(Duration::from_millis(400));
    }

    if let Some(status) = check_bridge_process_exited(manager) {
        return Err(status);
    }

    Err(if cfg!(debug_assertions) {
        "Bridge did not become ready in time. Check ~/Library/Application Support/TradeIntel Bridge/bridge.log".to_string()
    } else {
        "Bridge did not start. Check MT5 is open with the EA attached, or reinstall from the dashboard.".to_string()
    })
}

fn check_bridge_process_exited(manager: &BridgeManager) -> Option<String> {
    let status = manager.get_status();
    if status.state == BridgeState::Error {
        return Some(status.message);
    }
    None
}

/// Root directory containing `bridge/`, `python/`, and `cloudflared/`.
/// Tauri bundles `resources/bridge/**` under `$RESOURCE/resources/bridge/` on macOS/Linux;
/// dev builds use `src-tauri/resources/` directly.
fn resource_dir(app: &AppHandle) -> PathBuf {
    if cfg!(debug_assertions) {
        let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources");
        if dev.join("bridge").exists() {
            return dev;
        }
    }

    let base = app
        .path()
        .resource_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    let nested = base.join("resources");
    if nested.join("bridge").exists() {
        return nested;
    }
    if base.join("bridge").exists() {
        return base;
    }
    nested
}

fn tray_tooltip_for_state(state: BridgeState) -> &'static str {
    match state {
        BridgeState::Stopped => "TradeIntel Bridge — Stopped",
        BridgeState::Starting => "TradeIntel Bridge — Starting…",
        BridgeState::RunningDisconnected => "TradeIntel Bridge — Running (MT5 disconnected)",
        BridgeState::RunningConnected => "TradeIntel Bridge — Connected",
        BridgeState::Error => "TradeIntel Bridge — Error",
    }
}

fn open_dashboard_with_tunnel(app: &AppHandle, state: &AppState) {
    let config = state.manager.get_config();
    let tunnel = state
        .tunnel
        .get_status()
        .tunnel_url
        .or(config.tunnel_url.clone());

    let dashboard_base = config
        .dashboard_base_url
        .as_deref()
        .unwrap_or(DEFAULT_DASHBOARD_BASE);

    let url = if let Some(tunnel_url) = tunnel {
        build_dashboard_url(dashboard_base, &tunnel_url)
    } else {
        format!("{}/dashboard", dashboard_base.trim_end_matches('/'))
    };

    let _ = app.opener().open_url(&url, None::<&str>);
}

fn build_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Open status window", true, None::<&str>)?;
    let connect =
        MenuItem::with_id(app, "connect", "Connect dashboard", true, None::<&str>)?;
    let start = MenuItem::with_id(app, "start", "Start bridge", true, None::<&str>)?;
    let stop = MenuItem::with_id(app, "stop", "Stop bridge", true, None::<&str>)?;
    let dashboard = MenuItem::with_id(app, "dashboard", "Open dashboard", true, None::<&str>)?;
    let ea = MenuItem::with_id(app, "ea", "Install EA to MT5", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show,
            &PredefinedMenuItem::separator(app)?,
            &connect,
            &start,
            &stop,
            &PredefinedMenuItem::separator(app)?,
            &dashboard,
            &ea,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let icon = app.default_window_icon().cloned().unwrap();
    let _tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .tooltip(tray_tooltip_for_state(BridgeState::Stopped))
        .menu(&menu)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    let _ = show_main_window(app.clone());
                }
                "connect" => {
                    if let Some(state) = app.try_state::<AppState>() {
                        if ensure_dependencies(&state.resource_dir).is_err() {
                            return;
                        }
                        let app_handle = app.clone();
                        let manager = Arc::clone(&state.manager);
                        let tunnel = Arc::clone(&state.tunnel);
                        std::thread::spawn(move || {
                            let bridge_result = manager.start().and_then(|_| wait_for_bridge(&manager));
                            if bridge_result.is_err() {
                                return;
                            }
                            let port = manager.get_config().bridge_port;
                            if let Ok(url) = tunnel.start(port) {
                                let config = manager.get_config();
                                let base = config
                                    .dashboard_base_url
                                    .as_deref()
                                    .unwrap_or(DEFAULT_DASHBOARD_BASE);
                                let dashboard_url = build_dashboard_url(base, &url);
                                let _ = arboard::Clipboard::new().and_then(|mut cb| cb.set_text(&dashboard_url));
                                let _ = app_handle.opener().open_url(&dashboard_url, None::<&str>);
                            }
                        });
                    }
                }
                "start" => {
                    if let Some(state) = app.try_state::<AppState>() {
                        let _ = state.manager.start();
                    }
                }
                "stop" => {
                    if let Some(state) = app.try_state::<AppState>() {
                        state.manager.stop();
                        state.tunnel.stop();
                    }
                }
                "dashboard" => {
                    if let Some(state) = app.try_state::<AppState>() {
                        open_dashboard_with_tunnel(app, &state);
                    }
                }
                "ea" => {
                    if let Some(state) = app.try_state::<AppState>() {
                        let _ = state.manager.copy_ea_to_experts();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let _ = show_main_window(app.clone());
            }
        })
        .build(app)?;

    Ok(())
}

fn spawn_status_emitter(app: AppHandle, manager: Arc<BridgeManager>) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(2));
        let status = manager.get_status();
        let _ = app.emit("bridge-status-changed", &status);
        if let Some(tray) = app.tray_by_id("main") {
            let _ = tray.set_tooltip(Some(tray_tooltip_for_state(status.state)));
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            let res = resource_dir(&app.handle());
            clear_quarantine_on_bundled_binaries(&res);
            let manager = Arc::new(BridgeManager::new(res.clone()));
            let tunnel = Arc::new(TunnelManager::new(res.clone()));
            app.manage(AppState {
                manager: Arc::clone(&manager),
                tunnel,
                resource_dir: res,
            });

            build_tray(&app.handle())?;

            let deps = verify_dependencies(&resource_dir(&app.handle()));
            let _ = app.handle().emit("dependency-status", &deps);

            let cfg = manager.get_config();
            if cfg.autostart_bridge {
                let _ = manager.start();
            }

            spawn_status_emitter(app.handle().clone(), manager);

            let _ = show_main_window(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_bridge_status,
            get_dependency_status,
            get_tunnel_status,
            get_app_config,
            save_app_config,
            start_bridge,
            stop_bridge,
            start_tunnel,
            stop_tunnel,
            copy_ea_to_experts,
            open_ea_in_metaeditor,
            open_mt5_data_folder,
            show_main_window,
            connect_dashboard,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if matches!(event, RunEvent::Exit) {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    state.tunnel.stop();
                    state.manager.stop();
                }
            }
        });
}
