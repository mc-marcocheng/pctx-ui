use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::runner::ProcessOutput;
use crate::commands::CommandError;

/// The top-level normal command response is tagged by `status`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum PctxResponse {
    Success {
        data: Value,
        stats: StatsJson,
    },
    Partial {
        data: Value,
        stats: StatsJson,
        errors: Vec<FileError>,
    },
    Error {
        code: String,
        message: String,
        #[serde(default)]
        input: Option<Value>,
        #[serde(default)]
        suggestion: Option<String>,
        #[serde(default)]
        transient: bool,
        #[serde(default)]
        exit_code: i32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct StatsJson {
    pub file_count: usize,
    pub total_lines: usize,
    pub total_bytes: usize,
    pub truncated_count: usize,
    pub skipped_count: usize,
    #[serde(default)]
    pub token_estimate: Option<usize>,
    pub duration_ms: u64,
}

impl StatsJson {
    pub fn new(file_count: usize) -> Self {
        Self {
            file_count,
            total_lines: 0,
            total_bytes: 0,
            truncated_count: 0,
            skipped_count: 0,
            token_estimate: None,
            duration_ms: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct FileError {
    pub path: String,
    pub code: String,
    pub message: String,
    #[serde(default)]
    pub transient: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct FileInfo {
    pub path: String,
    #[serde(default)]
    pub extension: String,
    pub size_bytes: u64,
    #[serde(default)]
    pub line_count: usize,
    #[serde(default)]
    pub truncated: bool,
    #[serde(default)]
    pub truncated_lines: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct ContextData {
    pub content: String,
    pub format: String,
    pub files: Vec<FileInfo>,
}

pub fn parse_pctx_response(output: &ProcessOutput) -> Result<PctxResponse, CommandError> {
    serde_json::from_slice(&output.stdout).map_err(|error| CommandError {
        code: "invalid_engine_response".into(),
        message: format!(
            "pctx returned invalid JSON (exit {}): {}. stderr: {}",
            output.exit_code,
            error,
            String::from_utf8_lossy(&output.stderr)
        ),
    })
}

pub fn invalid_data(error: serde_json::Error) -> CommandError {
    CommandError {
        code: "invalid_engine_response".into(),
        message: format!("pctx returned an unexpected data shape: {error}"),
    }
}
