use crate::engine::args::{build_generate_args, canonical_key};
use crate::engine::protocol::{invalid_data, parse_pctx_response, ContextData, PctxResponse, StatsJson};
use crate::engine::runner::{run_process, ProcessOutput, PREVIEW_STDOUT_LIMIT, STDERR_LIMIT};
use crate::models::generation::{
    GenerateRequest, GenerateResponse, GenerationStatus, PathAliasRequest,
};

use super::{register_operation, CommandError, OperationGuard};

pub fn encode_stdin0(paths: &[std::path::PathBuf]) -> Result<Vec<u8>, CommandError> {
    let mut bytes = Vec::new();

    for path in paths {
        let value = path.to_str().ok_or_else(|| CommandError {
            code: "unsupported_path_encoding".into(),
            message: format!("Path is not valid Unicode: {}", path.display()),
        })?;

        if value.as_bytes().contains(&0) {
            return Err(CommandError {
                code: "invalid_path".into(),
                message: "A path contains a NUL byte".into(),
            });
        }

        bytes.extend_from_slice(value.as_bytes());
        bytes.push(0);
    }

    Ok(bytes)
}

pub fn prepare_selected_paths(
    paths: &[std::path::PathBuf],
) -> Result<Vec<std::path::PathBuf>, CommandError> {
    let mut result = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for input in paths {
        let canonical = dunce::canonicalize(input).map_err(|error| CommandError {
            code: "file_not_found".into(),
            message: format!("{}: {}", input.display(), error),
        })?;

        if !canonical.is_file() {
            return Err(CommandError {
                code: "not_a_file".into(),
                message: format!(
                    "Final generation accepts files only: {}",
                    canonical.display()
                ),
            });
        }

        if seen.insert(canonical_key(&canonical)) {
            result.push(canonical);
        }
    }

    result.sort();
    Ok(result)
}

fn choose_generation_cwd(aliases: &[PathAliasRequest]) -> Option<std::path::PathBuf> {
    aliases
        .first()
        .and_then(|mapping| dunce::canonicalize(&mapping.root).ok())
        .or_else(|| std::env::current_dir().ok())
}

#[tauri::command]
pub async fn generate_context(
    mut request: GenerateRequest,
    state: tauri::State<'_, crate::app::ManagedAppState>,
) -> Result<GenerateResponse, CommandError> {
    let engine = {
        let guard = state.engine.read().await;
        guard.clone().ok_or_else(|| CommandError {
            code: "engine_unavailable".into(),
            message: "No compatible pctx executable has been configured".into(),
        })?
    };

    if request.selected_paths.is_empty() {
        return Err(CommandError {
            code: "no_files_selected".into(),
            message: "Select at least one file".into(),
        });
    }

    request.selected_paths = prepare_selected_paths(&request.selected_paths)?;

    let stdin = encode_stdin0(&request.selected_paths)?;
    let args = build_generate_args(&request)?;

    let token = register_operation(&state, &request.operation_id)?;
    let _guard = OperationGuard::new(&state, request.operation_id.clone());

    let timeout = std::time::Duration::from_secs(
        request.timeout_seconds.unwrap_or(300).clamp(10, 1800),
    );

    // The working directory only affects the fallback display path. Every
    // selected source should normally be covered by a path alias.
    let cwd = choose_generation_cwd(&request.aliases);

    let output = run_process(
        &engine.executable,
        &args,
        cwd.as_deref(),
        &stdin,
        token,
        timeout,
        PREVIEW_STDOUT_LIMIT,
        STDERR_LIMIT,
    )
    .await
    .map_err(CommandError::from)?;

    state
        .record_operation(
            "generate",
            output.exit_code,
            &String::from_utf8_lossy(&output.stderr),
        )
        .await;

    normalize_generate_response(&output)
}

fn normalize_generate_response(output: &ProcessOutput) -> Result<GenerateResponse, CommandError> {
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    let response = parse_pctx_response(output)?;

    match response {
        PctxResponse::Success { data, stats } => {
            let context: ContextData = serde_json::from_value(data).map_err(invalid_data)?;

            Ok(GenerateResponse {
                status: GenerationStatus::Success,
                context: Some(context),
                stats,
                errors: Vec::new(),
                exit_code: output.exit_code,
                stderr,
            })
        }

        PctxResponse::Partial {
            data,
            stats,
            errors,
        } => {
            let context: ContextData = serde_json::from_value(data).map_err(invalid_data)?;

            Ok(GenerateResponse {
                status: GenerationStatus::Partial,
                context: Some(context),
                stats,
                errors,
                exit_code: output.exit_code,
                stderr,
            })
        }

        PctxResponse::Error {
            code,
            message,
            suggestion,
            transient,
            exit_code,
            ..
        } => Ok(GenerateResponse {
            status: GenerationStatus::Error,
            context: None,
            stats: StatsJson::new(0),
            errors: vec![crate::engine::protocol::FileError {
                path: String::new(),
                code,
                message: match suggestion {
                    Some(suggestion) => format!("{message}. {suggestion}"),
                    None => message,
                },
                transient,
            }],
            exit_code,
            stderr,
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stdin0_encodes_paths_with_nul_separators() {
        let paths = vec![
            std::path::PathBuf::from("a/b.txt"),
            std::path::PathBuf::from("c/d.txt"),
        ];

        let encoded = encode_stdin0(&paths).unwrap();
        let text = String::from_utf8(encoded).unwrap();
        let parts: Vec<&str> = text.split('\0').filter(|s| !s.is_empty()).collect();

        assert_eq!(parts, vec!["a/b.txt", "c/d.txt"]);
    }

    #[test]
    fn prepare_selected_paths_deduplicates_and_sorts() {
        let dir = tempfile::tempdir().unwrap();
        let file_a = dir.path().join("a.txt");
        let file_b = dir.path().join("b.txt");
        std::fs::write(&file_a, "a").unwrap();
        std::fs::write(&file_b, "b").unwrap();

        let paths = vec![file_b.clone(), file_a.clone(), file_a.clone()];
        let result = prepare_selected_paths(&paths).unwrap();

        assert_eq!(result.len(), 2);
    }

    #[test]
    fn prepare_selected_paths_rejects_directories() {
        let dir = tempfile::tempdir().unwrap();
        let result = prepare_selected_paths(&[dir.path().to_path_buf()]);
        assert!(result.is_err());
    }
}
