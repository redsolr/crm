import { useThemeStore, type ThemeMode } from "./theme.store";

export function useTheme() {
  const mode = useThemeStore((s) => s.mode);
  const resolved = useThemeStore((s) => s.resolved);
  const setMode = useThemeStore((s) => s.setMode);

  return {
    mode,
    resolved,
    setMode,
    isDark: resolved === "dark",
    isLight: resolved === "light",
  };
}

export type { ThemeMode };
