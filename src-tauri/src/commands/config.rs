use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::engine::protocol::{parse_pctx_response, PctxResponse};
use crate::engine::runner::{run_process, PROBE_LIMIT};
use crate::models::workspace::ConfigSelection;

use super::{register_operation, CommandError, OperationGuard};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadConfigRequest {
    pub operation_id: String,
    pub config: ConfigSelection,
    pub cwd: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedConfigResponse {
    pub raw: serde_json::Value,
    pub stderr: String,
}

#[tauri::command]
pub async fn load_engine_config(
    request: LoadConfigRequest,
    state: tauri::State<'_, crate::app::ManagedAppState>,
) -> Result<ResolvedConfigResponse, CommandError> {
    let engine = {
        let guard = state.engine.read().await;
        guard.clone().ok_or_else(|| CommandError {
            code: "engine_unavailable".into(),
            message: "No compatible pctx executable has been configured".into(),
        })?
    };

    let cwd = dunce::canonicalize(&request.cwd).map_err(|error| CommandError {
        code: "directory_not_found".into(),
        message: format!("{}: {}", request.cwd.display(), error),
    })?;

    let mut args = vec![
        std::ffi::OsString::from("--json"),
        std::ffi::OsString::from("--no-color"),
    ];

    match &request.config {
        ConfigSelection::None => args.push(std::ffi::OsString::from("--no-config")),
        ConfigSelection::File(path) => {
            args.push(std::ffi::OsString::from("--config"));
            args.push(path.as_os_str().to_owned());
        }
    }

    args.push(std::ffi::OsString::from("config"));
    args.push(std::ffi::OsString::from("show"));

    let token = register_operation(&state, &request.operation_id)?;
    let _guard = OperationGuard::new(&state, request.operation_id.clone());

    let output = run_process(
        &engine.executable,
        &args,
        Some(&cwd),
        &[],
        token,
        std::time::Duration::from_secs(30),
        PROBE_LIMIT,
        PROBE_LIMIT,
    )
    .await
    .map_err(CommandError::from)?;

    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();

    let raw: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|error| CommandError {
            code: "invalid_engine_response".into(),
            message: format!(
                "pctx returned invalid JSON (exit {}): {}. stderr: {}",
                output.exit_code, error, stderr
            ),
        })?;

    Ok(ResolvedConfigResponse { raw, stderr })
}

#[tauri::command]
pub async fn get_default_excludes(
    state: tauri::State<'_, crate::app::ManagedAppState>,
) -> Result<serde_json::Value, CommandError> {
    let engine = {
        let guard = state.engine.read().await;
        guard.clone().ok_or_else(|| CommandError {
            code: "engine_unavailable".into(),
            message: "No compatible pctx executable has been configured".into(),
        })?
    };

    let args = vec![
        std::ffi::OsString::from("--json"),
        std::ffi::OsString::from("--no-color"),
        std::ffi::OsString::from("config"),
        std::ffi::OsString::from("defaults"),
    ];

    let output = run_process(
        &engine.executable,
        &args,
        None,
        &[],
        tokio_util::sync::CancellationToken::new(),
        std::time::Duration::from_secs(30),
        PROBE_LIMIT,
        PROBE_LIMIT,
    )
    .await
    .map_err(CommandError::from)?;

    serde_json::from_slice(&output.stdout).map_err(|error| CommandError {
        code: "invalid_engine_response".into(),
        message: format!("pctx returned invalid JSON: {error}"),
    })
}

/// Walks upward from `start` looking for `.pctx.toml`, per plan section 20.2.
pub fn find_config_candidate(start: &Path) -> Option<PathBuf> {
    let mut current = if start.is_file() {
        start.parent()?.to_path_buf()
    } else {
        start.to_path_buf()
    };

    loop {
        let candidate = current.join(".pctx.toml");
        if candidate.is_file() {
            return Some(candidate);
        }

        if !current.pop() {
            return None;
        }
    }
}

#[tauri::command]
pub async fn find_config_candidates(paths: Vec<PathBuf>) -> Result<Vec<PathBuf>, CommandError> {
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();

    for path in paths {
        if let Some(candidate) = find_config_candidate(&path) {
            if let Ok(canonical) = dunce::canonicalize(&candidate) {
                let key = crate::engine::args::canonical_key(&canonical);
                if seen.insert(key) {
                    result.push(canonical);
                }
            }
        }
    }

    Ok(result)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigInitRequest {
    pub operation_id: String,
    pub target_dir: PathBuf,
    pub force: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigInitResponse {
    pub path: PathBuf,
    pub stderr: String,
}

#[tauri::command]
pub async fn config_init(
    request: ConfigInitRequest,
    state: tauri::State<'_, crate::app::ManagedAppState>,
) -> Result<ConfigInitResponse, CommandError> {
    let engine = {
        let guard = state.engine.read().await;
        guard.clone().ok_or_else(|| CommandError {
            code: "engine_unavailable".into(),
            message: "No compatible pctx executable has been configured".into(),
        })?
    };

    let target_dir = dunce::canonicalize(&request.target_dir).map_err(|error| CommandError {
        code: "directory_not_found".into(),
        message: format!("{}: {}", request.target_dir.display(), error),
    })?;

    let mut args = vec![
        std::ffi::OsString::from("--json"),
        std::ffi::OsString::from("--no-color"),
        std::ffi::OsString::from("config"),
        std::ffi::OsString::from("init"),
    ];

    if request.force {
        args.push(std::ffi::OsString::from("--force"));
    }

    let token = register_operation(&state, &request.operation_id)?;
    let _guard = OperationGuard::new(&state, request.operation_id.clone());

    let output = run_process(
        &engine.executable,
        &args,
        Some(&target_dir),
        &[],
        token,
        std::time::Duration::from_secs(30),
        PROBE_LIMIT,
        PROBE_LIMIT,
    )
    .await
    .map_err(CommandError::from)?;

    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    let response = parse_pctx_response(&output)?;

    match response {
        PctxResponse::Success { .. } | PctxResponse::Partial { .. } => Ok(ConfigInitResponse {
            path: target_dir.join(".pctx.toml"),
            stderr,
        }),
        PctxResponse::Error {
            code,
            message,
            suggestion,
            ..
        } => Err(CommandError {
            code,
            message: match suggestion {
                Some(suggestion) => format!("{message}. {suggestion}"),
                None => message,
            },
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_config_in_start_directory() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(".pctx.toml"), "").unwrap();

        let found = find_config_candidate(dir.path()).unwrap();
        assert_eq!(found, dir.path().join(".pctx.toml"));
    }

    #[test]
    fn walks_upward_from_a_file() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(".pctx.toml"), "").unwrap();
        let nested = dir.path().join("src");
        std::fs::create_dir(&nested).unwrap();
        let file = nested.join("main.rs");
        std::fs::write(&file, "").unwrap();

        let found = find_config_candidate(&file).unwrap();
        assert_eq!(found, dir.path().join(".pctx.toml"));
    }

    #[test]
    fn walks_upward_from_a_nested_directory() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(".pctx.toml"), "").unwrap();
        let nested = dir.path().join("a").join("b");
        std::fs::create_dir_all(&nested).unwrap();

        let found = find_config_candidate(&nested).unwrap();
        assert_eq!(found, dir.path().join(".pctx.toml"));
    }

    #[test]
    fn returns_none_when_no_config_exists() {
        let dir = tempfile::tempdir().unwrap();
        assert!(find_config_candidate(dir.path()).is_none());
    }
}
