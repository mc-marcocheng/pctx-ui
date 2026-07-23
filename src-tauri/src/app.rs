use dashmap::DashMap;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

use crate::models::engine::ResolvedEngine;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastOperation {
    pub kind: String,
    pub exit_code: i32,
    pub stderr: String,
    pub at_millis: u128,
}

pub struct AppState {
    pub engine: tokio::sync::RwLock<Option<ResolvedEngine>>,
    pub operations: DashMap<String, CancellationToken>,
    pub saved_external_engine: tokio::sync::RwLock<Option<std::path::PathBuf>>,
    pub last_operation: tokio::sync::RwLock<Option<LastOperation>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            engine: tokio::sync::RwLock::new(None),
            operations: DashMap::new(),
            saved_external_engine: tokio::sync::RwLock::new(None),
            last_operation: tokio::sync::RwLock::new(None),
        }
    }
}

impl AppState {
    pub async fn record_operation(&self, kind: &str, exit_code: i32, stderr: &str) {
        let at_millis = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);

        *self.last_operation.write().await = Some(LastOperation {
            kind: kind.to_string(),
            exit_code,
            stderr: stderr.chars().take(4096).collect(),
            at_millis,
        });
    }
}

pub type ManagedAppState = Arc<AppState>;
