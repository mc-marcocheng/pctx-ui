import { useEffect, useRef, useState } from "react";
import { Download, FolderOpen, Save, Upload } from "lucide-react";
import {
  exportWorkspaceFile,
  importWorkspaceFile,
  listRecentWorkspaces,
  loadWorkspace,
  normalizeInvokeError,
  saveWorkspace,
} from "../../api/commands";
import { chooseWorkspaceExportPath, chooseWorkspaceFile } from "../../api/dialogs";
import { usePreviewStore } from "../../state/previewStore";
import { useWorkspaceStore } from "../../state/workspaceStore";
import type { RecentWorkspaceEntry } from "../../api/types";
import { parseWorkspaceFile, workspaceFromFile, workspaceToFile } from "../../utils/workspaceSchema";
import { scanWorkspace } from "../../hooks/scanActions";

export function WorkspacePersistenceMenu() {
  const workspace = useWorkspaceStore((state) => state.workspace);
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace);
  const markStale = usePreviewStore((state) => state.markStale);
  const scanWorkspaceAction = scanWorkspace;

  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<RecentWorkspaceEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function showMessage(text: string) {
    setMessage(text);
    setTimeout(() => setMessage((current) => (current === text ? null : current)), 4000);
  }

  async function refreshRecent() {
    try {
      setRecent(await listRecentWorkspaces());
    } catch (error) {
      showMessage(normalizeInvokeError(error).message);
    }
  }

  async function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    await refreshRecent();
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleSave() {
    setBusy(true);
    try {
      await saveWorkspace(workspaceToFile(workspace));
      showMessage("Workspace saved.");
      await refreshRecent();
    } catch (error) {
      showMessage(normalizeInvokeError(error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLoad(id: string) {
    setBusy(true);
    try {
      const file = await loadWorkspace(id);
      setWorkspace(workspaceFromFile(file));
      markStale();
      await scanWorkspaceAction();
      setOpen(false);
    } catch (error) {
      showMessage(normalizeInvokeError(error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    const path = await chooseWorkspaceFile();
    if (!path) return;

    setBusy(true);
    try {
      const result = await importWorkspaceFile(path);
      setWorkspace(parseWorkspaceFile(result.workspace));
      markStale();
      await scanWorkspaceAction();
      setOpen(false);
      showMessage(
        result.missingSourceIds.length > 0
          ? `Imported with ${result.missingSourceIds.length} missing source(s).`
          : "Workspace imported.",
      );
    } catch (error) {
      showMessage(normalizeInvokeError(error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    const path = await chooseWorkspaceExportPath(workspace.name);
    if (!path) return;

    setBusy(true);
    try {
      await exportWorkspaceFile(path, workspaceToFile(workspace));
      showMessage("Workspace exported.");
    } catch (error) {
      showMessage(normalizeInvokeError(error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={menuRef} className="workspace-persistence-menu">
      <button
        onClick={() => void toggleMenu()}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        title="Workspace"
      >
        <FolderOpen size={16} /> Workspace
      </button>

      {message && (
        <span className="workspace-persistence-menu__toast" role="status">
          {message}
        </span>
      )}

      {open && (
        <div
          className="workspace-persistence-menu__popover"
          role="menu"
          aria-label="Workspace actions"
        >
          <div className="workspace-persistence-menu__actions">
            <button onClick={() => void handleSave()} disabled={busy} role="menuitem">
              <Save size={16} /> Save
            </button>
            <button onClick={() => void handleImport()} disabled={busy} role="menuitem">
              <Upload size={16} /> Import…
            </button>
            <button onClick={() => void handleExport()} disabled={busy} role="menuitem">
              <Download size={16} /> Export…
            </button>
          </div>

          <div className="workspace-persistence-menu__recent">
            <h3>Recent</h3>
            {recent === null && <p>Loading…</p>}
            {recent?.length === 0 && <p className="muted">No saved workspaces yet.</p>}
            <ul>
              {recent?.map((entry) => (
                <li key={entry.id}>
                  <button
                    onClick={() => void handleLoad(entry.id)}
                    disabled={busy}
                    role="menuitem"
                  >
                    {entry.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
