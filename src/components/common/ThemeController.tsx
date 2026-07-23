import { useEffect } from "react";
import {
  CUSTOM_THEME_TOKENS,
  useUiSettingsStore,
} from "../../state/uiSettingsStore";

export function ThemeController() {
  const theme = useUiSettingsStore((state) => state.theme);
  const customTheme = useUiSettingsStore((state) => state.customTheme);
  const density = useUiSettingsStore((state) => state.density);
  const reduceMotion = useUiSettingsStore((state) => state.reduceMotion);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function applyTheme() {
      for (const token of CUSTOM_THEME_TOKENS) {
        root.style.removeProperty(`--${token}`);
      }

      let resolvedTheme = theme;

      if (theme === "system") {
        resolvedTheme = media.matches ? "dark" : "light";
      }

      if (theme === "custom") {
        resolvedTheme = customTheme?.mode ?? "light";
      }

      root.dataset.theme = resolvedTheme;
      root.dataset.density = density;
      root.dataset.reduceMotion = String(reduceMotion);

      if (theme === "custom" && customTheme) {
        for (const [token, value] of Object.entries(customTheme.colors)) {
          if (value) {
            root.style.setProperty(`--${token}`, value);
          }
        }
      }
    }

    applyTheme();

    if (theme === "system") {
      media.addEventListener("change", applyTheme);
      return () => media.removeEventListener("change", applyTheme);
    }

    return undefined;
  }, [theme, customTheme, density, reduceMotion]);

  return null;
}