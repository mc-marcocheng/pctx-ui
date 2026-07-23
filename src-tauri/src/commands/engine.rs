use crate::engine::discovery::{discover_candidates, probe_candidate, validate_capabilities};
use crate::models::engine::EngineStatus;
use crate::models::settings::AppSettings;
use crate::persistence;

use super::CommandError;

#[tauri::command]
pub async fn get_app_settings(app: tauri::AppHandle) -> Result<AppSettings, CommandError> {
    persistence::load_app_settings(&app)
}

#[tauri::command]
pub async fn probe_engine(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::app::ManagedAppState>,
) -> Result<EngineStatus, CommandError> {
    let saved_external = {
        let mut guard = state.saved_external_engine.write().await;
        if guard.is_none() {
            *guard = persistence::load_app_settings(&app)
                .ok()
                .and_then(|settings| settings.external_engine);
        }
        guard.clone()
    };

    let candidates = discover_candidates(&app, None, saved_external.as_ref());

    let mut failures = Vec::new();

    for candidate in candidates {
        match probe_candidate(&candidate).await {
            Ok(resolved) => {
                if let Err(message) = validate_capabilities(&resolved.capabilities) {
                    failures.push(format!("{}: {}", candidate.path.display(), message));
                    continue;
                }

                *state.engine.write().await = Some(resolved.clone());
                return Ok(EngineStatus::from(resolved));
            }
            Err(error) => failures.push(error.to_string()),
        }
    }

    Err(CommandError {
        code: "engine_not_found".into(),
        message: if failures.is_empty() {
            "No pctx executable was found".into()
        } else {
            format!(
                "No compatible pctx executable was found:\n{}",
                failures.join("\n")
            )
        },
    })
}

#[tauri::command]
pub async fn set_external_engine(
    app: tauri::AppHandle,
    path: std::path::PathBuf,
    state: tauri::State<'_, crate::app::ManagedAppState>,
) -> Result<EngineStatus, CommandError> {
    let candidate = crate::engine::discovery::EngineCandidate {
        path: path.clone(),
        source: crate::models::engine::EngineSource::Explicit,
    };

    let resolved = probe_candidate(&candidate).await?;

    validate_capabilities(&resolved.capabilities).map_err(|message| CommandError {
        code: "incompatible_engine".into(),
        message,
    })?;

    *state.saved_external_engine.write().await = Some(path.clone());
    *state.engine.write().await = Some(resolved.clone());

    let mut settings = persistence::load_app_settings(&app)?;
    settings.external_engine = Some(path);
    persistence::save_app_settings(&app, &settings)?;

    Ok(EngineStatus::from(resolved))
}

#[tauri::command]
pub async fn reset_external_engine(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::app::ManagedAppState>,
) -> Result<(), CommandError> {
    *state.saved_external_engine.write().await = None;

    let mut settings = persistence::load_app_settings(&app)?;
    settings.external_engine = None;
    persistence::save_app_settings(&app, &settings)?;

    Ok(())
}

#[tauri::command]
pub async fn cancel_operation(
    operation_id: String,
    state: tauri::State<'_, crate::app::ManagedAppState>,
) -> Result<(), CommandError> {
    if let Some(token) = state.operations.get(&operation_id) {
        token.cancel();
    }

    Ok(())
}
