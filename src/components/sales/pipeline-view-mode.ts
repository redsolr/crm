"use client";

/**
 * Persisted Pipeline layout mode (Inbox / Table / Board) — an EXTERNAL
 * store (module value backed by localStorage) read via
 * `useSyncExternalStore`, so the server snapshot and the first client
 * render agree hydration-safely (no setState-in-effect rehydration).
 *
 * INBOX is the first-run default (founder 2026-08-08 — with the
 * ambient digest the Inbox is the morning cockpit and the first tab in
 * the strip; supersedes the 2026-07-18 table default). Table/board are
 * opt-ins that persist per user, so whoever ends the day on the Table
 * starts there tomorrow. A stored value from the retired Summary tab
 * (or any junk) falls back to the inbox default.
 *
 * Lives outside `SalesPipelineView` so navigation surfaces (command
 * palette, search suggestions, the /sales/inbox redirect) can select
 * the Inbox tab without importing the whole view.
 */

import { useSyncExternalStore } from "react";

export const PIPELINE_VIEW_MODE_STORAGE_KEY = "crm-pipeline-view-mode";

export type PipelineViewMode = "inbox" | "kanban" | "table";

const listeners = new Set<() => void>();
let cache: PipelineViewMode | null = null;

function readStoredViewMode(): PipelineViewMode {
  if (cache === null) {
    try {
      const stored = window.localStorage.getItem(
        PIPELINE_VIEW_MODE_STORAGE_KEY,
      );
      cache = stored === "kanban" || stored === "table" ? stored : "inbox";
    } catch (err) {
      console.warn(
        "[pipeline-view-mode] could not read persisted view mode:",
        err,
      );
      cache = "inbox";
    }
  }
  return cache;
}

function subscribeToViewMode(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function setPipelineViewMode(mode: PipelineViewMode): void {
  cache = mode;
  try {
    window.localStorage.setItem(PIPELINE_VIEW_MODE_STORAGE_KEY, mode);
  } catch (err) {
    console.warn(
      "[pipeline-view-mode] could not persist view mode:",
      err,
    );
  }
  for (const listener of listeners) listener();
}

/** Reactive read — re-renders the caller on every mode change. */
export function usePipelineViewMode(): PipelineViewMode {
  return useSyncExternalStore(
    subscribeToViewMode,
    readStoredViewMode,
    // Server snapshot mirrors the client default (inbox) so hydration
    // never flashes another layout for first-run users.
    () => "inbox" as PipelineViewMode,
  );
}
