import { FolderPlus, FilePlus, RefreshCw } from "lucide-react";
import { chooseDirectory, chooseFiles } from "../../api/dialogs";
import { canonicalizeSources } from "../../api/commands";
import { useWorkspaceStore } from "../../state/workspaceStore";
import { usePreviewStore } from "../../state/previewStore";
import { suggestedAlias, makeUniqueAlias } from "../../utils/aliases";
import { hasPatternErrors } from "../../utils/patterns";
import { scanWorkspace } from "../../hooks/scanActions";
import type { WorkspaceSource } from "../../api/types";
import { SettingsPanel } from "./SettingsPanel";
import { WorkspacePersistenceMenu } from "../workspace/WorkspacePersistenceMenu";
import { WorkspaceTitle } from "../workspace/WorkspaceTitle";

export function TopToolbar() {
  const workspace = useWorkspaceStore((state) => state.workspace);
  const addSources = useWorkspaceStore((state) => state.addSources);
  const markStale = usePreviewStore((state) => state.markStale);

  const patternsInvalid =
    hasPatternErrors(workspace.filters.include) || hasPatternErrors(workspace.filters.exclude);

  async function addDirectory() {
    const path = await chooseDirectory();
    if (!path) return;

    const [canonical] = await canonicalizeSources([path]);
    if (!canonical || !canonical.isDirectory) return;

    const existingAliases = workspace.sources.map((source) => source.alias);
    const alias = makeUniqueAlias(suggestedAlias(canonical.canonical), existingAliases);

    const source: WorkspaceSource = {
      kind: "directory",
      id: crypto.randomUUID(),
      path: canonical.canonical,
      alias,
    };

    addSources([source]);
    markStale();
    await scanWorkspace();
  }

  async function addFiles() {
    const paths = await chooseFiles();
    if (paths.length === 0) return;

    const canonicalSources = await canonicalizeSources(paths);
    const existingAliases = [...workspace.sources.map((source) => source.alias)];
    const newSources: WorkspaceSource[] = [];

    for (const entry of canonicalSources) {
      if (!entry.isFile) continue;
      const alias = makeUniqueAlias(suggestedAlias(entry.canonical), existingAliases);
      existingAliases.push(alias);
      newSources.push({
        kind: "file",
        id: crypto.randomUUID(),
        path: entry.canonical,
        alias,
      });
    }

    addSources(newSources);
    markStale();
    await scanWorkspace();
  }

  return (
    <header className="top-toolbar">
      <WorkspaceTitle />

      <div className="top-toolbar__actions">
        <button
          onClick={() => void addDirectory()}
          title="Add directory"
          aria-label="Add directory"
        >
          <FolderPlus size={16} />
          <span className="top-toolbar__action-label">Add directory</span>
        </button>

        <button
          onClick={() => void addFiles()}
          title="Add files"
          aria-label="Add files"
        >
          <FilePlus size={16} />
          <span className="top-toolbar__action-label">Add files</span>
        </button>

        <button
          onClick={() => void scanWorkspace()}
          title={patternsInvalid ? "Fix invalid patterns before rescanning" : "Rescan"}
          aria-label="Rescan"
          disabled={patternsInvalid}
        >
          <RefreshCw size={16} />
          <span className="top-toolbar__action-label">Rescan</span>
        </button>

        <WorkspacePersistenceMenu />
        <SettingsPanel />
      </div>
    </header>
  );
}
