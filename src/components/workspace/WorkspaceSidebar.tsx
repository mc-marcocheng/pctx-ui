import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useWorkspaceStore } from "../../state/workspaceStore";
import { usePreviewStore } from "../../state/previewStore";
import { FileTree } from "./FileTree";
import { belowSize, deselectLargest, estimateTokens, fitTokenBudget, selectExtensions } from "../../utils/bulkSelection";
import { canonicalKey } from "../../utils/aliases";
import { scanWorkspace } from "../../hooks/scanActions";

export function WorkspaceSidebar() {
  const workspace = useWorkspaceStore((state) => state.workspace);
  const discoveredFiles = useWorkspaceStore((state) => state.discoveredFiles);
  const missingSelectedPaths = useWorkspaceStore((state) => state.missingSelectedPaths);
  const removeSource = useWorkspaceStore((state) => state.removeSource);
  const setManySelected = useWorkspaceStore((state) => state.setManySelected);
  const replaceSelection = useWorkspaceStore((state) => state.replaceSelection);
  const selectAll = useWorkspaceStore((state) => state.selectAll);
  const clearSelection = useWorkspaceStore((state) => state.clearSelection);
  const invertSelection = useWorkspaceStore((state) => state.invertSelection);
  const removeMissingSelections = useWorkspaceStore((state) => state.removeMissingSelections);
  const markStale = usePreviewStore((state) => state.markStale);
  const scanWorkspaceAction = scanWorkspace;
  const setTokenBudget = useWorkspaceStore((state) => state.setTokenBudget);
  const [search, setSearch] = useState("");
  const [extensionFilter, setExtensionFilter] = useState("");
  const [maxSizeInput, setMaxSizeInput] = useState("");

  const files = useMemo(() => Object.values(discoveredFiles), [discoveredFiles]);
  const estimatedTokens = useMemo(
    () => estimateTokens(files, workspace.selectedPaths),
    [files, workspace.selectedPaths],
  );

  function withStale(action: () => void) {
    action();
    markStale();
  }

  function handleToggleFile(path: string) {
    const key = canonicalKey(path);
    const isSelected = workspace.selectedPaths.some((p) => canonicalKey(p) === key);
    withStale(() => setManySelected([path], !isSelected));
  }

  function handleToggleDirectory(paths: string[], select: boolean) {
    withStale(() => setManySelected(paths, select));
  }

  function applyExtensionFilter() {
    const extensions = new Set(
      extensionFilter
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
    if (extensions.size === 0) return;
    withStale(() => replaceSelection(selectExtensions(files, extensions)));
  }

  function applySizeThreshold() {
    const kb = Number(maxSizeInput);
    if (!Number.isFinite(kb) || kb <= 0) return;
    withStale(() => replaceSelection(belowSize(files, kb * 1024)));
  }

  function applyDeselectLargest(count: number) {
    withStale(() => replaceSelection(deselectLargest(files, workspace.selectedPaths, { count })));
  }

  function applyFitTokenBudget() {
    if (!workspace.tokenBudget) return;
    const result = fitTokenBudget(files, workspace.selectedPaths, [], workspace.tokenBudget);
    withStale(() => replaceSelection(result.keptPaths));
  }

  return (
    <aside className="workspace-sidebar">
      <section
        className="workspace-sidebar__sources"
        aria-labelledby="workspace-sources-title"
      >
        <div className="workspace-sidebar__section-heading">
          <h2 id="workspace-sources-title">Sources</h2>
          <span className="workspace-sidebar__section-count">
            {workspace.sources.length}
          </span>
        </div>

        {workspace.sources.length === 0 ? (
          <p className="workspace-sidebar__empty">
            Add a directory or individual files to begin.
          </p>
        ) : (
          <ul className="source-list">
            {workspace.sources.map((source) => (
              <li key={source.id} className="source-item">
                <div className="source-item__body">
                  <div className="source-item__topline">
                    <span className="source-alias">{source.alias}</span>
                    <span className="source-kind">
                      {source.kind === "directory" ? "Directory" : "File"}
                    </span>
                  </div>

                  <span className="source-path" title={source.path}>
                    {source.path}
                  </span>
                </div>

                <button
                  type="button"
                  className="icon-button source-item__remove"
                  aria-label={`Remove ${source.alias}`}
                  title="Remove source"
                  onClick={() => {
                    removeSource(source.id);
                    markStale();
                    void scanWorkspaceAction();
                  }}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="workspace-sidebar__selection"
        aria-labelledby="workspace-files-title"
      >
        <div className="workspace-sidebar__selection-header">
          <div className="workspace-sidebar__section-heading">
            <h2 id="workspace-files-title">Files</h2>
            <span className="workspace-sidebar__discovered-count">
              {files.length.toLocaleString()} discovered
            </span>
          </div>

          <div
            className="workspace-sidebar__selection-summary"
            aria-label={`${workspace.selectedPaths.length} files selected, approximately ${estimatedTokens} tokens`}
          >
            <div className="selection-metric">
              <strong>{workspace.selectedPaths.length.toLocaleString()}</strong>
              <span>selected</span>
            </div>

            <div className="selection-metric">
              <strong>~{estimatedTokens.toLocaleString()}</strong>
              <span>tokens</span>
            </div>
          </div>

          <label className="workspace-sidebar__search">
            <span className="visually-hidden">Search files</span>
            <input
              type="search"
              placeholder="Search files…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="bulk-actions" aria-label="Selection actions">
          <button type="button" onClick={() => withStale(selectAll)}>
            Select all
          </button>

          <button type="button" onClick={() => withStale(clearSelection)}>
            Clear
          </button>

          <button type="button" onClick={() => withStale(invertSelection)}>
            Invert
          </button>

          {missingSelectedPaths.length > 0 && (
            <button
              type="button"
              className="bulk-actions__wide"
              onClick={() => withStale(removeMissingSelections)}
            >
              Remove {missingSelectedPaths.length} missing
            </button>
          )}
        </div>

        <details className="sidebar-disclosure">
          <summary>Advanced selection</summary>

          <div className="sidebar-disclosure__body">
            <label>
              Extensions
              <div className="inline-control">
                <input
                  type="text"
                  placeholder="ts, tsx, rs"
                  value={extensionFilter}
                  onChange={(event) => setExtensionFilter(event.target.value)}
                />
                <button onClick={applyExtensionFilter}>Select</button>
              </div>
            </label>

            <label>
              Maximum file size
              <div className="inline-control">
                <input
                  type="number"
                  min={1}
                  placeholder="KB"
                  value={maxSizeInput}
                  onChange={(event) => setMaxSizeInput(event.target.value)}
                />
                <button onClick={applySizeThreshold}>Select</button>
              </div>
            </label>

            <button onClick={() => applyDeselectLargest(10)}>Keep 10 smallest</button>

            <label>
              Token budget
              <input
                type="number"
                min={1}
                placeholder="Optional"
                value={workspace.tokenBudget ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setTokenBudget(value === "" ? undefined : Number(value));
                }}
              />
            </label>

            <button
              onClick={applyFitTokenBudget}
              disabled={!workspace.tokenBudget}
            >
              Fit current selection to budget
            </button>
          </div>
        </details>

        <FileTree
          files={files}
          selectedPaths={workspace.selectedPaths}
          search={search}
          onToggleFile={handleToggleFile}
          onToggleDirectory={handleToggleDirectory}
        />

        {missingSelectedPaths.length > 0 && (
          <p className="warning">
            {missingSelectedPaths.length} selected file(s) are missing from the latest scan.
          </p>
        )}
      </section>
    </aside>
  );
}
