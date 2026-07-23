use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::engine::args::canonical_key;
use crate::models::settings::RecentWorkspaceEntry;
use crate::models::workspace::WorkspaceFile;
use crate::persistence;

use super::CommandError;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalizeSourcesRequest {
    pub paths: Vec<PathBuf>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalSource {
    pub input: PathBuf,
    pub canonical: PathBuf,
    pub is_file: bool,
    pub is_directory: bool,
}

#[tauri::command]
pub async fn canonicalize_sources(
    request: CanonicalizeSourcesRequest,
) -> Result<Vec<CanonicalSource>, CommandError> {
    let mut result = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for input in request.paths {
        let canonical = dunce::canonicalize(&input).map_err(|error| CommandError {
            code: "path_not_found".into(),
            message: format!("{}: {}", input.display(), error),
        })?;

        let key = canonical_key(&canonical);
        if !seen.insert(key) {
            continue;
        }

        result.push(CanonicalSource {
            input,
            is_file: canonical.is_file(),
            is_directory: canonical.is_dir(),
            canonical,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn save_workspace(
    app: tauri::AppHandle,
    workspace: WorkspaceFile,
) -> Result<PathBuf, CommandError> {
    persistence::save_workspace_file(&app, &workspace)
}

#[tauri::command]
pub async fn load_workspace(
    app: tauri::AppHandle,
    id: String,
) -> Result<WorkspaceFile, CommandError> {
    persistence::load_workspace_file(&app, &id)
}

#[tauri::command]
pub async fn list_recent_workspaces(
    app: tauri::AppHandle,
) -> Result<Vec<RecentWorkspaceEntry>, CommandError> {
    persistence::load_recent_workspaces(&app)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceImportResult {
    pub workspace: WorkspaceFile,
    pub missing_source_ids: Vec<String>,
}

/// Imports a workspace definition from an arbitrary user-chosen file (e.g. a
/// shared `*.pctx-workspace.json`). Never trusts the file's paths without
/// canonicalizing them, and never executes or interprets any field as a
/// command. Missing sources are reported rather than silently dropped.
#[tauri::command]
pub async fn import_workspace_file(path: PathBuf) -> Result<WorkspaceImportResult, CommandError> {
    let bytes = std::fs::read(&path).map_err(|error| CommandError {
        code: "io_error".into(),
        message: format!("{}: {}", path.display(), error),
    })?;

    let mut workspace: WorkspaceFile =
        serde_json::from_slice(&bytes).map_err(|error| CommandError {
            code: "invalid_workspace_file".into(),
            message: format!("{}: {}", path.display(), error),
        })?;

    if workspace.schema_version != 1 {
        return Err(CommandError {
            code: "unsupported_schema_version".into(),
            message: format!(
                "Unsupported workspace schema version: {}",
                workspace.schema_version
            ),
        });
    }

    let mut missing_source_ids = Vec::new();

    for source in &mut workspace.sources {
        use crate::models::workspace::WorkspaceSource;

        let (id, path_ref): (&str, &mut PathBuf) = match source {
            WorkspaceSource::Directory { id, path, .. } => (id.as_str(), path),
            WorkspaceSource::File { id, path, .. } => (id.as_str(), path),
        };

        match dunce::canonicalize(&*path_ref) {
            Ok(canonical) => *path_ref = canonical,
            Err(_) => missing_source_ids.push(id.to_string()),
        }
    }

    Ok(WorkspaceImportResult {
        workspace,
        missing_source_ids,
    })
}

#[tauri::command]
pub async fn export_workspace_file(
    path: PathBuf,
    workspace: WorkspaceFile,
) -> Result<(), CommandError> {
    persistence::atomic::write_json_atomic(&path, &workspace)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::workspace::{
        ConfigSelection, FilterSettings, OutputSettings, TruncationSettings, WorkspaceSource,
    };

    fn sample_workspace(sources: Vec<WorkspaceSource>) -> WorkspaceFile {
        WorkspaceFile {
            schema_version: 1,
            id: "ws-1".into(),
            name: "Sample".into(),
            sources,
            selected_paths: Vec::new(),
            active_config: ConfigSelection::None,
            filters: FilterSettings::default(),
            truncation: TruncationSettings::default(),
            output: OutputSettings::default(),
            token_budget: None,
        }
    }

    #[tokio::test]
    async fn canonicalize_sources_deduplicates_and_flags_kind() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.txt");
        std::fs::write(&file, "hi").unwrap();

        let result = canonicalize_sources(CanonicalizeSourcesRequest {
            paths: vec![file.clone(), dir.path().to_path_buf(), file.clone()],
        })
        .await
        .unwrap();

        assert_eq!(result.len(), 2);
        assert!(result.iter().any(|entry| entry.is_file && !entry.is_directory));
        assert!(result.iter().any(|entry| entry.is_directory && !entry.is_file));
    }

    #[tokio::test]
    async fn canonicalize_sources_errors_on_missing_path() {
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("does-not-exist");

        let result = canonicalize_sources(CanonicalizeSourcesRequest { paths: vec![missing] }).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn import_workspace_file_canonicalizes_existing_sources() {
        let dir = tempfile::tempdir().unwrap();
        let project = dir.path().join("project");
        std::fs::create_dir(&project).unwrap();

        let workspace = sample_workspace(vec![WorkspaceSource::Directory {
            id: "src-1".into(),
            path: project.clone(),
            alias: "project".into(),
        }]);

        let file_path = dir.path().join("workspace.json");
        persistence::atomic::write_json_atomic(&file_path, &workspace).unwrap();

        let result = import_workspace_file(file_path).await.unwrap();

        assert!(result.missing_source_ids.is_empty());
        assert_eq!(result.workspace.sources.len(), 1);
    }

    #[tokio::test]
    async fn import_workspace_file_flags_missing_sources() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = sample_workspace(vec![WorkspaceSource::Directory {
            id: "src-missing".into(),
            path: dir.path().join("gone"),
            alias: "gone".into(),
        }]);

        let file_path = dir.path().join("workspace.json");
        persistence::atomic::write_json_atomic(&file_path, &workspace).unwrap();

        let result = import_workspace_file(file_path).await.unwrap();

        assert_eq!(result.missing_source_ids, vec!["src-missing".to_string()]);
    }

    #[tokio::test]
    async fn import_workspace_file_rejects_unsupported_schema_version() {
        let dir = tempfile::tempdir().unwrap();
        let mut workspace = sample_workspace(Vec::new());
        workspace.schema_version = 99;

        let file_path = dir.path().join("workspace.json");
        persistence::atomic::write_json_atomic(&file_path, &workspace).unwrap();

        let result = import_workspace_file(file_path).await;
        assert!(result.is_err());
    }
}
