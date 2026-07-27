import { create } from "zustand";
import { devtools } from "zustand/middleware";

// Serializable document metadata (no editor refs)
export interface ActiveDocument {
  id: string;
  name: string;
  content: string;
  type: "document";
}

// Edit operation types that LLM can perform
export interface DocumentEdit {
  type: "replace" | "insert" | "delete" | "append";
  oldText?: string;
  newText?: string;
  position?: number;
  afterText?: string;
  beforeText?: string;
  content?: string;
}

// Result of an edit operation
export interface EditResult {
  success: boolean;
  message: string;
  previousContent?: string;
}

interface EditorState {
  activeDocument: ActiveDocument | null;
  setActiveDocument: (doc: ActiveDocument | null) => void;
}

export const useEditorStore = create<EditorState>()(
  devtools(
    (set) => ({
      activeDocument: null,
      setActiveDocument: (doc) =>
        set({ activeDocument: doc }, false, "setActiveDocument"),
    }),
    { name: "editor" },
  ),
);
