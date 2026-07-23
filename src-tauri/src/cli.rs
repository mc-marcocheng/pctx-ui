use clap::{Parser, ValueEnum};
use std::path::PathBuf;

#[derive(Debug, Parser)]
#[command(name = "pctx-ui", version, about = "Desktop interface for pctx")]
pub struct StartupCli {
    /// Files or directories to add to the initial workspace
    pub paths: Vec<PathBuf>,

    /// Use a specific pctx executable
    #[arg(long, value_name = "PATH")]
    pub pctx_bin: Option<PathBuf>,

    /// Engine resolution mode
    #[arg(long, value_enum, default_value = "auto")]
    pub engine: StartupEngineMode,

    /// Load a saved profile
    #[arg(long)]
    pub profile: Option<String>,

    /// Open a workspace definition
    #[arg(long, value_name = "FILE")]
    pub workspace: Option<PathBuf>,

    /// Do not restore the previous workspace
    #[arg(long)]
    pub no_restore: bool,

    /// Enable diagnostics
    #[arg(long)]
    pub diagnostics: bool,

    /// Accepted for future single-instance support
    #[arg(long)]
    pub new_window: bool,
}

#[derive(Debug, Clone, ValueEnum)]
pub enum StartupEngineMode {
    Auto,
    Bundled,
    External,
}

impl StartupCli {
    /// Parses CLI args, tolerating the extra leading argument Tauri/webview
    /// runtimes sometimes pass through on some platforms, and never panics
    /// on unrecognized dev-tooling flags so the app can still launch.
    pub fn parse_lenient() -> Self {
        Self::try_parse().unwrap_or_else(|_| Self {
            paths: Vec::new(),
            pctx_bin: None,
            engine: StartupEngineMode::Auto,
            profile: None,
            workspace: None,
            no_restore: false,
            diagnostics: false,
            new_window: false,
        })
    }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupResolution {
    pub workspace_file: Option<PathBuf>,
    pub initial_paths: Vec<PathBuf>,
    pub restore_last: bool,
    pub diagnostics_enabled: bool,
}

/// Startup resolution order per plan section 31: an explicit `--workspace`
/// file wins, then positional paths seed a fresh temporary workspace,
/// otherwise the last workspace is restored unless `--no-restore`.
pub fn resolve_startup(cli: &StartupCli) -> StartupResolution {
    StartupResolution {
        workspace_file: cli.workspace.clone(),
        initial_paths: if cli.workspace.is_none() {
            cli.paths.clone()
        } else {
            Vec::new()
        },
        restore_last: cli.workspace.is_none() && cli.paths.is_empty() && !cli.no_restore,
        diagnostics_enabled: cli.diagnostics,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_cli() -> StartupCli {
        StartupCli {
            paths: Vec::new(),
            pctx_bin: None,
            engine: StartupEngineMode::Auto,
            profile: None,
            workspace: None,
            no_restore: false,
            diagnostics: false,
            new_window: false,
        }
    }

    #[test]
    fn no_args_restores_last_workspace() {
        let resolution = resolve_startup(&base_cli());

        assert_eq!(resolution.workspace_file, None);
        assert!(resolution.initial_paths.is_empty());
        assert!(resolution.restore_last);
    }

    #[test]
    fn no_restore_flag_disables_restoration() {
        let cli = StartupCli { no_restore: true, ..base_cli() };
        let resolution = resolve_startup(&cli);

        assert!(!resolution.restore_last);
        assert!(resolution.initial_paths.is_empty());
    }

    #[test]
    fn positional_paths_seed_initial_workspace_and_skip_restore() {
        let cli = StartupCli {
            paths: vec![PathBuf::from("a"), PathBuf::from("b")],
            ..base_cli()
        };
        let resolution = resolve_startup(&cli);

        assert_eq!(resolution.initial_paths, vec![PathBuf::from("a"), PathBuf::from("b")]);
        assert!(!resolution.restore_last);
        assert_eq!(resolution.workspace_file, None);
    }

    #[test]
    fn explicit_workspace_file_wins_over_positional_paths() {
        let cli = StartupCli {
            paths: vec![PathBuf::from("a")],
            workspace: Some(PathBuf::from("shared.pctx-workspace.json")),
            ..base_cli()
        };
        let resolution = resolve_startup(&cli);

        assert_eq!(resolution.workspace_file, Some(PathBuf::from("shared.pctx-workspace.json")));
        assert!(resolution.initial_paths.is_empty());
        assert!(!resolution.restore_last);
    }

    #[test]
    fn diagnostics_flag_passes_through() {
        let cli = StartupCli { diagnostics: true, ..base_cli() };
        assert!(resolve_startup(&cli).diagnostics_enabled);
    }
}
