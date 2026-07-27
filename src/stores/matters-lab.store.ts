import { create } from "zustand";

/**
 * "Matters Lab" — THE explorer.
 *
 * Owns the explorer tab: its left panel is MattersLabExplorer and its middle
 * panel is MattersLabMain (right panel stays the shared ChatSidebar). Matters,
 * tasks, and the folders/notes nested inside them are real `work_items` /
 * `folders` / `pages` — see `matters-lab/useMatters` + `useMatterContents`,
 * which own the data + mutations. This store holds ONLY UI selection state
 * (which matter / object / task / note is open, pinned matters, URL sync).
 *
 * `enabled` is retained as a constant `true` for the panes that still read it;
 * there is no off state (the old experimental flag + FileExplorer fallback were
 * retired when the Lab graduated to the default explorer).
 */
const LS_PIN_KEY = "matters-lab-pinned";
const NOTES_PATH = "/matters";

function readPinned(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_PIN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch (err) {
    console.warn("[matters-lab] ignoring corrupt pinned-matters cache:", err);
    return [];
  }
}

function writePinned(ids: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_PIN_KEY, JSON.stringify(ids));
}

interface MattersLabUrlState {
  activeTab: MattersTab;
  selectedMatterId: string | null;
  selectedObjectId: string | null;
  selectedTaskId: string | null;
}

function readUrlState(): MattersLabUrlState {
  if (typeof window === "undefined") {
    return {
      activeTab: "active",
      selectedMatterId: null,
      selectedObjectId: null,
      selectedTaskId: null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const activeTab = params.get("tab") === "completed" ? "completed" : "active";
  const selectedMatterId = params.get("matter");
  const selectedObjectId = params.get("object");
  const selectedTaskId = params.get("task");

  return {
    activeTab,
    selectedMatterId,
    selectedObjectId: selectedTaskId !== null && selectedObjectId === null
      ? "tasks"
      : selectedObjectId,
    selectedTaskId,
  };
}

function pushUrl(state: MattersLabState, replace = false): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams();
  if (state.activeTab !== "active") params.set("tab", state.activeTab);
  if (state.selectedMatterId !== null) {
    params.set("matter", state.selectedMatterId);
  }
  if (state.selectedObjectId !== null) {
    params.set("object", state.selectedObjectId);
  }
  if (state.selectedTaskId !== null) {
    params.set("task", state.selectedTaskId);
  }

  const qs = params.toString();
  const url = qs ? `${NOTES_PATH}?${qs}` : NOTES_PATH;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === url) return;
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}

/** Explorer top tabs — matters split by lifecycle. */
export type MattersTab = "active" | "completed";

interface MattersLabState {
  /** Always `true` — the Lab is the explorer. Retained for the panes that read
   *  it; there is no off state since the experimental flag was retired. */
  enabled: boolean;
  /** Which explorer tab is shown (Active vs Completed matters). */
  activeTab: MattersTab;
  /** Currently open matter (folder). null = no matter selected. */
  selectedMatterId: string | null;
  /** Open object inside the matter. null = the matter's Overview (main file). */
  selectedObjectId: string | null;
  /** Selected individual task — opens the task detail panel. */
  selectedTaskId: string | null;
  /** Open note (page) nested under the matter — opens the document editor in
   *  the middle pane. null = no note open. Mutually exclusive with object/task
   *  selection. */
  selectedNoteId: string | null;
  /** Open client conversation (communication thread) nested under the matter —
   *  opens the chat in the middle pane. null = none open. Mutually exclusive
   *  with object/task/note selection. */
  selectedThreadId: string | null;
  /** Matter ids pinned to the top of the explorer (persisted, per-browser). */
  pinnedMatterIds: string[];

