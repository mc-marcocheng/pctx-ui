use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EngineSource {
    Explicit,
    Environment,
    Saved,
    Bundled,
    Path,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedEngine {
    pub executable: PathBuf,
    pub source: EngineSource,
    pub capabilities: Capabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct Capabilities {
    pub schema_version: u32,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub clipboard: bool,
    #[serde(default)]
    pub tokens: bool,
    #[serde(default)]
    pub json_output: bool,
    #[serde(default)]
    pub stdin: bool,
    #[serde(default)]
    pub stdin0: bool,
    #[serde(default)]
    pub paths_file0: bool,
    #[serde(default)]
    pub path_aliases: bool,
    #[serde(default)]
    pub formats: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub executable: PathBuf,
    pub source: EngineSource,
    pub capabilities: Capabilities,
}

impl From<ResolvedEngine> for EngineStatus {
    fn from(value: ResolvedEngine) -> Self {
        Self {
            executable: value.executable,
            source: value.source,
            capabilities: value.capabilities,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EngineMode {
    Auto,
    Bundled,
    External,
}

impl Default for EngineMode {
    fn default() -> Self {
        Self::Auto
    }
}
