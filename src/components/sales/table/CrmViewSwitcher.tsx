"use client";

/**
 * Saved-view switcher — the compact `/api/views` control in a CRM table
 * header. Lists the caller's saved views for one CRM surface, applies
 * one on pick, saves the current filter+sort state under a name, and
 * deletes the active view.
 *
 * Platform contract: `/api/views` only accepts `kind: 'work_items'`;
 * the CRM surface discriminator (`crm_companies` / `crm_pipeline`)
 * lives inside the opaque `query` blob (see table-model.ts
 * `buildViewQuery` / `parseViewQuery`). Views from other surfaces —
 * including the web-app's board views on the same kind — are filtered
 * out client-side.
 */

import { useState } from "react";
import { useSavedViews } from "@/queries/views/use-saved-views";
import {
  buildViewQuery,
  isSurfaceView,
  parseViewQuery,
  type CrmTableSurface,
  type CrmTableViewState,
} from "./table-model";

interface Props {
  surface: CrmTableSurface;
  /** Current table state — serialized into the blob on save. */
  state: CrmTableViewState;
  /** Restores state when a view is applied (or the default is picked). */
  onApplyState: (state: CrmTableViewState) => void;
  /** State applied when switching back to the built-in default view. */
  defaultState: CrmTableViewState;
  testIdPrefix: string;
}

export function CrmViewSwitcher({
  surface,
  state,
  onApplyState,
  defaultState,
  testIdPrefix,
}: Props) {
  const { views, isLoading, isSaving, saveView, removeView } =
    useSavedViews("work_items");
  const surfaceViews = views.filter((v) => isSurfaceView(v, surface));

  const [activeViewId, setActiveViewId] = useState("");
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  function applyView(viewId: string) {
    setActiveViewId(viewId);
    if (viewId === "") {
      onApplyState(defaultState);
      return;
    }
    const view = surfaceViews.find((v) => v.id === viewId);
    if (!view) {
      console.warn(
        `[CrmViewSwitcher] saved view ${viewId} not found for surface ${surface}`,
      );
      return;
    }
    const parsed = parseViewQuery(view.query, surface);
    if (parsed) {
      onApplyState(parsed);
    } else {
      console.warn(
        `[CrmViewSwitcher] saved view ${viewId} has an unreadable query blob; keeping current state`,
      );
    }
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (trimmed === "") return;
    // saveView logs + resolves null on failure (never throws).
    const created = await saveView(trimmed, buildViewQuery(surface, state));
    if (created) {
      setActiveViewId(created.id);
      setNaming(false);
      setName("");
    }
  }

  async function handleDelete() {
    if (activeViewId === "") return;
    const removed = await removeView(activeViewId);
    if (removed) {
      setActiveViewId("");
      onApplyState(defaultState);
    }
  }

  return (
    <div
      className="crm-view-switcher"
      data-testid={`${testIdPrefix}-view-switcher`}
    >
      <select
        className="crm-view-switcher-select"
        data-testid={`${testIdPrefix}-view-select`}
        value={activeViewId}
        disabled={isLoading}
        onChange={(e) => applyView(e.target.value)}
        aria-label="Saved view"
      >
        <option value="">Default view</option>
        {surfaceViews.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>

      {naming ? (
        <>
          <input
            className="crm-view-switcher-name-input"
            data-testid={`${testIdPrefix}-view-name-input`}
            type="text"
            placeholder="View name…"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSave();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setNaming(false);
                setName("");
              }
            }}
          />
          <button
            type="button"
            className="crm-btn-ghost crm-btn-xs"
            data-testid={`${testIdPrefix}-view-save-confirm`}
            disabled={name.trim() === "" || isSaving}
            onClick={() => void handleSave()}
          >
            Save
          </button>
        </>
      ) : (
        <button
          type="button"
          className="crm-btn-ghost crm-btn-xs"
          data-testid={`${testIdPrefix}-view-save`}
          onClick={() => setNaming(true)}
          title="Save the current filters + sort as a view"
        >
          Save view
        </button>
      )}

      {activeViewId !== "" && (
        <button
          type="button"
          className="crm-btn-ghost crm-btn-xs"
          data-testid={`${testIdPrefix}-view-delete`}
          onClick={() => void handleDelete()}
          title="Delete this saved view"
        >
          Delete
        </button>
      )}
    </div>
  );
}
