use std::path::PathBuf;

use semver::{Version, VersionReq};
use tauri::{AppHandle, Manager};

use crate::commands::CommandError;
use crate::models::engine::{Capabilities, EngineSource, ResolvedEngine};

use super::runner::{run_process, PROBE_LIMIT};

#[derive(Debug, Clone)]
pub struct EngineCandidate {
    pub path: PathBuf,
    pub source: EngineSource,
}

pub fn bundled_engine_candidate(app: &AppHandle) -> Option<PathBuf> {
    let name = if cfg!(windows) { "pctx.exe" } else { "pctx" };

    let path = app
        .path()
        .resource_dir()
        .ok()?
        .join("resources")
        .join("bin")
        .join(name);

    path.is_file().then_some(path)
}

pub fn path_engine_candidate() -> Option<PathBuf> {
    which::which("pctx").ok()
}

/// Build the ordered candidate list: explicit startup flag, environment
/// variable, saved external path, bundled resource, then PATH.
pub fn discover_candidates(
    app: &AppHandle,
    explicit: Option<&PathBuf>,
    saved_external: Option<&PathBuf>,
) -> Vec<EngineCandidate> {
    let mut candidates = Vec::new();

    if let Some(path) = explicit {
        candidates.push(EngineCandidate {
            path: path.clone(),
            source: EngineSource::Explicit,
        });
    }

    if let Ok(value) = std::env::var("PCTX_BIN") {
        if !value.is_empty() {
            candidates.push(EngineCandidate {
                path: PathBuf::from(value),
                source: EngineSource::Environment,
            });
        }
    }

    if let Some(path) = saved_external {
        candidates.push(EngineCandidate {
            path: path.clone(),
            source: EngineSource::Saved,
        });
    }

    if let Some(path) = bundled_engine_candidate(app) {
        candidates.push(EngineCandidate {
            path,
            source: EngineSource::Bundled,
        });
    }

    if let Some(path) = path_engine_candidate() {
        candidates.push(EngineCandidate {
            path,
            source: EngineSource::Path,
        });
    }

    candidates
}

pub async fn probe_candidate(candidate: &EngineCandidate) -> Result<ResolvedEngine, CommandError> {
    let args = vec![
        std::ffi::OsString::from("--json"),
        std::ffi::OsString::from("--no-color"),
        std::ffi::OsString::from("capabilities"),
    ];

    let output = run_process(
        &candidate.path,
        &args,
        None,
        &[],
        tokio_util::sync::CancellationToken::new(),
        std::time::Duration::from_secs(10),
        PROBE_LIMIT,
        PROBE_LIMIT,
    )
    .await
    .map_err(CommandError::from)?;

    if output.exit_code != 0 {
        return Err(CommandError {
            code: "engine_probe_failed".into(),
            message: format!(
                "{} exited with {}: {}",
                candidate.path.display(),
                output.exit_code,
                String::from_utf8_lossy(&output.stderr)
            ),
        });
    }

    // Capabilities are a bare object, not the normal status envelope.
    let capabilities: Capabilities =
        serde_json::from_slice(&output.stdout).map_err(|error| CommandError {
            code: "invalid_capabilities".into(),
            message: format!(
                "{} returned invalid capabilities: {}",
                candidate.path.display(),
                error
            ),
        })?;

    Ok(ResolvedEngine {
        executable: candidate.path.clone(),
        source: candidate.source.clone(),
        capabilities,
    })
}

pub fn validate_capabilities(caps: &Capabilities) -> Result<(), String> {
    if caps.name != "pctx" {
        return Err(format!("unexpected engine name: {}", caps.name));
    }

    if caps.schema_version != 1 {
        return Err(format!(
            "unsupported capability schema version: {}",
            caps.schema_version
        ));
    }

    let version = Version::parse(&caps.version)
        .map_err(|e| format!("invalid pctx version '{}': {e}", caps.version))?;

    let supported = VersionReq::parse(">=1.1.0, <2.0.0").expect("valid version requirement");
    if !supported.matches(&version) {
        return Err(format!(
            "pctx {} is not supported; expected >=1.1.0, <2.0.0",
            version
        ));
    }

    if !caps.json_output || !caps.stdin0 || !caps.path_aliases {
        return Err(
            "pctx build lacks required json_output, stdin0, or path_aliases support".into(),
        );
    }

    Ok(())
}
