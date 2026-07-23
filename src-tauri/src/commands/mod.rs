pub mod config;
pub mod diagnostics;
pub mod engine;
pub mod generate;
pub mod scan;
pub mod workspace;

use crate::engine::runner::RunnerError;

#[derive(Debug, Clone, serde::Serialize)]
pub struct CommandError {
    pub code: String,
    pub message: String,
}

impl std::fmt::Display for CommandError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for CommandError {}

impl From<RunnerError> for CommandError {
    fn from(value: RunnerError) -> Self {
        let code = match value {
            RunnerError::Cancelled => "cancelled",
            RunnerError::Timeout => "timeout",
            RunnerError::StdoutLimit => "stdout_limit",
            RunnerError::StderrLimit => "stderr_limit",
            RunnerError::Spawn { .. } => "engine_spawn_failed",
            RunnerError::Io(_) => "io_error",
        };

        Self {
            code: code.into(),
            message: value.to_string(),
        }
    }
}

pub fn register_operation(
    state: &crate::app::AppState,
    operation_id: &str,
) -> Result<tokio_util::sync::CancellationToken, CommandError> {
    if state.operations.contains_key(operation_id) {
        return Err(CommandError {
            code: "duplicate_operation".into(),
            message: format!("operation already exists: {operation_id}"),
        });
    }

    let token = tokio_util::sync::CancellationToken::new();
    state
        .operations
        .insert(operation_id.to_string(), token.clone());

    Ok(token)
}

pub struct OperationGuard<'a> {
    state: &'a crate::app::AppState,
    operation_id: String,
}

impl<'a> OperationGuard<'a> {
    pub fn new(state: &'a crate::app::AppState, operation_id: String) -> Self {
        Self {
            state,
            operation_id,
        }
    }
}

impl Drop for OperationGuard<'_> {
    fn drop(&mut self) {
        self.state.operations.remove(&self.operation_id);
    }
}
