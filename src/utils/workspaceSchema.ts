import type {
  ConfigSelection,
  FilterSettings,
  OutputSettings,
  TruncationSettings,
  WorkspaceFile,
  WorkspaceSource,
} from "../api/types";
import { workspaceSchema } from "../api/schemas";
import { parentPath } from "./aliases";

export interface Workspace {
  schemaVersion: 1;
  id: string;
  name: string;
  sources: WorkspaceSource[];
  selectedPaths: string[];
  activeConfig: ConfigSelection;
  filters: FilterSettings;
  truncation: TruncationSettings;
  output: OutputSettings;
  tokenBudget?: number;
}

export const defaultFilterSettings: FilterSettings = {
  exclude: [],
  include: [],
  hidden: false,
  noDefaultExcludes: false,
  noGitignore: false,
  maxSizeKb: 1024,
  maxDepth: 64,
};

export const defaultTruncationSettings: TruncationSettings = {
  disabled: false,
  maxLines: 500,
  headLines: 20,
  tailLines: 10,
  maxLineLength: 500,
  headChars: 200,
  tailChars: 100,
};

export const defaultOutputSettings: OutputSettings = {
  format: "markdown",
  tree: false,
  absolutePaths: false,
  tokenModel: "cl100k_base",
};

export function createEmptyWorkspace(id: string, name = "Untitled workspace"): Workspace {
  return {
    schemaVersion: 1,
    id,
    name,
    sources: [],
    selectedPaths: [],
    activeConfig: { mode: "none" },
    filters: { ...defaultFilterSettings },
    truncation: { ...defaultTruncationSettings },
    output: { ...defaultOutputSettings },
  };
}

export function workspaceToFile(workspace: Workspace): WorkspaceFile {
  return { ...workspace, schemaVersion: workspace.schemaVersion };
}

export function workspaceFromFile(file: WorkspaceFile): Workspace {
  return { ...file, schemaVersion: 1 };
}

/**
 * Defense-in-depth shape validation for workspace files crossing an
 * untrusted boundary (shared *.pctx-workspace.json imports, --workspace CLI
 * flag). The Rust side already rejects unsupported schema versions; this
 * catches malformed/truncated field shapes before they reach app state.
 */
export function parseWorkspaceFile(file: WorkspaceFile): Workspace {
  const result = workspaceSchema.safeParse(file);
  if (!result.success) {
    throw new Error(`Invalid workspace file: ${result.error.issues[0]?.message ?? "unknown error"}`);
  }
  return workspaceFromFile(file);
}

function sorted<T>(items: T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => key(a).localeCompare(key(b)));
}

export function generationFingerprint(workspace: Workspace): string {
  return JSON.stringify({
    selectedPaths: [...workspace.selectedPaths].sort(),
    aliases: sorted(
      workspace.sources.map((source) => ({
        alias: source.alias,
        root: source.kind === "directory" ? source.path : parentPath(source.path),
      })),
      (entry) => `${entry.alias}\0${entry.root}`,
    ),
    maxSizeKb: workspace.filters.maxSizeKb,
    truncation: workspace.truncation,
    output: workspace.output,
  });
}
