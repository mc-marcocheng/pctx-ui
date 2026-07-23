import { useState } from "react";
import { useWorkspaceStore } from "../../state/workspaceStore";
import { usePreviewStore } from "../../state/previewStore";
import { useOperationStore } from "../../state/operationStore";
import { useSettingsStore } from "../../state/settingsStore";
import { generatePreview, copyContext, saveContext } from "../../hooks/generationActions";

export function ActionBar() {
  const selectedCount = useWorkspaceStore((state) => state.workspace.selectedPaths.length);
  const status = usePreviewStore((state) => state.status);
  const active = useOperationStore((state) => state.active);
  const cancel = useOperationStore((state) => state.cancel);
  const engine = useSettingsStore((state) => state.engine);
  const [toast, setToast] = useState<string | null>(null);

  const busyIds = Object.keys(active);
  const busy = busyIds.length > 0;

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? null : current)), 4000);
  }

  async function handleCopy() {
    const result = await copyContext();
    showToast(result.message);
  }

  async function handleSave() {
    const result = await saveContext(async (path) => {
      return window.confirm(`${path} already exists. Replace it?`);
    });
    if (result) showToast(result.message);
  }

  return (
    <footer className="action-bar">
      <div className="action-bar__summary">
        <span>{selectedCount.toLocaleString()} files selected</span>
        {status === "stale" && <span className="badge badge--stale">Stale</span>}
      </div>

      {toast && (
        <div className="action-bar__toast" role="status">
          {toast}
        </div>
      )}

      <div className="action-bar__buttons">
        {busy && (
          <button onClick={() => busyIds.forEach((id) => void cancel(id))}>
            Cancel
          </button>
        )}

        <button
          className="button--primary"
          disabled={selectedCount === 0 || busy}
          onClick={() => void generatePreview()}
        >
          Generate
        </button>

        <button
          disabled={selectedCount === 0 || busy || !engine?.capabilities.clipboard}
          onClick={() => void handleCopy()}
          title={
            engine?.capabilities.clipboard
              ? "Copy regenerates context from the current files and settings."
              : "This pctx build does not include clipboard support."
          }
        >
          Copy
        </button>

        <button disabled={selectedCount === 0 || busy} onClick={() => void handleSave()}>
          Save
        </button>
      </div>
    </footer>
  );
}
