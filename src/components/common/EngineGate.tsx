import { useEffect, useState, type ReactNode } from "react";
import { probeEngine, setExternalEngine, normalizeInvokeError } from "../../api/commands";
import { chooseExternalEngine } from "../../api/dialogs";
import { useSettingsStore } from "../../state/settingsStore";

export function EngineGate({ children }: { children: ReactNode }) {
  const engine = useSettingsStore((state) => state.engine);
  const engineError = useSettingsStore((state) => state.engineError);
  const probing = useSettingsStore((state) => state.probing);
  const setEngine = useSettingsStore((state) => state.setEngine);
  const setEngineError = useSettingsStore((state) => state.setEngineError);
  const setProbing = useSettingsStore((state) => state.setProbing);
  const [pickerBusy, setPickerBusy] = useState(false);

  async function probe() {
    setProbing(true);
    setEngineError(null);
    try {
      const status = await probeEngine();
      setEngine(status);
    } catch (error) {
      setEngineError(normalizeInvokeError(error).message);
    } finally {
      setProbing(false);
    }
  }

  useEffect(() => {
    void probe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pickExternalEngine() {
    setPickerBusy(true);
    try {
      const path = await chooseExternalEngine();
      if (!path) return;
      const status = await setExternalEngine(path);
      setEngine(status);
    } catch (error) {
      setEngineError(normalizeInvokeError(error).message);
    } finally {
      setPickerBusy(false);
    }
  }

  if (engine) {
    return <>{children}</>;
  }

  return (
    <div className="engine-setup">
      <h1>pctx-ui</h1>
      {probing && <p>Looking for a compatible pctx engine…</p>}
      {!probing && engineError && (
        <div className="engine-setup__error">
          <p>No compatible pctx engine was found.</p>
          <pre>{engineError}</pre>
        </div>
      )}
      <div className="engine-setup__actions">
        <button onClick={() => void probe()} disabled={probing}>
          Retry
        </button>
        <button onClick={() => void pickExternalEngine()} disabled={pickerBusy}>
          Choose pctx executable…
        </button>
      </div>
    </div>
  );
}
