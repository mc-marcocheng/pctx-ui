use serde::Serialize;
use tauri::AppHandle;

use crate::app::LastOperation;
use crate::models::engine::EngineStatus;
use crate::persistence;

use super::CommandError;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsSnapshot {
    pub ui_version: String,
    pub engine: Option<EngineStatus>,
    pub last_operation: Option<LastOperation>,
    pub os: String,
    pub arch: String,
    pub workspace_dir: Option<std::path::PathBuf>,
}

#[tauri::command]
pub async fn get_diagnostics(
    app: AppHandle,
    state: tauri::State<'_, crate::app::ManagedAppState>,
) -> Result<DiagnosticsSnapshot, CommandError> {
    let engine = state
        .engine
        .read()
        .await
        .clone()
        .map(EngineStatus::from);

    let last_operation = state.last_operation.read().await.clone();

    Ok(DiagnosticsSnapshot {
        ui_version: app.package_info().version.to_string(),
        engine,
        last_operation,
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        workspace_dir: persistence::workspaces_dir(&app).ok(),
    })
}
