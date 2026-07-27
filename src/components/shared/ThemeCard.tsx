"use client";

import type { ThemeMode } from "@/stores/use-theme";

/**
 * Color-mode picker card — ported from web-app's settings primitives
 * (`src/components/settings/primitives.tsx` § ThemeCard) so the CRM's
 * Settings page offers the same light / auto / dark choice. The preview
 * swatches are intentionally hardcoded: each card depicts the theme it
 * selects, not the theme currently active.
 */
export function ThemeCard({
  mode,
  active,
  onClick,
}: {
  mode: ThemeMode;
  active: boolean;
  onClick: () => void;
}) {
  const labels: Record<ThemeMode, string> = {
    light: "Light",
    dark: "Dark",
    system: "Auto",
  };
  const isLight = mode === "light";
  const isSystem = mode === "system";

  const barBg = isLight ? "#e8e0d4" : "#2d2d2d";
  const contentBg = isLight ? "#fff" : "#242424";
  const bgOuter = isLight ? "#f5f0e8" : "#1a1a1a";

  return (
    <button
      onClick={onClick}
      className={`settings-theme-card flex flex-col items-center gap-2 ${active ? "opacity-100" : "opacity-60 hover:opacity-80"}`}
      data-testid={`theme-card-${mode}`}
    >
      <div
        className={`w-[96px] h-[64px] md:w-[120px] md:h-[80px] rounded-lg overflow-hidden border-2 transition-colors ${active ? "border-[var(--theme-accent-purple,#7c3aed)]" : "border-transparent"}`}
        style={{ backgroundColor: bgOuter }}
      >
        {isSystem ? (
          /* Auto/System: split preview — light left half, dark right half */
          <div className="flex h-full">
            <div className="w-1/2 flex h-full overflow-hidden">
              <div
                className="w-[30%] h-full"
                style={{ backgroundColor: "#e8e0d4" }}
              />
              <div
                className="flex-1 p-1.5 flex flex-col gap-1"
                style={{ backgroundColor: "#fff" }}
              >
                <div
                  className="h-1.5 w-3/4 rounded-sm"
                  style={{ backgroundColor: "#e8e0d4" }}
                />
                <div
                  className="h-1.5 w-1/2 rounded-sm"
                  style={{ backgroundColor: "#e8e0d4" }}
                />
              </div>
            </div>
            <div className="w-1/2 flex h-full overflow-hidden">
              <div
                className="w-[30%] h-full"
                style={{ backgroundColor: "#2d2d2d" }}
              />
              <div
                className="flex-1 p-1.5 flex flex-col gap-1"
                style={{ backgroundColor: "#242424" }}
              >
                <div
                  className="h-1.5 w-3/4 rounded-sm"
                  style={{ backgroundColor: "#2d2d2d" }}
                />
                <div
                  className="h-1.5 w-1/2 rounded-sm"
                  style={{ backgroundColor: "#2d2d2d" }}
                />
                <div className="flex-1" />
                <div className="flex items-center gap-1">
                  <div
                    className="flex-1 h-3 rounded-sm"
                    style={{ backgroundColor: "#2d2d2d" }}
                  />
                  <div className="w-3 h-3 rounded-sm bg-amber-600" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Light / Dark: full preview */
          <div className="flex h-full">
            <div
              className="w-[30%] h-full"
              style={{ backgroundColor: barBg }}
            />
            <div
              className="flex-1 p-2 flex flex-col gap-1"
              style={{ backgroundColor: contentBg }}
            >
              <div
                className="h-1.5 w-3/4 rounded-sm"
                style={{ backgroundColor: barBg }}
              />
              <div
                className="h-1.5 w-1/2 rounded-sm"
                style={{ backgroundColor: barBg }}
              />
              <div className="flex-1" />
              <div className="flex items-center gap-1">
                <div
                  className="flex-1 h-3 rounded-sm"
                  style={{ backgroundColor: barBg }}
                />
                <div className="w-3 h-3 rounded-sm bg-amber-600" />
              </div>
            </div>
          </div>
        )}
      </div>
      <span className="text-xs text-[var(--theme-text-secondary)]">
        {labels[mode]}
      </span>
    </button>
  );
}
