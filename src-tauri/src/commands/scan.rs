use crate::engine::args::build_scan_args;
use crate::engine::protocol::{parse_pctx_response, invalid_data, FileInfo, PctxResponse};
use crate::engine::runner::{run_process, DISCOVERY_STDOUT_LIMIT, STDERR_LIMIT};
use crate::models::generation::{DiscoveredFile, ScanRootRequest, ScanRootResponse};

use super::{register_operation, CommandError, OperationGuard};

#[tauri::command]
pub async fn scan_root(
    request: ScanRootRequest,
    state: tauri::State<'_, crate::app::ManagedAppState>,
) -> Result<ScanRootResponse, CommandError> {
    let engine = {
        let guard = state.engine.read().await;
        guard.clone().ok_or_else(|| CommandError {
            code: "engine_unavailable".into(),
            message: "No compatible pctx executable has been configured".into(),
        })?
    };

    let root = dunce::canonicalize(&request.root).map_err(|error| CommandError {
        code: "directory_not_found".into(),
        message: format!("{}: {}", request.root.display(), error),
    })?;

    if !root.is_dir() {
        return Err(CommandError {
            code: "not_a_directory".into(),
            message: format!("Not a directory: {}", root.display()),
        });
    }

    let token = register_operation(&state, &request.operation_id)?;
    let _guard = OperationGuard::new(&state, request.operation_id.clone());

    let args = build_scan_args(&request);

    let output = run_process(
        &engine.executable,
        &args,
        Some(&root),
        &[],
        token,
        std::time::Duration::from_secs(120),
        DISCOVERY_STDOUT_LIMIT,
        STDERR_LIMIT,
    )
    .await
    .map_err(CommandError::from)?;

    state
        .record_operation(
            "scan",
            output.exit_code,
            &String::from_utf8_lossy(&output.stderr),
        )
        .await;

    normalize_scan_response(&request.root_id, &root, &output)
}

fn normalize_discovered_path(
    root: &std::path::Path,
    reported: &str,
) -> Result<std::path::PathBuf, CommandError> {
    let reported_path = std::path::PathBuf::from(reported);

    let candidate = if reported_path.is_absolute() {
        reported_path
    } else {
        root.join(reported_path)
    };

    dunce::canonicalize(&candidate).map_err(|error| CommandError {
        code: "discovered_file_missing".into(),
        message: format!("{}: {}", candidate.display(), error),
    })
}

fn normalize_file_list(
    root: &std::path::Path,
    items: Vec<FileInfo>,
) -> Result<Vec<DiscoveredFile>, CommandError> {
    let mut files = Vec::with_capacity(items.len());

    for item in items {
        let canonical = normalize_discovered_path(root, &item.path)?;

        let relative = canonical
            .strip_prefix(root)
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_else(|_| canonical.to_string_lossy().into_owned());

        files.push(DiscoveredFile {
            canonical_path: canonical,
            relative_path: relative,
            extension: item.extension,
            size_bytes: item.size_bytes,
        });
    }

    Ok(files)
}

fn normalize_scan_response(
    root_id: &str,
    root: &std::path::Path,
    output: &crate::engine::runner::ProcessOutput,
) -> Result<ScanRootResponse, CommandError> {
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    let response = parse_pctx_response(output)?;

    match response {
        PctxResponse::Success { data, stats } => {
            let items: Vec<FileInfo> = serde_json::from_value(data).map_err(invalid_data)?;

            Ok(ScanRootResponse {
                root_id: root_id.into(),
                root: root.to_path_buf(),
                files: normalize_file_list(root, items)?,
                errors: Vec::new(),
                stats,
                exit_code: output.exit_code,
                stderr,
            })
        }

        PctxResponse::Partial {
            data,
            stats,
            errors,
        } => {
            let items: Vec<FileInfo> = serde_json::from_value(data).map_err(invalid_data)?;

            Ok(ScanRootResponse {
                root_id: root_id.into(),
                root: root.to_path_buf(),
                files: normalize_file_list(root, items)?,
                errors,
                stats,
                exit_code: output.exit_code,
                stderr,
            })
        }

        PctxResponse::Error {
            code,
            message,
            suggestion,
            ..
        } => {
            // `no_files_matched` is a valid, non-fatal discovery result.
            if code == "no_files_matched" {
                return Ok(ScanRootResponse {
                    root_id: root_id.into(),
                    root: root.to_path_buf(),
                    files: Vec::new(),
                    errors: Vec::new(),
                    stats: crate::engine::protocol::StatsJson::new(0),
                    exit_code: output.exit_code,
                    stderr,
                });
            }

            Err(CommandError {
                code,
                message: match suggestion {
                    Some(suggestion) => format!("{message}. {suggestion}"),
                    None => message,
                },
            })
        }
    }
}
