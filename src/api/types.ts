export interface CommandError {
  code: string;
  message: string;
}

export interface Capabilities {
  schemaVersion: number;
  name: string;
  version: string;
  clipboard: boolean;
  tokens: boolean;
  jsonOutput: boolean;
  stdin: boolean;
  stdin0: boolean;
  pathsFile0: boolean;
  pathAliases: boolean;
  formats: string[];
}

export type EngineSource = "explicit" | "environment" | "saved" | "bundled" | "path";

export interface EngineStatus {
  executable: string;
  source: EngineSource;
  capabilities: Capabilities;
}

export interface FileError {
  path: string;
  code: string;
  message: string;
  transient: boolean;
}

export interface Stats {
  fileCount: number;
  totalLines: number;
  totalBytes: number;
  truncatedCount: number;
  skippedCount: number;
  tokenEstimate?: number;
  durationMs: number;
}

export type OutputFormat = "markdown" | "xml" | "plain";

export interface ContextFile {
  path: string;
  extension: string;
  sizeBytes: number;
  lineCount?: number;
  truncated: boolean;
  truncatedLines?: number;
}

export interface ContextData {
  content: string;
  format: OutputFormat;
  files: ContextFile[];
}

export type GenerationStatus = "success" | "partial" | "error";

export interface GenerateResponse {
  status: GenerationStatus;
  context?: ContextData;
  stats: Stats;
  errors: FileError[];
  exitCode: number;
  stderr: string;
}

export interface DiscoveredFile {
  canonicalPath: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
}

export interface ScanRootResponse {
  rootId: string;
  root: string;
  files: DiscoveredFile[];
  errors: FileError[];
  stats: Stats;
  exitCode: number;
  stderr: string;
}

export type ConfigSelection = { mode: "none" } | { mode: "file"; path: string };

export interface FilterSettings {
  exclude: string[];
  include: string[];
  hidden: boolean;
  noDefaultExcludes: boolean;
  noGitignore: boolean;
  maxSizeKb: number;
  maxDepth: number;
}

export interface TruncationSettings {
  disabled: boolean;
  maxLines: number;
  headLines: number;
  tailLines: number;
  maxLineLength: number;
  headChars: number;
  tailChars: number;
}

export interface OutputSettings {
  format: OutputFormat;
  tree: boolean;
  absolutePaths: boolean;
  tokenModel: string;
}

export type WorkspaceSource =
  | { kind: "directory"; id: string; path: string; alias: string }
  | { kind: "file"; id: string; path: string; alias: string };

export interface ScanRootRequest {
  operationId: string;
  rootId: string;
  root: string;
  config: ConfigSelection;
  filters: FilterSettings;
}

export interface PathAliasRequest {
  alias: string;
  root: string;
}

export type GenerationDestination =
  | { kind: "preview" }
  | { kind: "clipboard" }
  | { kind: "file"; path: string; force: boolean };

export interface GenerateRequest {
  operationId: string;
  selectedPaths: string[];
  aliases: PathAliasRequest[];
  filters: { maxSizeKb: number };
  truncation: TruncationSettings;
  output: OutputSettings;
  destination: GenerationDestination;
  timeoutSeconds?: number;
}

export interface CanonicalSource {
  input: string;
  canonical: string;
  isFile: boolean;
  isDirectory: boolean;
}

export interface LoadConfigRequest {
  operationId: string;
  config: ConfigSelection;
  cwd: string;
}

export interface ResolvedConfigResponse {
  raw: unknown;
  stderr: string;
}

export interface ConfigInitRequest {
  operationId: string;
  targetDir: string;
  force: boolean;
}

export interface ConfigInitResponse {
  path: string;
  stderr: string;
}

export interface WorkspaceFile {
  schemaVersion: number;
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

export interface WorkspaceImportResult {
  workspace: WorkspaceFile;
  missingSourceIds: string[];
}

export interface RecentWorkspaceEntry {
  id: string;
  name: string;
  lastOpenedMillis: number;
}

export type EngineMode = "auto" | "bundled" | "external";

export type Theme = "system" | "light" | "dark";

export interface AppSettings {
  schemaVersion: number;
  engineMode: EngineMode;
  externalEngine?: string;
  restoreLastWorkspace: boolean;
  lastWorkspaceId?: string;
  theme: Theme;
  diagnosticsEnabled: boolean;
}

export interface LastOperation {
  kind: string;
  exitCode: number;
  stderr: string;
  atMillis: number;
}

export interface DiagnosticsSnapshot {
  uiVersion: string;
  engine?: EngineStatus;
  lastOperation?: LastOperation;
  os: string;
  arch: string;
  workspaceDir?: string;
}

export interface StartupResolution {
  workspaceFile?: string;
  initialPaths: string[];
  restoreLast: boolean;
  diagnosticsEnabled: boolean;
}
