"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { API_ROOT } from "@/lib/api-base";

export interface ModelEntry {
  id: string;
  displayName: string;
  provider: string;
  contextWindow: number;
  description: string;
}

interface ModelsState {
  models: ModelEntry[];
  selectedModelId: string;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

interface ModelsActions {
  fetchModels: () => Promise<void>;
  setSelectedModel: (id: string) => void;
  getSelectedModel: () => ModelEntry | undefined;
}

const DEFAULT_MODEL_ID = "gpt-5.4-nano";

const initialState: ModelsState = {
  models: [],
  selectedModelId: DEFAULT_MODEL_ID,
  loaded: false,
  loading: false,
  error: null,
};

export const useModelsStore = create<ModelsState & ModelsActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      fetchModels: async () => {
        const { loaded, loading } = get();
        if (loaded || loading) return;

        set({ loading: true, error: null }, false, "fetchModels/start");

        try {
          const res = await fetch(`${API_ROOT}/models`, {
            credentials: "include",
          });

          if (!res.ok) {
            throw new Error(`Failed to fetch models: ${res.status}`);
          }

          // Wire shape (per platform `ModelResponseDto`): snake_case
          // `display_name` / `context_window`. The FE consumer uses
          // camelCase, so map at the boundary instead of casting blind —
          // the previous `as { models: ModelEntry[] }` silently rendered
          // `displayName: undefined` on every model, so the model picker
          // showed the raw `id` (e.g. "gpt-5-nano") in place of the
          // human-readable label ("GPT-5 Nano").
          const data = (await res.json()) as {
            models: Array<{
              id: string;
              display_name: string;
              provider: string;
              context_window: number;
              description: string;
            }>;
          };

          const models: ModelEntry[] = data.models.map((m) => ({
            id: m.id,
            displayName: m.display_name,
            provider: m.provider,
            contextWindow: m.context_window,
            description: m.description,
          }));

          set(
            {
              models,
              loaded: true,
              loading: false,
              // Keep current selection if it exists in the new list, otherwise pick first
              selectedModelId: models.find(
                (m) => m.id === get().selectedModelId,
              )
                ? get().selectedModelId
                : (models[0]?.id ?? DEFAULT_MODEL_ID),
            },
            false,
            "fetchModels/success",
          );
        } catch (err) {
          console.error("[stores/models] failed to fetch model list", err);
          set(
            {
              loading: false,
              error: err instanceof Error ? err.message : "Unknown error",
            },
            false,
            "fetchModels/error",
          );
        }
      },

      setSelectedModel: (id) =>
        set({ selectedModelId: id }, false, "setSelectedModel"),

      getSelectedModel: () => {
        const { models, selectedModelId } = get();
        return models.find((m) => m.id === selectedModelId);
      },
    }),
    { name: "models-store" },
  ),
);
