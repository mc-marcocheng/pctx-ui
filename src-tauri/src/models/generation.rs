use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub use super::workspace::{ConfigSelection, OutputFormat, TruncationSettings};
use super::workspace::FilterSettings;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRootRequest {
    pub operation_id: String,
    pub root_id: String,
    pub root: PathBuf,
    #[serde(default)]
    pub config: ConfigSelection,
    pub filters: FilterSettings,
}

impl Default for ConfigSelection {
    fn default() -> Self {
        Self::None
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateRequest {
    pub operation_id: String,
    pub selected_paths: Vec<PathBuf>,
    #[serde(default)]
    pub aliases: Vec<PathAliasRequest>,
    pub filters: FinalFilterSettings,
    pub truncation: TruncationSettings,
    pub output: OutputSettings,
    pub destination: GenerationDestination,
    pub timeout_seconds: Option<u64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathAliasRequest {
    pub alias: String,
    pub root: PathBuf,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FinalFilterSettings {
    pub max_size_kb: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputSettings {
    pub format: OutputFormat,
    pub tree: bool,
    pub absolute_paths: bool,
    pub token_model: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum GenerationDestination {
    Preview,
    Clipboard,
    File { path: PathBuf, force: bool },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRootResponse {
    pub root_id: String,
    pub root: PathBuf,
    pub files: Vec<DiscoveredFile>,
    pub errors: Vec<crate::engine::protocol::FileError>,
    pub stats: crate::engine::protocol::StatsJson,
    pub exit_code: i32,
    pub stderr: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredFile {
    pub canonical_path: PathBuf,
    pub relative_path: String,
    pub extension: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateResponse {
    pub status: GenerationStatus,
    pub context: Option<crate::engine::protocol::ContextData>,
    pub stats: crate::engine::protocol::StatsJson,
    pub errors: Vec<crate::engine::protocol::FileError>,
    pub exit_code: i32,
    pub stderr: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GenerationStatus {
    Success,
    Partial,
    Error,
}
