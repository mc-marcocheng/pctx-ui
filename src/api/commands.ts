import { invoke } from "@tauri-apps/api/core";
import type {
  AppSettings,
  CanonicalSource,
  ConfigInitRequest,
  ConfigInitResponse,
  DiagnosticsSnapshot,
  EngineStatus,
  GenerateRequest,
  GenerateResponse,
  LoadConfigRequest,
  RecentWorkspaceEntry,
  ResolvedConfigResponse,
  ScanRootRequest,
  ScanRootResponse,
  StartupResolution,
  WorkspaceFile,
  WorkspaceImportResult,
} from "./types";

export async function probeEngine(): Promise<EngineStatus> {
  return invoke<EngineStatus>("probe_engine");
}

export async function setExternalEngine(path: string): Promise<EngineStatus> {
  return invoke<EngineStatus>("set_external_engine", { path });
}

export async function scanRoot(request: ScanRootRequest): Promise<ScanRootResponse> {
  return invoke<ScanRootResponse>("scan_root", { request });
}

export async function generateContext(request: GenerateRequest): Promise<GenerateResponse> {
  return invoke<GenerateResponse>("generate_context", { request });
}

export async function cancelOperation(operationId: string): Promise<void> {
  await invoke("cancel_operation", { operationId });
}

export async function canonicalizeSources(paths: string[]): Promise<CanonicalSource[]> {
  return invoke<CanonicalSource[]>("canonicalize_sources", { request: { paths } });
}

export async function loadEngineConfig(
  request: LoadConfigRequest,
): Promise<ResolvedConfigResponse> {
  return invoke<ResolvedConfigResponse>("load_engine_config", { request });
}

export async function getDefaultExcludes(): Promise<unknown> {
  return invoke("get_default_excludes");
}

export async function resetExternalEngine(): Promise<void> {
  await invoke("reset_external_engine");
}

export async function getAppSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_app_settings");
}

export async function findConfigCandidates(paths: string[]): Promise<string[]> {
  return invoke<string[]>("find_config_candidates", { paths });
}

export async function configInit(request: ConfigInitRequest): Promise<ConfigInitResponse> {
  return invoke<ConfigInitResponse>("config_init", { request });
}

export async function saveWorkspace(workspace: WorkspaceFile): Promise<string> {
  return invoke<string>("save_workspace", { workspace });
}

export async function loadWorkspace(id: string): Promise<WorkspaceFile> {
  return invoke<WorkspaceFile>("load_workspace", { id });
}

export async function listRecentWorkspaces(): Promise<RecentWorkspaceEntry[]> {
  return invoke<RecentWorkspaceEntry[]>("list_recent_workspaces");
}

export async function importWorkspaceFile(path: string): Promise<WorkspaceImportResult> {
  return invoke<WorkspaceImportResult>("import_workspace_file", { path });
}

export async function exportWorkspaceFile(
  path: string,
  workspace: WorkspaceFile,
): Promise<void> {
  await invoke("export_workspace_file", { path, workspace });
}

export async function getDiagnostics(): Promise<DiagnosticsSnapshot> {
  return invoke<DiagnosticsSnapshot>("get_diagnostics");
}

export async function getStartupResolution(): Promise<StartupResolution> {
  return invoke<StartupResolution>("get_startup_resolution");
}

export class InvokeError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function normalizeInvokeError(error: unknown): InvokeError {
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    const value = error as { code: string; message: string };
    return new InvokeError(value.code, value.message);
  }

  return new InvokeError("unknown", String(error));
}
