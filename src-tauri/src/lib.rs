pub mod app;
pub mod cli;
pub mod commands;
pub mod engine;
pub mod models;
pub mod persistence;

use std::sync::Arc;

use tauri::Manager;

#[tauri::command]
fn get_startup_resolution(
    startup: tauri::State<'_, cli::StartupResolution>,
) -> Result<cli::StartupResolution, ()> {
    Ok(startup.inner().clone())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let startup_cli = cli::StartupCli::parse_lenient();
    let startup_resolution = cli::resolve_startup(&startup_cli);

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(app::AppState::default()))
        .manage(startup_resolution)
        .setup(move |app| {
            if let Some(bin) = &startup_cli.pctx_bin {
                let state = app.state::<app::ManagedAppState>();
                let bin = bin.clone();
                tauri::async_runtime::block_on(async {
                    *state.saved_external_engine.write().await = Some(bin);
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::engine::probe_engine,
            commands::engine::set_external_engine,
            commands::engine::reset_external_engine,
            commands::engine::cancel_operation,
            commands::engine::get_app_settings,
            commands::scan::scan_root,
            commands::generate::generate_context,
            commands::config::load_engine_config,
            commands::config::get_default_excludes,
            commands::config::find_config_candidates,
            commands::config::config_init,
            commands::workspace::canonicalize_sources,
            commands::workspace::save_workspace,
            commands::workspace::load_workspace,
            commands::workspace::list_recent_workspaces,
            commands::workspace::import_workspace_file,
            commands::workspace::export_workspace_file,
            commands::diagnostics::get_diagnostics,
            get_startup_resolution,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
