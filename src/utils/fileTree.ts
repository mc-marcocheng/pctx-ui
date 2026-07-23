import { canonicalKey } from "./aliases";
import type { WorkspaceFileNode } from "../state/workspaceStore";

export interface TreeNode {
  id: string;
  name: string;
  kind: "directory" | "file";
  canonicalPath?: string;
  sourceId: string;
  children: TreeNode[];
  totalFileCount: number;
  selectedFileCount: number;
}

export function fileNodeId(path: string): string {
  return `file:${canonicalKey(path)}`;
}

export function directoryNodeId(sourceId: string, relativePath: string): string {
  return `dir:${sourceId}:${relativePath.replace(/\\/g, "/")}`;
}

function getOrCreateChild(
  parent: TreeNode,
  id: string,
  name: string,
  sourceId: string,
): TreeNode {
  let child = parent.children.find((candidate) => candidate.id === id);
  if (!child) {
    child = {
      id,
      name,
      kind: "directory",
      sourceId,
      children: [],
      totalFileCount: 0,
      selectedFileCount: 0,
    };
    parent.children.push(child);
  }
  return child;
}

/** Builds one tree per source alias from the flat discovered-file map. */
export function buildFileTree(
  files: WorkspaceFileNode[],
  selected: Set<string>,
): TreeNode[] {
  const roots = new Map<string, TreeNode>();

  for (const file of files) {
    const root = roots.get(file.sourceId) ?? {
      id: `source:${file.sourceId}`,
      name: file.sourceAlias,
      kind: "directory" as const,
      sourceId: file.sourceId,
      children: [],
      totalFileCount: 0,
      selectedFileCount: 0,
    };
    roots.set(file.sourceId, root);

    const segments = file.relativePath.split(/[\\/]/).filter(Boolean);
    let cursor = root;
    let accumulatedPath = "";

    for (let index = 0; index < segments.length - 1; index += 1) {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${segments[index]}` : segments[index];
      cursor = getOrCreateChild(
        cursor,
        directoryNodeId(file.sourceId, accumulatedPath),
        segments[index],
        file.sourceId,
      );
    }

    const isSelected = selected.has(canonicalKey(file.canonicalPath));
    const fileName = segments[segments.length - 1] ?? file.relativePath;

    cursor.children.push({
      id: fileNodeId(file.canonicalPath),
      name: fileName,
      kind: "file",
      canonicalPath: file.canonicalPath,
      sourceId: file.sourceId,
      children: [],
      totalFileCount: 1,
      selectedFileCount: isSelected ? 1 : 0,
    });
  }

  function rollUp(node: TreeNode): void {
    if (node.kind === "file") return;

    node.children.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    let total = 0;
    let selectedCount = 0;
    for (const child of node.children) {
      rollUp(child);
      total += child.totalFileCount;
      selectedCount += child.selectedFileCount;
    }
    node.totalFileCount = total;
    node.selectedFileCount = selectedCount;
  }

  const result = [...roots.values()];
  for (const root of result) rollUp(root);
  result.sort((a, b) => a.name.localeCompare(b.name));

  return result;
}

export type CheckState = "checked" | "unchecked" | "indeterminate";

export function checkState(node: TreeNode): CheckState {
  if (node.selectedFileCount === 0) return "unchecked";
  if (node.selectedFileCount === node.totalFileCount) return "checked";
  return "indeterminate";
}

export function collectDescendantFiles(node: TreeNode): string[] {
  if (node.kind === "file") {
    return node.canonicalPath ? [node.canonicalPath] : [];
  }
  return node.children.flatMap(collectDescendantFiles);
}

export interface FlatTreeRow {
  node: TreeNode;
  depth: number;
}

export function flattenTree(roots: TreeNode[], expanded: Set<string>): FlatTreeRow[] {
  const output: FlatTreeRow[] = [];

  function visit(node: TreeNode, depth: number) {
    output.push({ node, depth });
    if (node.kind !== "file" && expanded.has(node.id)) {
      for (const child of node.children) visit(child, depth + 1);
    }
  }

  for (const root of roots) visit(root, 0);
  return output;
}

/**
 * Returns the node IDs that must be expanded so every file matching `query`
 * (by name, relative path segment, or extension) is visible, without
 * mutating the caller's normal expansion state.
 */
export function searchExpansionIds(roots: TreeNode[], query: string): Set<string> {
  const normalized = query.trim().toLowerCase();
  const ids = new Set<string>();
  if (!normalized) return ids;

  function matches(node: TreeNode): boolean {
    if (node.kind === "file") {
      return (
        node.name.toLowerCase().includes(normalized) ||
        (node.canonicalPath ?? "").toLowerCase().includes(normalized)
      );
    }
    return node.name.toLowerCase().includes(normalized);
  }

  function visit(node: TreeNode, ancestors: TreeNode[]): boolean {
    const selfMatch = matches(node);
    let childMatch = false;
    for (const child of node.children) {
      if (visit(child, [...ancestors, node])) childMatch = true;
    }

    if (selfMatch || childMatch) {
      if (node.kind === "directory") ids.add(node.id);
      for (const ancestor of ancestors) ids.add(ancestor.id);
      return true;
    }
    return false;
  }

  for (const root of roots) visit(root, []);
  return ids;
}

/** Filters the tree down to nodes that match (or contain a match for) the query. */
export function filterTree(roots: TreeNode[], query: string): TreeNode[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return roots;

  function matches(node: TreeNode): boolean {
    if (node.kind === "file") {
      return (
        node.name.toLowerCase().includes(normalized) ||
        (node.canonicalPath ?? "").toLowerCase().includes(normalized)
      );
    }
    return node.name.toLowerCase().includes(normalized);
  }

  function prune(node: TreeNode): TreeNode | null {
    if (node.kind === "file") {
      return matches(node) ? node : null;
    }

    const prunedChildren = node.children.map(prune).filter((child): child is TreeNode => child !== null);

    if (matches(node) || prunedChildren.length > 0) {
      return { ...node, children: matches(node) ? node.children : prunedChildren };
    }
    return null;
  }

  return roots.map(prune).filter((node): node is TreeNode => node !== null);
}
