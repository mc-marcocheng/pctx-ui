use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFile {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub sources: Vec<WorkspaceSource>,
    pub selected_paths: Vec<PathBuf>,
    pub active_config: ConfigSelection,
    pub filters: FilterSettings,
    pub truncation: TruncationSettings,
    pub output: OutputSettings,
    pub token_budget: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum WorkspaceSource {
    Directory {
        id: String,
        path: PathBuf,
        alias: String,
    },
    File {
        id: String,
        path: PathBuf,
        alias: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "mode", content = "path", rename_all = "snake_case")]
pub enum ConfigSelection {
    None,
    File(PathBuf),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterSettings {
    pub exclude: Vec<String>,
    pub include: Vec<String>,
    pub hidden: bool,
    pub no_default_excludes: bool,
    pub no_gitignore: bool,
    pub max_size_kb: u64,
    pub max_depth: usize,
}

impl Default for FilterSettings {
    fn default() -> Self {
        Self {
            exclude: Vec::new(),
            include: Vec::new(),
            hidden: false,
            no_default_excludes: false,
            no_gitignore: false,
            max_size_kb: 1024,
            max_depth: 64,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TruncationSettings {
    pub disabled: bool,
    pub max_lines: usize,
    pub head_lines: usize,
    pub tail_lines: usize,
    pub max_line_length: usize,
    pub head_chars: usize,
    pub tail_chars: usize,
}

impl Default for TruncationSettings {
    fn default() -> Self {
        Self {
            disabled: false,
            max_lines: 500,
            head_lines: 20,
            tail_lines: 10,
            max_line_length: 500,
            head_chars: 200,
            tail_chars: 100,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputSettings {
    pub format: OutputFormat,
    pub tree: bool,
    pub absolute_paths: bool,
    pub token_model: String,
}

impl Default for OutputSettings {
    fn default() -> Self {
        Self {
            format: OutputFormat::Markdown,
            tree: false,
            absolute_paths: false,
            token_model: "cl100k_base".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OutputFormat {
    Markdown,
    Xml,
    Plain,
}

impl OutputFormat {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Markdown => "markdown",
            Self::Xml => "xml",
            Self::Plain => "plain",
        }
    }
}
