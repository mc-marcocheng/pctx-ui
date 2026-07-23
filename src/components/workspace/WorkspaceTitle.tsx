import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { useWorkspaceStore } from "../../state/workspaceStore";

export function WorkspaceTitle() {
  const name = useWorkspaceStore((state) => state.workspace.name);
  const renameWorkspace = useWorkspaceStore((state) => state.renameWorkspace);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(name), [name]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    renameWorkspace(draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="workspace-title__input"
        aria-label="Workspace name"
        value={draft}
        maxLength={80}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="workspace-title"
      title="Rename workspace"
      onClick={() => setEditing(true)}
    >
      <span>{name}</span>
      <Pencil size={14} />
    </button>
  );
}