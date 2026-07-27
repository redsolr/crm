import { create } from "zustand";

/**
 * Shared filter + selection state for the Knowledge Graph view.
 *
 * Why Zustand and not prop drilling: the filter controls live in the
 * left Sidebar (`KnowledgeGraphExplorer`) while the canvas + details
 * panel live in the main content area (`KnowledgeGraphView`). Both
 * trees need to read/write the same filter state, and they're
 * rendered as siblings inside `AppLayout` — no shared ancestor to
 * thread props through. Zustand matches the pattern other shared
 * view state uses (see `activity-bar.store.ts`, `ui.store.ts`).
 *
 * Nothing here is persisted; filters reset on reload by design —
 * users shouldn't land on a filtered view they forgot they set.
 */
export interface SelectedGraphNode {
  id: string;
  attributes: {
    label: string;
    entity_type: string;
    description?: string | null;
    mention_count: number;
    community_id: number | null;
    color: string;
    size: number;
    origin: "structural" | "extracted" | "manual";
  };
}

interface KnowledgeGraphFilters {
  project_id: string | undefined;
  sinceDays: number | undefined;
  communityId: number | undefined;
}

/** A mention the user has clicked open. Drives the floating overlay
 *  that lays a task/page detail on top of the canvas (left of the
 *  entity-detail panel) without pushing the canvas. Mirrors the wire
 *  shape of `EntityMention` (snake_case per platform convention). */
export interface OpenMention {
  source_type: string;
  source_id: string;
}

/** Right-click context-menu state. `target='node'` means a specific
 *  graph entity was right-clicked; `target='stage'` means empty
 *  canvas. Coords are viewport-relative (clientX/clientY) so the
 *  menu can portal to document.body without translation. */
export interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  target: "node" | "stage";
  nodeId?: string;
  /** Snapshot of node attributes — saves a re-fetch and lets the
   *  menu render origin-gated items (Edit only on manual, etc.)
   *  without waiting for `useEntityDetail`. */
  nodeAttributes?: SelectedGraphNode["attributes"];
}

interface KnowledgeGraphState extends KnowledgeGraphFilters {
  selected: SelectedGraphNode | null;
  openMention: OpenMention | null;
  contextMenu: ContextMenuState | null;
  setProjectId: (id: string | undefined) => void;
  setSinceDays: (days: number | undefined) => void;
  setCommunityId: (id: number | undefined) => void;
  setSelected: (node: SelectedGraphNode | null) => void;
  setOpenMention: (mention: OpenMention | null) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  resetFilters: () => void;
}

const INITIAL_FILTERS: KnowledgeGraphFilters = {
  project_id: undefined,
  sinceDays: undefined,
  communityId: undefined,
};

export const useKnowledgeGraphStore = create<KnowledgeGraphState>((set) => ({
  ...INITIAL_FILTERS,
  selected: null,
  openMention: null,
  contextMenu: null,
  setProjectId: (project_id) => set({ project_id }),
  setSinceDays: (sinceDays) => set({ sinceDays }),
  setCommunityId: (communityId) => set({ communityId }),
  setSelected: (selected) =>
    set((s) => {
      // Closing the entity panel (or switching to a new entity) also
      // dismisses the floating mention — its anchor is gone. Same
      // for the context menu (it's anchored to a specific node).
      if (selected == null || selected.id !== s.selected?.id) {
        return { selected, openMention: null, contextMenu: null };
      }
      return { selected };
    }),
  setOpenMention: (openMention) => set({ openMention }),
  setContextMenu: (contextMenu) => set({ contextMenu }),
  resetFilters: () => set({ ...INITIAL_FILTERS }),
}));
