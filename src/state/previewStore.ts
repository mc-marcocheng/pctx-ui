import { create } from "zustand";
import type { ContextFile, FileError, GenerateResponse, OutputFormat, Stats } from "../api/types";

export type PreviewStatus = "empty" | "generating" | "current" | "stale" | "partial" | "error";

interface PreviewState {
  content: string;
  format: OutputFormat;
  files: ContextFile[];
  stats?: Stats;
  errors: FileError[];
  generatedAt?: number;
  inputFingerprint?: string;
  status: PreviewStatus;
  errorMessage?: string;

  begin(): void;
  complete(response: GenerateResponse, fingerprint: string): void;
  markStale(): void;
  fail(message: string): void;
  clear(): void;
}

export const usePreviewStore = create<PreviewState>((set, get) => ({
  content: "",
  format: "markdown",
  files: [],
  errors: [],
  status: "empty",

  begin: () => set({ status: "generating", errorMessage: undefined }),

  complete: (response, fingerprint) => {
    if (response.status === "error") {
      set({
        status: "error",
        errors: response.errors,
        errorMessage: response.errors[0]?.message ?? "Generation failed.",
        stats: response.stats,
      });
      return;
    }

    set({
      content: response.context?.content ?? "",
      format: response.context?.format ?? "markdown",
      files: response.context?.files ?? [],
      stats: response.stats,
      errors: response.errors,
      generatedAt: Date.now(),
      inputFingerprint: fingerprint,
      status: response.status === "partial" ? "partial" : "current",
      errorMessage: undefined,
    });
  },

  markStale: () => {
    if (get().status === "empty" || get().status === "generating") return;
    set({ status: "stale" });
  },

  fail: (message) => set({ status: "error", errorMessage: message }),

  clear: () =>
    set({
      content: "",
      files: [],
      stats: undefined,
      errors: [],
      generatedAt: undefined,
      inputFingerprint: undefined,
      status: "empty",
      errorMessage: undefined,
    }),
}));
