import { canonicalKey } from "./aliases";
import type { WorkspaceFileNode } from "../state/workspaceStore";

export function selectExtensions(
  files: WorkspaceFileNode[],
  extensions: Set<string>,
): string[] {
  const normalized = new Set([...extensions].map((value) => value.toLowerCase().replace(/^\./, "")));
  return files
    .filter((file) => normalized.has(file.extension.toLowerCase().replace(/^\./, "")))
    .map((file) => file.canonicalPath);
}

export function belowSize(files: WorkspaceFileNode[], maxBytes: number): string[] {
  return files.filter((file) => file.sizeBytes <= maxBytes).map((file) => file.canonicalPath);
}

/**
 * Deselects the largest files from a selection until at most `count` remain,
 * or (if `count` is omitted) until at least `bytesToRemove` bytes have been
 * dropped. Returns the resulting selection.
 */
export function deselectLargest(
  files: WorkspaceFileNode[],
  selectedPaths: string[],
  options: { count?: number; bytesToRemove?: number },
): string[] {
  const selectedKeys = new Set(selectedPaths.map(canonicalKey));
  const selectedFiles = files
    .filter((file) => selectedKeys.has(canonicalKey(file.canonicalPath)))
    .sort((a, b) => b.sizeBytes - a.sizeBytes);

  const toRemove = new Set<string>();

  if (options.count !== undefined) {
    for (const file of selectedFiles) {
      if (selectedFiles.length - toRemove.size <= options.count) break;
      toRemove.add(canonicalKey(file.canonicalPath));
    }
  } else if (options.bytesToRemove !== undefined) {
    let removedBytes = 0;
    for (const file of selectedFiles) {
      if (removedBytes >= options.bytesToRemove) break;
      toRemove.add(canonicalKey(file.canonicalPath));
      removedBytes += file.sizeBytes;
    }
  }

  return selectedPaths.filter((path) => !toRemove.has(canonicalKey(path)));
}

const BYTES_PER_TOKEN_ESTIMATE = 4;

export interface TokenBudgetResult {
  keptPaths: string[];
  removedPaths: string[];
  estimatedTokens: number;
}

/**
 * A rough pre-generation token budget filter: keeps pinned files, then adds
 * remaining selected files in ascending size order until the estimated
 * budget (bytes / 4) would be exceeded. This is a coarse estimate only —
 * the engine's own token count after generation is authoritative.
 */
export function fitTokenBudget(
  files: WorkspaceFileNode[],
  selectedPaths: string[],
  pinnedPaths: string[],
  tokenBudget: number,
): TokenBudgetResult {
  const byKey = new Map(files.map((file) => [canonicalKey(file.canonicalPath), file]));
  const pinned = new Set(pinnedPaths.map(canonicalKey));
  const selectedKeys = selectedPaths.map(canonicalKey);

  const pinnedSelected = selectedKeys.filter((key) => pinned.has(key));
  const rest = selectedKeys
    .filter((key) => !pinned.has(key))
    .map((key) => byKey.get(key))
    .filter((file): file is WorkspaceFileNode => file !== undefined)
    .sort((a, b) => a.sizeBytes - b.sizeBytes);

  let usedBytes = pinnedSelected.reduce((sum, key) => sum + (byKey.get(key)?.sizeBytes ?? 0), 0);
  const budgetBytes = tokenBudget * BYTES_PER_TOKEN_ESTIMATE;

  const kept = [...pinnedSelected];
  const removed: string[] = [];

  for (const file of rest) {
    if (usedBytes + file.sizeBytes <= budgetBytes) {
      kept.push(canonicalKey(file.canonicalPath));
      usedBytes += file.sizeBytes;
    } else {
      removed.push(file.canonicalPath);
    }
  }

  const keptOriginalCasing = kept.map((key) => byKey.get(key)?.canonicalPath ?? key);

  return {
    keptPaths: keptOriginalCasing,
    removedPaths: removed,
    estimatedTokens: Math.ceil(usedBytes / BYTES_PER_TOKEN_ESTIMATE),
  };
}

export function estimateTokens(files: WorkspaceFileNode[], selectedPaths: string[]): number {
  const selected = new Set(selectedPaths.map(canonicalKey));
  const bytes = files
    .filter((file) => selected.has(canonicalKey(file.canonicalPath)))
    .reduce((sum, file) => sum + file.sizeBytes, 0);
  return Math.ceil(bytes / BYTES_PER_TOKEN_ESTIMATE);
}
