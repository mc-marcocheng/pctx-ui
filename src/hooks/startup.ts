import {
  canonicalizeSources,
  getStartupResolution,
  importWorkspaceFile,
  listRecentWorkspaces,
  loadWorkspace,
  normalizeInvokeError,
} from "../api/commands";
import type { WorkspaceSource } from "../api/types";
import { usePreviewStore } from "../state/previewStore";
import { useSettingsStore } from "../state/settingsStore";
import { useWorkspaceStore } from "../state/workspaceStore";
import { makeUniqueAlias, suggestedAlias } from "../utils/aliases";
import { parseWorkspaceFile, workspaceFromFile } from "../utils/workspaceSchema";
import { scanWorkspace } from "./scanActions";

/**
 * Resolution order mirrors StartupCli/resolve_startup in the Rust backend
 * (plan section 31): an explicit workspace file wins, then positional paths
 * seed a fresh workspace, otherwise the last workspace is restored.
 */
export async function runStartupBootstrap(): Promise<{ message?: string }> {
  const resolution = await getStartupResolution();
  useSettingsStore.getState().setDiagnosticsAutoOpen(resolution.diagnosticsEnabled);

  try {
    if (resolution.workspaceFile) {
      const result = await importWorkspaceFile(resolution.workspaceFile);
      useWorkspaceStore.getState().setWorkspace(parseWorkspaceFile(result.workspace));
      usePreviewStore.getState().markStale();
      await scanWorkspace();

      return result.missingSourceIds.length > 0
        ? { message: `Opened workspace with ${result.missingSourceIds.length} missing source(s).` }
        : {};
    }

    if (resolution.initialPaths.length > 0) {
      const canonical = await canonicalizeSources(resolution.initialPaths);
      const store = useWorkspaceStore.getState();
      const existingAliases = store.workspace.sources.map((source) => source.alias);
      const sources: WorkspaceSource[] = [];

      for (const entry of canonical) {
        if (!entry.isFile && !entry.isDirectory) continue;

        const alias = makeUniqueAlias(suggestedAlias(entry.canonical), existingAliases);
        existingAliases.push(alias);
        sources.push({
          kind: entry.isDirectory ? "directory" : "file",
          id: crypto.randomUUID(),
          path: entry.canonical,
          alias,
        });
      }

      if (sources.length === 0) return {};

      store.addSources(sources);
      usePreviewStore.getState().markStale();
      await scanWorkspace();
      return {};
    }

    if (resolution.restoreLast) {
      const recent = await listRecentWorkspaces();
      if (recent.length > 0) {
        const file = await loadWorkspace(recent[0].id);
        useWorkspaceStore.getState().setWorkspace(workspaceFromFile(file));
        usePreviewStore.getState().clear();
        await scanWorkspace();
      }
    }

    return {};
  } catch (error) {
    return { message: normalizeInvokeError(error).message };
  }
}
