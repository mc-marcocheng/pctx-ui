import { create } from "zustand";
import type { ConfigSelection, DiscoveredFile, FilterSettings, OutputSettings, ScanRootResponse, TruncationSettings, WorkspaceSource } from "../api/types";
import { canonicalKey, chooseOwningSource } from "../utils/aliases";
import { createEmptyWorkspace, type Workspace } from "../utils/workspaceSchema";

export interface WorkspaceFileNode extends DiscoveredFile {
  sourceId: string;
  sourceAlias: string;
  displayPath: string;
}

interface WorkspaceState {
  workspace: Workspace;
  discoveredFiles: Record<string, WorkspaceFileNode>;
  missingSelectedPaths: string[];
  scanRevision: number;

  setWorkspace(workspace: Workspace): void;
  addSources(sources: WorkspaceSource[]): void;
  removeSource(sourceId: string): void;
  renameAlias(sourceId: string, alias: string): void;
  renameWorkspace(name: string): void;
  setTokenBudget(tokenBudget: number | undefined): void;
  setSelected(path: string, selected: boolean): void;
  setManySelected(paths: string[], selected: boolean): void;
  toggleSelected(path: string): void;
  replaceSelection(paths: string[]): void;
  clearSelection(): void;
  selectAll(): void;
  invertSelection(): void;
  applyScanResults(revision: number, results: ScanRootResponse[]): void;
  updateFilters(filters: Partial<FilterSettings>): void;
  updateTruncation(settings: Partial<TruncationSettings>): void;
  updateOutput(settings: Partial<OutputSettings>): void;
  setActiveConfig(config: ConfigSelection): void;
  beginScan(revision: number): number;
  removeMissingSelections(): void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspace: createEmptyWorkspace(crypto.randomUUID()),
  discoveredFiles: {},
  missingSelectedPaths: [],
  scanRevision: 0,

  setWorkspace: (workspace) => set({ workspace, discoveredFiles: {}, missingSelectedPaths: [] }),

  addSources: (sources) =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        sources: [...state.workspace.sources, ...sources],
      },
    })),

  removeSource: (sourceId) =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        sources: state.workspace.sources.filter((source) => source.id !== sourceId),
      },
    })),

  renameAlias: (sourceId, alias) =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        sources: state.workspace.sources.map((source) =>
          source.id === sourceId ? { ...source, alias } : source,
        ),
      },
    })),

  renameWorkspace: (name) =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        name: name.trim() || "Untitled workspace",
      },
    })),

  setTokenBudget: (tokenBudget) =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        tokenBudget:
          tokenBudget !== undefined &&
          Number.isInteger(tokenBudget) &&
          tokenBudget > 0
            ? tokenBudget
            : undefined,
      },
    })),

  setSelected: (path, selected) => {
    const key = canonicalKey(path);
    const current = new Set(get().workspace.selectedPaths.map(canonicalKey));

    if (selected) {
      current.add(key);
    } else {
      current.delete(key);
    }

    const byKey = new Map(get().workspace.selectedPaths.map((p) => [canonicalKey(p), p]));
    if (selected) byKey.set(key, path);

    set((state) => ({
      workspace: {
        ...state.workspace,
        selectedPaths: [...current].map((k) => byKey.get(k) ?? k),
      },
    }));
  },

  setManySelected: (paths, selected) => {
    const keys = paths.map(canonicalKey);
    const current = new Set(get().workspace.selectedPaths.map(canonicalKey));
    const byKey = new Map(get().workspace.selectedPaths.map((p) => [canonicalKey(p), p]));

    for (const [index, key] of keys.entries()) {
      if (selected) {
        current.add(key);
        byKey.set(key, paths[index]);
      } else {
        current.delete(key);
      }
    }

    set((state) => ({
      workspace: {
        ...state.workspace,
        selectedPaths: [...current].map((k) => byKey.get(k) ?? k),
      },
    }));
  },

  toggleSelected: (path) => {
    const key = canonicalKey(path);
    const isSelected = get().workspace.selectedPaths.some((p) => canonicalKey(p) === key);
    get().setSelected(path, !isSelected);
  },

  replaceSelection: (paths) =>
    set((state) => ({ workspace: { ...state.workspace, selectedPaths: paths } })),

  clearSelection: () => set((state) => ({ workspace: { ...state.workspace, selectedPaths: [] } })),

  selectAll: () =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        selectedPaths: Object.values(state.discoveredFiles).map((f) => f.canonicalPath),
      },
    })),

  invertSelection: () =>
    set((state) => {
      const selected = new Set(state.workspace.selectedPaths.map(canonicalKey));
      const inverted = Object.values(state.discoveredFiles)
        .filter((f) => !selected.has(canonicalKey(f.canonicalPath)))
        .map((f) => f.canonicalPath);
      return { workspace: { ...state.workspace, selectedPaths: inverted } };
    }),

  beginScan: (revision) => {
    set({ scanRevision: revision });
    return revision;
  },

  applyScanResults: (revision, results) => {
    if (get().scanRevision !== revision) return;

    const { workspace } = get();
    const discoveredFiles: Record<string, WorkspaceFileNode> = {};

    for (const result of results) {
      for (const file of result.files) {
        const key = canonicalKey(file.canonicalPath);
        if (discoveredFiles[key]) continue;

        const owner = chooseOwningSource(file.canonicalPath, workspace.sources);
        const alias = owner?.alias ?? "unknown";

        discoveredFiles[key] = {
          ...file,
          sourceId: owner?.id ?? result.rootId,
          sourceAlias: alias,
          displayPath: `${alias}/${file.relativePath}`.replace(/\\/g, "/"),
        };
      }
    }

    // Selections are preserved verbatim; missing files are only flagged, not
    // removed, until the user explicitly confirms a bulk cleanup.
    const missing = workspace.selectedPaths.filter(
      (path) => discoveredFiles[canonicalKey(path)] === undefined,
    );

    set({ discoveredFiles, missingSelectedPaths: missing });
  },

  removeMissingSelections: () =>
    set((state) => {
      const missing = new Set(state.missingSelectedPaths.map(canonicalKey));
      return {
        missingSelectedPaths: [],
        workspace: {
          ...state.workspace,
          selectedPaths: state.workspace.selectedPaths.filter(
            (path) => !missing.has(canonicalKey(path)),
          ),
        },
      };
    }),

  updateFilters: (filters) =>
    set((state) => ({
      workspace: { ...state.workspace, filters: { ...state.workspace.filters, ...filters } },
    })),

  updateTruncation: (settings) =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        truncation: { ...state.workspace.truncation, ...settings },
      },
    })),

  updateOutput: (settings) =>
    set((state) => ({
      workspace: { ...state.workspace, output: { ...state.workspace.output, ...settings } },
    })),

  setActiveConfig: (config) =>
    set((state) => ({ workspace: { ...state.workspace, activeConfig: config } })),
}));
