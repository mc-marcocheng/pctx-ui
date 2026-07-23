pub mod atomic;

use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::commands::CommandError;
use crate::models::settings::{AppSettings, RecentWorkspaceEntry};
use crate::models::workspace::WorkspaceFile;

use self::atomic::{read_json, write_json_atomic};

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, CommandError> {
    app.path().app_data_dir().map_err(|error| CommandError {
        code: "app_data_unavailable".into(),
        message: error.to_string(),
    })
}

pub fn settings_path(app: &AppHandle) -> Result<PathBuf, CommandError> {
    Ok(app_data_dir(app)?.join("settings.json"))
}

pub fn recent_workspaces_path(app: &AppHandle) -> Result<PathBuf, CommandError> {
    Ok(app_data_dir(app)?.join("recent-workspaces.json"))
}

pub fn workspaces_dir(app: &AppHandle) -> Result<PathBuf, CommandError> {
    Ok(app_data_dir(app)?.join("workspaces"))
}

/// Workspace IDs are always UUIDs, but sanitize defensively before joining
/// into a filesystem path so a crafted id can never escape the workspaces
/// directory (e.g. path separators or `..`).
fn sanitize_workspace_id(id: &str) -> String {
    id.chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .collect()
}

pub fn workspace_path(app: &AppHandle, id: &str) -> Result<PathBuf, CommandError> {
    Ok(workspaces_dir(app)?.join(format!("{}.json", sanitize_workspace_id(id))))
}

pub fn load_app_settings(app: &AppHandle) -> Result<AppSettings, CommandError> {
    let path = settings_path(app)?;
    Ok(read_json::<AppSettings>(&path)?.unwrap_or_default())
}

pub fn save_app_settings(app: &AppHandle, settings: &AppSettings) -> Result<(), CommandError> {
    write_json_atomic(&settings_path(app)?, settings)
}

pub fn load_recent_workspaces(app: &AppHandle) -> Result<Vec<RecentWorkspaceEntry>, CommandError> {
    Ok(read_json::<Vec<RecentWorkspaceEntry>>(&recent_workspaces_path(app)?)?.unwrap_or_default())
}

pub fn touch_recent_workspace(
    app: &AppHandle,
    id: &str,
    name: &str,
) -> Result<(), CommandError> {
    let mut entries = load_recent_workspaces(app)?;
    entries.retain(|entry| entry.id != id);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    entries.insert(
        0,
        RecentWorkspaceEntry {
            id: id.to_string(),
            name: name.to_string(),
            last_opened_millis: now,
        },
    );
    entries.truncate(20);

    write_json_atomic(&recent_workspaces_path(app)?, &entries)
}

pub fn save_workspace_file(app: &AppHandle, workspace: &WorkspaceFile) -> Result<PathBuf, CommandError> {
    let path = workspace_path(app, &workspace.id)?;
    write_json_atomic(&path, workspace)?;
    touch_recent_workspace(app, &workspace.id, &workspace.name)?;
    Ok(path)
}

pub fn load_workspace_file(app: &AppHandle, id: &str) -> Result<WorkspaceFile, CommandError> {
    let path = workspace_path(app, id)?;
    read_json::<WorkspaceFile>(&path)?.ok_or_else(|| CommandError {
        code: "workspace_not_found".into(),
        message: format!("No saved workspace with id {id}"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_workspace_id_strips_path_traversal() {
        assert_eq!(sanitize_workspace_id("../../etc/passwd"), "etcpasswd");
        assert_eq!(sanitize_workspace_id("a1b2-c3d4"), "a1b2-c3d4");
        assert_eq!(sanitize_workspace_id("..\\..\\windows"), "windows");
    }

    #[test]
    fn sanitize_workspace_id_keeps_normal_uuid_unchanged() {
        let uuid = "550e8400-e29b-41d4-a716-446655440000";
        assert_eq!(sanitize_workspace_id(uuid), uuid);
    }
}
