import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { createPortal } from "react-dom";
import { Settings, X } from "lucide-react";
import {
  getDiagnostics,
  normalizeInvokeError,
} from "../../api/commands";
import type { DiagnosticsSnapshot } from "../../api/types";
import { useSettingsStore } from "../../state/settingsStore";
import {
  parseCustomTheme,
  useUiSettingsStore,
  type UiDensity,
  type UiTheme,
} from "../../state/uiSettingsStore";

const CUSTOM_THEME_TEMPLATE = {
  schemaVersion: 1,
  name: "My Theme",
  mode: "dark",
  colors: {
    bg: "#18181b",
    surface: "#202024",
    "surface-raised": "#27272a",
    "surface-subtle": "#232326",
    "surface-hover": "#303036",
    text: "#fafafa",
    "text-muted": "#a1a1aa",
    border: "#3f3f46",
    primary: "#a78bfa",
    "primary-hover": "#c4b5fd",
    "primary-text": "#18181b",
    "editor-bg": "#18181b",
    "editor-gutter": "#202024",
    "syntax-comment": "#7f8795",
    "syntax-keyword": "#c792ea",
    "syntax-string": "#a6e3a1",
    "syntax-number": "#f5c26b",
    "syntax-function": "#82aaff",
    "syntax-variable": "#f07178",
    "syntax-type": "#89ddff",
    "syntax-tag": "#ff7b72",
    "syntax-attribute": "#c3a6ff",
    "syntax-meta": "#f2b66d",
    "syntax-invalid": "#ff6b6b",
  },
};

