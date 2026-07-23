import { create } from "zustand";
import { cancelOperation } from "../api/commands";

export type OperationKind = "scan" | "preview" | "copy" | "save" | "config";

export interface ActiveOperation {
  id: string;
  kind: OperationKind;
  startedAt: number;
  message: string;
}

interface OperationState {
  active: Record<string, ActiveOperation>;
  start(operation: ActiveOperation): void;
  finish(id: string): void;
  cancel(id: string): Promise<void>;
}

export const useOperationStore = create<OperationState>((set, get) => ({
  active: {},

  start: (operation) =>
    set((state) => ({ active: { ...state.active, [operation.id]: operation } })),

  finish: (id) =>
    set((state) => {
      const next = { ...state.active };
      delete next[id];
      return { active: next };
    }),

  cancel: async (id) => {
    try {
      await cancelOperation(id);
    } finally {
      get().finish(id);
    }
  },
}));
