use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use super::engine::EngineMode;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Theme {
    System,
    Light,
    Dark,
}

impl Default for Theme {
    fn default() -> Self {
        Self::System
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub schema_version: u32,
    #[serde(default)]
    pub engine_mode: EngineMode,
    pub external_engine: Option<PathBuf>,
    pub restore_last_workspace: bool,
    pub last_workspace_id: Option<String>,
    #[serde(default)]
    pub theme: Theme,
    pub diagnostics_enabled: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            engine_mode: EngineMode::Auto,
            external_engine: None,
            restore_last_workspace: true,
            last_workspace_id: None,
            theme: Theme::System,
            diagnostics_enabled: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentWorkspaceEntry {
    pub id: String,
    pub name: String,
    pub last_opened_millis: u128,
}
