import { useEffect, useState } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  configInit,
  findConfigCandidates,
  getDefaultExcludes,
  loadEngineConfig,
  normalizeInvokeError,
} from "../../api/commands";
import { chooseConfigFile, chooseDirectory } from "../../api/dialogs";
import { usePreviewStore } from "../../state/previewStore";
import { useWorkspaceStore } from "../../state/workspaceStore";

export function ConfigurationOptions() {
  const workspace = useWorkspaceStore((state) => state.workspace);
  const setActiveConfig = useWorkspaceStore((state) => state.setActiveConfig);
  const markStale = usePreviewStore((state) => state.markStale);

  const [candidates, setCandidates] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<unknown>(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [resolved, setResolved] = useState<{ raw: unknown; stderr: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rootPaths = workspace.sources
    .filter((source) => source.kind === "directory")
    .map((source) => source.path);
  const rootPathsKey = rootPaths.join("|");

  function showMessage(text: string) {
    setMessage(text);
    setTimeout(() => setMessage((current) => (current === text ? null : current)), 4000);
  }

  useEffect(() => {
    if (rootPaths.length === 0) {
      setCandidates([]);
      return;
    }

    findConfigCandidates(rootPaths)
      .then(setCandidates)
      .catch((error: unknown) => showMessage(normalizeInvokeError(error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPathsKey]);

  function selectConfig(path: string) {
    setActiveConfig(path ? { mode: "file", path } : { mode: "none" });
    setResolved(null);
    markStale();
  }

  async function pickConfigFile() {
    const path = await chooseConfigFile();
    if (!path) return;
    selectConfig(path);
  }

  async function handleShowDefaults() {
    if (showDefaults) {
      setShowDefaults(false);
      return;
    }

    setShowDefaults(true);
    if (defaults !== null) return;

    setBusy(true);
    try {
      setDefaults(await getDefaultExcludes());
    } catch (error) {
      showMessage(normalizeInvokeError(error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleShowResolved() {
    if (rootPaths.length === 0) {
      showMessage("Add a workspace directory first.");
      return;
    }

    setBusy(true);
    try {
      const response = await loadEngineConfig({
        operationId: crypto.randomUUID(),
        config: workspace.activeConfig,
        cwd: rootPaths[0],
      });
      setResolved(response);
    } catch (error) {
      showMessage(normalizeInvokeError(error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleInit() {
    const targetDir = rootPaths[0] ?? (await chooseDirectory());
    if (!targetDir) return;

    setBusy(true);
    try {
      const response = await configInit({
        operationId: crypto.randomUUID(),
        targetDir,
        force: false,
      });
      showMessage(`Config created at ${response.path}`);
      selectConfig(response.path);
      setCandidates((current) =>
        current.includes(response.path) ? current : [...current, response.path],
      );
    } catch (error) {
      showMessage(normalizeInvokeError(error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenConfig() {
    if (workspace.activeConfig.mode !== "file") return;
    try {
      await openPath(workspace.activeConfig.path);
    } catch (error) {
      showMessage(normalizeInvokeError(error).message);
    }
  }

  return (
    <section className="configuration-options">
      <h2>Configuration</h2>
      {message && <p className="configuration-options__toast">{message}</p>}
      <label>
        Active config
        <select
          value={workspace.activeConfig.mode === "file" ? workspace.activeConfig.path : ""}
          onChange={(event) => selectConfig(event.target.value)}
        >
          <option value="">No config file</option>
          {candidates.map((path) => (
            <option key={path} value={path}>
              {path}
            </option>
          ))}
          {workspace.activeConfig.mode === "file" &&
            !candidates.includes(workspace.activeConfig.path) && (
              <option value={workspace.activeConfig.path}>{workspace.activeConfig.path}</option>
            )}
        </select>
      </label>
      <div className="configuration-options__actions">
        <button
          type="button"
          onClick={() => void pickConfigFile()}
          disabled={busy}
        >
          Browse…
        </button>

        <button
          type="button"
          onClick={() => void handleOpenConfig()}
          disabled={busy || workspace.activeConfig.mode !== "file"}
        >
          Open
        </button>

        <button
          type="button"
          className="configuration-options__action--wide"
          onClick={() => void handleInit()}
          disabled={busy}
        >
          Init .pctx.toml
        </button>

        <button
          type="button"
          className="configuration-options__action--wide"
          onClick={() => void handleShowResolved()}
          disabled={busy}
        >
          Show resolved config
        </button>

        <button
          type="button"
          className="configuration-options__action--wide"
          onClick={() => void handleShowDefaults()}
          disabled={busy}
        >
          {showDefaults ? "Hide default excludes" : "Show default excludes"}
        </button>
      </div>
      {showDefaults && (
        <pre className="configuration-options__json">{JSON.stringify(defaults, null, 2)}</pre>
      )}
      {resolved && (
        <div className="configuration-options__resolved">
          <pre className="configuration-options__json">{JSON.stringify(resolved.raw, null, 2)}</pre>
          {resolved.stderr && (
            <pre className="configuration-options__stderr">{resolved.stderr}</pre>
          )}
        </div>
      )}
    </section>
  );
}
