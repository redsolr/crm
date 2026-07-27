"use client";

import { useSettingsSync } from "./use-settings-sync";

/**
 * Invisible component that eagerly loads user settings (subscription, usage)
 * into the Zustand store right after auth completes. Renders nothing.
 */
export function SettingsSync() {
  useSettingsSync();
  return null;
}
