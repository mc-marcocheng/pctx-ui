import { create } from "zustand";
import type { EngineStatus } from "../api/types";

interface SettingsState {
  engine: EngineStatus | null;
  engineError: string | null;
  probing: boolean;
  diagnosticsAutoOpen: boolean;
  setEngine(engine: EngineStatus): void;
  setEngineError(message: string | null): void;
  setProbing(probing: boolean): void;
  setDiagnosticsAutoOpen(value: boolean): void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  engine: null,
  engineError: null,
  probing: false,
  diagnosticsAutoOpen: false,
  setEngine: (engine) => set({ engine, engineError: null }),
  setEngineError: (message) => set({ engineError: message }),
  setProbing: (probing) => set({ probing }),
  setDiagnosticsAutoOpen: (value) => set({ diagnosticsAutoOpen: value }),
}));