  /** Pin / unpin a matter to the top of the explorer. */
  togglePin: (matterId: string) => void;
  /** Apply any deep-link URL state (matter/object/task) on mount, client only.
   *  Kept out of the initializer so SSR + first client render agree. */
  hydrate: () => void;
  /** Apply browser back/forward or pasted `/matters?matter=...` URLs. */
  syncFromUrl: () => void;
  setTab: (tab: MattersTab) => void;
  /** Open a matter → shows its Overview (object cleared). */
  selectMatter: (matterId: string | null) => void;
  /** Open a specific object inside a matter (overview / board / lens / …). */
  selectObject: (matterId: string, objectId: string | null) => void;
  /** Open the detail panel for one task. */
  selectTask: (matterId: string, objectId: string, taskId: string) => void;
  /** Open a note (page) nested under a matter in the document editor. */
  selectNote: (matterId: string, noteId: string) => void;
  /** Open a client conversation (thread) nested under a matter in the chat pane. */
  selectThread: (matterId: string, threadId: string) => void;
}

export const useMattersLab = create<MattersLabState>((set, get) => ({
  enabled: true,
  activeTab: "active",
  selectedMatterId: null,
  selectedObjectId: null,
  selectedTaskId: null,
  selectedNoteId: null,
  selectedThreadId: null,
  pinnedMatterIds: [],
  togglePin: (matterId) => {
    const cur = get().pinnedMatterIds;
    const next = cur.includes(matterId)
      ? cur.filter((id) => id !== matterId)
      : [...cur, matterId];
    writePinned(next);
    set({ pinnedMatterIds: next });
  },
  hydrate: () => {
    const url = readUrlState();
    set({
      enabled: true,
      activeTab: url.activeTab,
      selectedMatterId: url.selectedMatterId,
      selectedObjectId: url.selectedObjectId,
      selectedTaskId: url.selectedTaskId,
      selectedNoteId: null,
      selectedThreadId: null,
      pinnedMatterIds: readPinned(),
    });
  },
  syncFromUrl: () => {
    const url = readUrlState();
    set({
      enabled: true,
      activeTab: url.activeTab,
      selectedMatterId: url.selectedMatterId,
      selectedObjectId: url.selectedObjectId,
      selectedTaskId: url.selectedTaskId,
      selectedNoteId: null,
      selectedThreadId: null,
    });
  },
  setTab: (tab) => {
    set({ activeTab: tab });
    pushUrl(get());
  },
  selectMatter: (matterId) => {
    set({
      selectedMatterId: matterId,
      selectedObjectId: null,
      selectedTaskId: null,
      selectedNoteId: null,
      selectedThreadId: null,
    });
    pushUrl(get());
  },
  selectObject: (matterId, objectId) => {
    set({
      selectedMatterId: matterId,
      selectedObjectId: objectId,
      selectedTaskId: null,
      selectedNoteId: null,
      selectedThreadId: null,
    });
    pushUrl(get());
  },
  selectTask: (matterId, objectId, taskId) => {
    set({
      selectedMatterId: matterId,
      selectedObjectId: objectId,
      selectedTaskId: taskId,
      selectedNoteId: null,
      selectedThreadId: null,
    });
    pushUrl(get());
  },
  selectNote: (matterId, noteId) => {
    // A note takes over the middle pane (document editor); clear object/task so
    // MattersLabMain renders the note, not a matter view. Not URL-synced yet —
    // notes aren't deep-linkable, so we don't push a `note` param.
    set({
      selectedMatterId: matterId,
      selectedObjectId: null,
      selectedTaskId: null,
      selectedNoteId: noteId,
      selectedThreadId: null,
    });
  },
  selectThread: (matterId, threadId) => {
    // A client conversation takes over the middle pane (chat); clear
    // object/task/note so it's mutually exclusive with those selections.
    // Not URL-synced yet — threads aren't deep-linkable from the lab.
    set({
      selectedMatterId: matterId,
      selectedObjectId: null,
      selectedTaskId: null,
      selectedNoteId: null,
      selectedThreadId: threadId,
    });
  },
}));