export function SettingsPanel() {
  const diagnosticsAutoOpen = useSettingsStore(
    (state) => state.diagnosticsAutoOpen,
  );

  const theme = useUiSettingsStore((state) => state.theme);
  const customTheme = useUiSettingsStore((state) => state.customTheme);
  const density = useUiSettingsStore((state) => state.density);
  const editorLineWrapping = useUiSettingsStore(
    (state) => state.editorLineWrapping,
  );
  const reduceMotion = useUiSettingsStore((state) => state.reduceMotion);

  const setTheme = useUiSettingsStore((state) => state.setTheme);
  const setCustomTheme = useUiSettingsStore(
    (state) => state.setCustomTheme,
  );
  const setDensity = useUiSettingsStore((state) => state.setDensity);
  const setEditorLineWrapping = useUiSettingsStore(
    (state) => state.setEditorLineWrapping,
  );
  const setReduceMotion = useUiSettingsStore(
    (state) => state.setReduceMotion,
  );
  const resetUiSettings = useUiSettingsStore(
    (state) => state.resetUiSettings,
  );

  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [themeMessage, setThemeMessage] = useState<string | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const themeFileRef = useRef<HTMLInputElement>(null);

  async function refreshDiagnostics() {
    setLoadingDiagnostics(true);
    setDiagnosticsError(null);

    try {
      setSnapshot(await getDiagnostics());
    } catch (error) {
      setDiagnosticsError(normalizeInvokeError(error).message);
    } finally {
      setLoadingDiagnostics(false);
    }
  }

  function openSettings() {
    setOpen(true);
    void refreshDiagnostics();
  }

  useEffect(() => {
    if (diagnosticsAutoOpen) {
      openSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnosticsAutoOpen]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function importTheme(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (file.size > 64 * 1024) {
      setThemeMessage("Theme files must be smaller than 64 KB.");
      return;
    }

    try {
      const parsed = parseCustomTheme(JSON.parse(await file.text()));
      setCustomTheme(parsed);
      setThemeMessage(`Imported and applied "${parsed.name}".`);
    } catch (error) {
      setThemeMessage(
        error instanceof Error ? error.message : "Could not import theme.",
      );
    }
  }

  function downloadThemeTemplate() {
    const blob = new Blob(
      [JSON.stringify(CUSTOM_THEME_TEMPLATE, null, 2)],
      { type: "application/json" },
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pctx-theme.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button
        type="button"
        className="icon-button top-toolbar__settings"
        onClick={openSettings}
        title="Settings"
        aria-label="Settings"
      >
        <Settings size={18} />
      </button>

      {open &&
        createPortal(
          <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={() => setOpen(false)}
          >
            <section
              className="modal settings-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className="modal__header">
                <div>
                  <h2 id="settings-title">Settings</h2>
                  <p>Customize the application appearance and behavior.</p>
                </div>

                <button
                  ref={closeButtonRef}
                  className="icon-button"
                  aria-label="Close settings"
                  onClick={() => setOpen(false)}
                >
                  <X size={18} />
                </button>
              </header>

              <div className="modal__body settings-modal__body">
                <section className="settings-modal__section">
                  <h3>Appearance</h3>

                  <label>
                    Theme
                    <select
                      value={theme}
                      onChange={(event) =>
                        setTheme(event.target.value as UiTheme)
                      }
                    >
                      <option value="system">Follow system</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="dracula">Dracula</option>
                      <option value="nord">Nord</option>
                      <option value="solarized-dark">
                        Solarized Dark
                      </option>
                      {customTheme && (
                        <option value="custom">
                          {customTheme.name}
                        </option>
                      )}
                    </select>
                  </label>

                  <label>
                    Interface density
                    <select
                      value={density}
                      onChange={(event) =>
                        setDensity(event.target.value as UiDensity)
                      }
                    >
                      <option value="comfortable">Comfortable</option>
                      <option value="compact">Compact</option>
                    </select>
                  </label>

                  <div className="settings-modal__actions">
                    <button
                      type="button"
                      onClick={() => themeFileRef.current?.click()}
                    >
                      Import custom theme…
                    </button>

                    <button
                      type="button"
                      onClick={downloadThemeTemplate}
                    >
                      Download theme template
                    </button>

                    {customTheme && (
                      <button
                        type="button"
                        className="settings-modal__action--wide"
                        onClick={() => {
                          setCustomTheme(null);
                          setThemeMessage("Custom theme removed.");
                        }}
                      >
                        Remove custom theme
                      </button>
                    )}
                  </div>

                  <input
                    ref={themeFileRef}
                    className="visually-hidden"
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) => void importTheme(event)}
                  />

                  {themeMessage && (
                    <p className="settings-modal__message" role="status">
                      {themeMessage}
                    </p>
                  )}

                  <details className="settings-modal__theme-help">
                    <summary>Custom theme format</summary>
                    <p>
                      A theme is a small JSON file. Colors may use hex,
                      RGB, HSL, or named CSS colors. Unspecified colors
                      inherit from the selected light or dark base.
                    </p>
                    <pre>
                      {JSON.stringify(CUSTOM_THEME_TEMPLATE, null, 2)}
                    </pre>
                  </details>
                </section>

                <section className="settings-modal__section">
                  <h3>Editor</h3>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={editorLineWrapping}
                      onChange={(event) =>
                        setEditorLineWrapping(event.target.checked)
                      }
                    />
                    Wrap long lines in Preview
                  </label>
                </section>

                <section className="settings-modal__section">
                  <h3>Accessibility</h3>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={reduceMotion}
                      onChange={(event) =>
                        setReduceMotion(event.target.checked)
                      }
                    />
                    Reduce interface motion
                  </label>
                </section>

                <section className="settings-modal__section settings-modal__about">
                  <div className="settings-modal__section-heading">
                    <h3>About</h3>
                    <button
                      type="button"
                      onClick={() => void refreshDiagnostics()}
                      disabled={loadingDiagnostics}
                    >
                      Refresh
                    </button>
                  </div>

                  {loadingDiagnostics && !snapshot && <p>Loading…</p>}

                  {diagnosticsError && (
                    <p className="settings-modal__error">
                      {diagnosticsError}
                    </p>
                  )}

                  {snapshot && (
                    <dl>
                      <dt>UI version</dt>
                      <dd>{snapshot.uiVersion}</dd>

                      <dt>Operating system</dt>
                      <dd>
                        {snapshot.os} ({snapshot.arch})
                      </dd>

                      <dt>Engine</dt>
                      <dd>
                        {snapshot.engine
                          ? `${snapshot.engine.capabilities.name} ${snapshot.engine.capabilities.version} (${snapshot.engine.source})`
                          : "Not configured"}
                      </dd>

                      <dt>Workspace data directory</dt>
                      <dd>{snapshot.workspaceDir ?? "Unavailable"}</dd>

                      <dt>Last operation</dt>
                      <dd>
                        {snapshot.lastOperation
                          ? `${snapshot.lastOperation.kind} (exit ${snapshot.lastOperation.exitCode})`
                          : "None yet"}
                      </dd>

                      {snapshot.lastOperation?.stderr && (
                        <>
                          <dt>Last stderr</dt>
                          <dd>
                            <pre className="diagnostics-panel__stderr">
                              {snapshot.lastOperation.stderr}
                            </pre>
                          </dd>
                        </>
                      )}
                    </dl>
                  )}
                </section>
              </div>

              <footer className="modal__footer">
                <button type="button" onClick={resetUiSettings}>
                  Reset UI settings
                </button>

                <button
                  type="button"
                  className="button--primary"
                  onClick={() => setOpen(false)}
                >
                  Done
                </button>
              </footer>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}