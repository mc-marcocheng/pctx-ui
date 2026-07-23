import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UiTheme =
  | "system"
  | "light"
  | "dark"
  | "dracula"
  | "nord"
  | "solarized-dark"
  | "custom";

export type UiDensity = "comfortable" | "compact";
export type ThemeMode = "light" | "dark";

export const CUSTOM_THEME_TOKENS = [
  "bg",
  "surface",
  "surface-raised",
  "surface-subtle",
  "surface-hover",
  "text",
  "text-muted",
  "text-subtle",
  "border",
  "border-strong",
  "primary",
  "primary-hover",
  "primary-text",
  "warning-bg",
  "warning-text",
  "error-bg",
  "error-text",
  "count-bg",
  "count-text",
  "editor-bg",
  "editor-gutter",
  "overlay",
  "scrollbar-thumb",
  "scrollbar-thumb-hover",

  "syntax-comment",
  "syntax-keyword",
  "syntax-string",
  "syntax-number",
  "syntax-function",
  "syntax-variable",
  "syntax-type",
  "syntax-tag",
  "syntax-attribute",
  "syntax-meta",
  "syntax-invalid",
] as const;

export type CustomThemeToken = (typeof CUSTOM_THEME_TOKENS)[number];

export interface CustomTheme {
  schemaVersion: 1;
  name: string;
  mode: ThemeMode;
  colors: Partial<Record<CustomThemeToken, string>>;
}

interface UiSettingsState {
  theme: UiTheme;
  customTheme: CustomTheme | null;
  density: UiDensity;
  editorLineWrapping: boolean;
  reduceMotion: boolean;

  setTheme: (theme: UiTheme) => void;
  setCustomTheme: (theme: CustomTheme | null) => void;
  setDensity: (density: UiDensity) => void;
  setEditorLineWrapping: (value: boolean) => void;
  setReduceMotion: (value: boolean) => void;
  resetUiSettings: () => void;
}

export const useUiSettingsStore = create<UiSettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      customTheme: null,
      density: "comfortable",
      editorLineWrapping: false,
      reduceMotion: false,

      setTheme: (theme) => set({ theme }),

      setCustomTheme: (customTheme) =>
        set({
          customTheme,
          theme: customTheme ? "custom" : "system",
        }),

      setDensity: (density) => set({ density }),
      setEditorLineWrapping: (editorLineWrapping) =>
        set({ editorLineWrapping }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),

      resetUiSettings: () =>
        set({
          theme: "system",
          customTheme: null,
          density: "comfortable",
          editorLineWrapping: false,
          reduceMotion: false,
        }),
    }),
    {
      name: "pctx-ui-settings-v1",
    },
  ),
);

export function parseCustomTheme(value: unknown): CustomTheme {
  if (!value || typeof value !== "object") {
    throw new Error("The theme file must contain a JSON object.");
  }

  const candidate = value as Record<string, unknown>;

  if (candidate.schemaVersion !== 1) {
    throw new Error("Unsupported theme schema version.");
  }

  if (typeof candidate.name !== "string" || !candidate.name.trim()) {
    throw new Error("The theme must have a non-empty name.");
  }

  if (candidate.mode !== "light" && candidate.mode !== "dark") {
    throw new Error('Theme mode must be either "light" or "dark".');
  }

  if (
    !candidate.colors ||
    typeof candidate.colors !== "object" ||
    Array.isArray(candidate.colors)
  ) {
    throw new Error("Theme colors must be a JSON object.");
  }

  const allowedTokens = new Set<string>(CUSTOM_THEME_TOKENS);
  const colors: Partial<Record<CustomThemeToken, string>> = {};

  for (const [token, rawValue] of Object.entries(
    candidate.colors as Record<string, unknown>,
  )) {
    if (!allowedTokens.has(token)) {
      throw new Error(`Unknown theme color token: ${token}`);
    }

    if (typeof rawValue !== "string" || !isSafeCssColor(rawValue)) {
      throw new Error(`Invalid CSS color for theme token: ${token}`);
    }

    colors[token as CustomThemeToken] = rawValue;
  }

  if (Object.keys(colors).length === 0) {
    throw new Error("The theme must override at least one color.");
  }

  return {
    schemaVersion: 1,
    name: candidate.name.trim(),
    mode: candidate.mode,
    colors,
  };
}

function isSafeCssColor(value: string): boolean {
  const normalized = value.trim();

  if (
    normalized.length === 0 ||
    normalized.length > 100 ||
    /[;{}]/.test(normalized) ||
    /url\s*\(/i.test(normalized)
  ) {
    return false;
  }

  if (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function"
  ) {
    return CSS.supports("color", normalized);
  }

  return /^(#[0-9a-f]{3,8}|rgba?\(.+\)|hsla?\(.+\)|[a-z]+)$/i.test(
    normalized,
  );
}