use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const CONFIG_FILE: &str = "config.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub bridge_port: u16,
    pub mt5_files_dir: Option<String>,
    pub tunnel_url: Option<String>,
    pub dashboard_base_url: Option<String>,
    pub autostart_bridge: bool,
}

impl AppConfig {
    pub fn load() -> Self {
        let path = config_path();
        if path.exists() {
            if let Ok(data) = fs::read_to_string(&path) {
                if let Ok(cfg) = serde_json::from_str(&data) {
                    return cfg;
                }
            }
        }
        Self {
            bridge_port: 8080,
            autostart_bridge: true,
            dashboard_base_url: Some("https://tradeintelai.vercel.app".to_string()),
            ..Default::default()
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let path = config_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let data = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(path, data).map_err(|e| e.to_string())
    }
}

fn config_path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("TradeIntelBridge").join(CONFIG_FILE)
}
