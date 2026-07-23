import type { PathAliasRequest, WorkspaceSource } from "../api/types";

const ALIAS_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function validateAlias(alias: string, existingAliases: string[]): string | null {
  if (!ALIAS_PATTERN.test(alias)) {
    return "Use letters, numbers, dots, underscores, or hyphens.";
  }

  if (alias === "." || alias === "..") {
    return "Alias cannot be . or ..";
  }

  const normalized = alias.toLocaleLowerCase();
  if (existingAliases.some((candidate) => candidate.toLocaleLowerCase() === normalized)) {
    return "Alias is already used by another source.";
  }

  return null;
}

export function suggestedAlias(path: string): string {
  const normalized = path.replace(/[\\/]+$/, "");
  const basename = normalized.split(/[\\/]/).at(-1) || "source";

  const sanitized = basename
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/-+/g, "-");

  return sanitized || "source";
}

export function makeUniqueAlias(suggestion: string, existingAliases: string[]): string {
  const used = new Set(existingAliases.map((value) => value.toLowerCase()));

  if (!used.has(suggestion.toLowerCase())) {
    return suggestion;
  }

  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${suggestion}-${suffix}`;
    if (!used.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
}

export function canonicalKey(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.toLowerCase();
}

export function pathDepth(path: string): number {
  return path.split(/[\\/]/).filter(Boolean).length;
}

export function isWithin(path: string, root: string): boolean {
  const normalize = (value: string) => value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

  const candidate = normalize(path);
  const parent = normalize(root);

  return candidate === parent || candidate.startsWith(`${parent}/`);
}

export function parentPath(path: string): string {
  const normalized = path.replace(/[\\/]+$/, "");
  const index = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return index >= 0 ? normalized.slice(0, index) : normalized;
}

export function sourceRoot(source: WorkspaceSource): string {
  return source.kind === "directory" ? source.path : parentPath(source.path);
}

export function chooseOwningSource(
  filePath: string,
  sources: WorkspaceSource[],
): WorkspaceSource | undefined {
  return sources
    .filter((source) => isWithin(filePath, sourceRoot(source)))
    .sort((left, right) => pathDepth(sourceRoot(right)) - pathDepth(sourceRoot(left)))[0];
}

export function buildGenerationAliases(
  sources: WorkspaceSource[],
  selectedPaths: string[],
): PathAliasRequest[] {
  const selected = new Set(selectedPaths.map(canonicalKey));
  const byRoot = new Map<string, PathAliasRequest>();

  for (const source of sources) {
    const root = sourceRoot(source);

    const sourceHasSelection =
      source.kind === "file"
        ? selected.has(canonicalKey(source.path))
        : selectedPaths.some((path) => isWithin(path, source.path));

    if (!sourceHasSelection) {
      continue;
    }

    const key = canonicalKey(root);
    const existing = byRoot.get(key);

    if (existing && existing.alias !== source.alias) {
      throw new Error(
        `Alias root ${root} is mapped to both ${existing.alias} and ${source.alias}`,
      );
    }

    byRoot.set(key, { alias: source.alias, root });
  }

  return [...byRoot.values()].sort(
    (left, right) => pathDepth(right.root) - pathDepth(left.root),
  );
}
