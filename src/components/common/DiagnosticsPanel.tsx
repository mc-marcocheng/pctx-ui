import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, X } from "lucide-react";
import { getDiagnostics, normalizeInvokeError } from "../../api/commands";
import type { DiagnosticsSnapshot } from "../../api/types";
import { useSettingsStore } from "../../state/settingsStore";

export function DiagnosticsPanel() {
  const autoOpen = useSettingsStore((state) => state.diagnosticsAutoOpen);
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  async function refreshDiagnostics() {
    setLoading(true);
    setError(null);

    try {
      setSnapshot(await getDiagnostics());
    } catch (err) {
      setError(normalizeInvokeError(err).message);
    } finally {
      setLoading(false);
    }
  }

  async function openDiagnostics() {
    setOpen(true);
    await refreshDiagnostics();
  }

  useEffect(() => {
    if (autoOpen) void openDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  return (
    <>
      <button onClick={() => void openDiagnostics()} title="Diagnostics">
        <Activity size={16} /> Diagnostics
      </button>

      {open &&
        createPortal(
          <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={() => setOpen(false)}
          >
            <section
              className="modal diagnostics-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="diagnostics-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className="modal__header">
                <div>
                  <h2 id="diagnostics-title">Diagnostics</h2>
                  <p>Application, engine, and last-operation information.</p>
                </div>

                <button
                  ref={closeButtonRef}
                  className="icon-button"
                  aria-label="Close diagnostics"
                  onClick={() => setOpen(false)}
                >
                  <X size={18} />
                </button>
              </header>

              <div className="modal__body">
                {loading && <p>Loading…</p>}
                {error && <p className="diagnostics-panel__error">{error}</p>}
                {snapshot && (
                  <dl>
                    <dt>UI version</dt>
                    <dd>{snapshot.uiVersion}</dd>
                    <dt>OS</dt>
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
                          <pre className="diagnostics-panel__stderr">{snapshot.lastOperation.stderr}</pre>
                        </dd>
                      </>
                    )}
                  </dl>
                )}
              </div>

              <footer className="modal__footer">
                <button onClick={() => void refreshDiagnostics()} disabled={loading}>
                  Refresh
                </button>
                <button className="button--primary" onClick={() => setOpen(false)}>
                  Close
                </button>
              </footer>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
