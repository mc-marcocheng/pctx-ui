//! Real-engine contract tests (plan section 40.3). Requires the `pctx`
//! binary to be built at `../../pctx/target/release/pctx[.exe]` relative to
//! this crate, or `PCTX_BIN` to point at an alternative build.

use pctx_ui_lib::engine::args::{build_generate_args, build_scan_args};
use pctx_ui_lib::engine::discovery::validate_capabilities;
use pctx_ui_lib::engine::protocol::{parse_pctx_response, PctxResponse};
use pctx_ui_lib::engine::runner::{run_process, DISCOVERY_STDOUT_LIMIT, PREVIEW_STDOUT_LIMIT, STDERR_LIMIT};
use pctx_ui_lib::models::engine::Capabilities;
use pctx_ui_lib::models::generation::{
    ConfigSelection, FinalFilterSettings, GenerateRequest, GenerationDestination, OutputSettings,
    ScanRootRequest,
};
use pctx_ui_lib::models::workspace::{FilterSettings, OutputFormat, TruncationSettings};

fn pctx_bin() -> std::path::PathBuf {
    if let Ok(value) = std::env::var("PCTX_BIN") {
        return std::path::PathBuf::from(value);
    }

    let name = if cfg!(windows) { "pctx.exe" } else { "pctx" };
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("pctx")
        .join("target")
        .join("release")
        .join(name)
}

fn require_engine() -> std::path::PathBuf {
    let path = pctx_bin();
    if !path.is_file() {
        panic!(
            "pctx engine not found at {} — build it with `cargo build --release` in ../pctx",
            path.display()
        );
    }
    path
}

#[tokio::test]
async fn capabilities_are_compatible() {
    let engine = require_engine();

    let output = run_process(
        &engine,
        &[
            "--json".into(),
            "--no-color".into(),
            "capabilities".into(),
        ],
        None,
        &[],
        tokio_util::sync::CancellationToken::new(),
        std::time::Duration::from_secs(10),
        1024 * 1024,
        1024 * 1024,
    )
    .await
    .unwrap();

    assert_eq!(output.exit_code, 0);

    let capabilities: Capabilities = serde_json::from_slice(&output.stdout).unwrap();
    validate_capabilities(&capabilities).expect("capabilities should be compatible");
    assert!(capabilities.json_output);
    assert!(capabilities.stdin0);
    assert!(capabilities.path_aliases);
}

#[tokio::test]
async fn files_list_scans_a_temporary_root() {
    let engine = require_engine();

    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("a.txt"), b"hello").unwrap();
    std::fs::write(dir.path().join("b.txt"), b"world").unwrap();

    let request = ScanRootRequest {
        operation_id: "contract-scan".into(),
        root_id: "root".into(),
        root: dir.path().to_path_buf(),
        config: ConfigSelection::None,
        filters: FilterSettings::default(),
    };

    let args = build_scan_args(&request);

    let output = run_process(
        &engine,
        &args,
        Some(dir.path()),
        &[],
        tokio_util::sync::CancellationToken::new(),
        std::time::Duration::from_secs(30),
        DISCOVERY_STDOUT_LIMIT,
        STDERR_LIMIT,
    )
    .await
    .unwrap();

    let response = parse_pctx_response(&output).unwrap();
    match response {
        PctxResponse::Success { data, .. } => {
            let items = data.as_array().expect("files list returns an array");
            assert_eq!(items.len(), 2);
        }
        other => panic!("expected success response, got {other:?}"),
    }
}

#[tokio::test]
async fn generate_from_stdin0_produces_markdown_context() {
    let engine = require_engine();

    let dir = tempfile::tempdir().unwrap();
    let file_path = dir.path().join("main.rs");
    std::fs::write(&file_path, "fn main() {}\n").unwrap();

    let canonical = dunce::canonicalize(&file_path).unwrap();
    let root = dunce::canonicalize(dir.path()).unwrap();

    let request = GenerateRequest {
        operation_id: "contract-generate".into(),
        selected_paths: vec![canonical.clone()],
        aliases: vec![pctx_ui_lib::models::generation::PathAliasRequest {
            alias: "root".into(),
            root: root.clone(),
        }],
        filters: FinalFilterSettings { max_size_kb: 1024 },
        truncation: TruncationSettings::default(),
        output: OutputSettings {
            format: OutputFormat::Markdown,
            tree: false,
            absolute_paths: false,
            token_model: "cl100k_base".into(),
        },
        destination: GenerationDestination::Preview,
        timeout_seconds: None,
    };

    let args = build_generate_args(&request).unwrap();
    let stdin = pctx_ui_lib::commands::generate::encode_stdin0(&request.selected_paths).unwrap();

    let output = run_process(
        &engine,
        &args,
        Some(&root),
        &stdin,
        tokio_util::sync::CancellationToken::new(),
        std::time::Duration::from_secs(30),
        PREVIEW_STDOUT_LIMIT,
        STDERR_LIMIT,
    )
    .await
    .unwrap();

    let response = parse_pctx_response(&output).unwrap();
    match response {
        PctxResponse::Success { data, .. } => {
            let content = data
                .get("content")
                .and_then(|v| v.as_str())
                .expect("context has content");
            assert!(content.contains("fn main"));
        }
        other => panic!("expected success response, got {other:?}"),
    }
}

#[tokio::test]
async fn config_show_returns_json_without_config() {
    let engine = require_engine();
    let dir = tempfile::tempdir().unwrap();

    let output = run_process(
        &engine,
        &[
            "--json".into(),
            "--no-color".into(),
            "--no-config".into(),
            "config".into(),
            "show".into(),
        ],
        Some(dir.path()),
        &[],
        tokio_util::sync::CancellationToken::new(),
        std::time::Duration::from_secs(10),
        1024 * 1024,
        1024 * 1024,
    )
    .await
    .unwrap();

    assert_eq!(output.exit_code, 0);
    let _value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
}
