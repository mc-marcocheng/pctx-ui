import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight, File as FileIcon, Folder } from "lucide-react";
import {
  buildFileTree,
  checkState,
  collectDescendantFiles,
  filterTree,
  flattenTree,
  searchExpansionIds,
  type TreeNode,
} from "../../utils/fileTree";
import type { WorkspaceFileNode } from "../../state/workspaceStore";
import { canonicalKey } from "../../utils/aliases";

interface FileTreeProps {
  files: WorkspaceFileNode[];
  selectedPaths: string[];
  search: string;
  onToggleFile: (path: string) => void;
  onToggleDirectory: (paths: string[], select: boolean) => void;
}

export function FileTree({ files, selectedPaths, search, onToggleFile, onToggleDirectory }: FileTreeProps) {
  const selected = useMemo(() => new Set(selectedPaths.map(canonicalKey)), [selectedPaths]);
  const fullTree = useMemo(() => buildFileTree(files, selected), [files, selected]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Auto-expand every source root the first time it appears.
    setExpanded((previous) => {
      const next = new Set(previous);
      for (const root of fullTree) next.add(root.id);
      return next;
    });
  }, [fullTree.map((root) => root.id).join(",")]);

  const searchIds = useMemo(() => searchExpansionIds(fullTree, search), [fullTree, search]);
  const visibleTree = useMemo(
    () => (search.trim() ? filterTree(fullTree, search) : fullTree),
    [fullTree, search],
  );

  const effectiveExpanded = search.trim() ? new Set([...expanded, ...searchIds]) : expanded;
  const rows = useMemo(
    () => flattenTree(visibleTree, effectiveExpanded),
    [visibleTree, effectiveExpanded],
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 12,
  });

  function toggleExpand(node: TreeNode) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  }

  function handleCheck(node: TreeNode) {
    if (node.kind === "file") {
      if (node.canonicalPath) onToggleFile(node.canonicalPath);
      return;
    }
    const state = checkState(node);
    const paths = collectDescendantFiles(node);
    onToggleDirectory(paths, state !== "checked");
  }

  if (files.length === 0) {
    return <p className="muted">No files discovered yet.</p>;
  }

  if (rows.length === 0) {
    return <p className="muted">No files match your search.</p>;
  }

  return (
    <div ref={parentRef} className="file-tree" role="tree">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          const { node, depth } = row;
          const state = node.kind === "directory" ? checkState(node) : node.selectedFileCount > 0 ? "checked" : "unchecked";
          const isExpanded = effectiveExpanded.has(node.id);

          return (
            <div
              key={node.id}
              role="treeitem"
              aria-level={depth + 1}
              aria-expanded={node.kind === "directory" ? isExpanded : undefined}
              className="file-tree__row"
              style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
              paddingLeft: `${8 + depth * 14}px`,
            }}
            >
              {node.kind === "directory" ? (
                <button
                  type="button"
                  className="icon-button file-tree__expander"
                  onClick={() => toggleExpand(node)}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.name}`}
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span className="file-tree__expander-spacer" />
              )}

              <input
                type="checkbox"
                aria-label={`Select ${node.name}`}
                checked={state === "checked"}
                ref={(element) => {
                  if (element) {
                    element.indeterminate = state === "indeterminate";
                  }
                }}
                onChange={() => handleCheck(node)}
              />

              {node.kind === "directory" ? <Folder size={14} /> : <FileIcon size={14} />}

              <span
                className="file-tree__name"
                title={node.canonicalPath ?? node.name}
                onClick={() => (node.kind === "directory" ? toggleExpand(node) : handleCheck(node))}
              >
                {node.name}
              </span>

              {node.kind === "directory" && (
                <span className="file-tree__count">
                  {node.selectedFileCount}/{node.totalFileCount}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
