"use client";

/**
 * Client checklists — per-matter lists managed from the matter panel.
 * Thin react-query wrapper over `matterChecklistsApi`; every mutation
 * returns the server's fresh checklist so the cache is replaced, never
 * guessed.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  matterChecklistsApi,
  type ChecklistPreset,
  type MatterChecklist,
  type MatterChecklistEnvelope,
} from "@/lib/matter-checklists/matter-checklists-api";

export function useMatterChecklists(matterId: string | null): {
  checklists: MatterChecklist[];
  presets: ChecklistPreset[];
  isLoading: boolean;
  createChecklist: (input: {
    title: string;
    items: { title: string }[];
    notifyClient: boolean;
  }) => Promise<MatterChecklistEnvelope>;
  removeChecklist: (id: string) => Promise<void>;
  addItem: (checklistId: string, title: string) => Promise<void>;
  setItemCompleted: (
    checklistId: string,
    itemId: string,
    completed: boolean,
  ) => Promise<MatterChecklistEnvelope>;
  removeItem: (checklistId: string, itemId: string) => Promise<void>;
} {
  const queryClient = useQueryClient();
  const queryKey = ["matter-checklists", matterId];

  const query = useQuery({
    queryKey,
    queryFn: () => matterChecklistsApi.list(matterId ?? ""),
    enabled: matterId != null,
    staleTime: 30 * 1000,
  });

  // Presets are static in-repo definitions — cache them long.
  const presetsQuery = useQuery({
    queryKey: ["matter-checklist-presets"],
    queryFn: () => matterChecklistsApi.listPresets(),
    staleTime: 60 * 60 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: (input: {
      title: string;
      items: { title: string }[];
      notifyClient: boolean;
    }) =>
      matterChecklistsApi.create({
        matter_id: matterId ?? "",
        title: input.title,
        items: input.items,
        notify_client: input.notifyClient,
      }),
    onSuccess: invalidate,
    onError: (err) => {
      console.error("[use-matter-checklists] create failed:", err);
    },
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => matterChecklistsApi.remove(id),
    onSuccess: invalidate,
    onError: (err) => {
      console.error("[use-matter-checklists] remove failed:", err);
    },
  });
  const addItemMutation = useMutation({
    mutationFn: (input: { checklistId: string; title: string }) =>
      matterChecklistsApi.addItem(input.checklistId, input.title),
    onSuccess: invalidate,
    onError: (err) => {
      console.error("[use-matter-checklists] add item failed:", err);
    },
  });
  const setCompletedMutation = useMutation({
    mutationFn: (input: {
      checklistId: string;
      itemId: string;
      completed: boolean;
    }) =>
      matterChecklistsApi.setItemCompleted(
        input.checklistId,
        input.itemId,
        input.completed,
      ),
    onSuccess: invalidate,
    onError: (err) => {
      console.error("[use-matter-checklists] item toggle failed:", err);
    },
  });
  const removeItemMutation = useMutation({
    mutationFn: (input: { checklistId: string; itemId: string }) =>
      matterChecklistsApi.removeItem(input.checklistId, input.itemId),
    onSuccess: invalidate,
    onError: (err) => {
      console.error("[use-matter-checklists] remove item failed:", err);
    },
  });

  return {
    checklists: query.data ?? [],
    presets: presetsQuery.data ?? [],
    isLoading: query.isLoading,
    createChecklist: (input) => createMutation.mutateAsync(input),
    removeChecklist: async (id) => {
      await removeMutation.mutateAsync(id);
    },
    addItem: async (checklistId, title) => {
      await addItemMutation.mutateAsync({ checklistId, title });
    },
    setItemCompleted: (checklistId, itemId, completed) =>
      setCompletedMutation.mutateAsync({ checklistId, itemId, completed }),
    removeItem: async (checklistId, itemId) => {
      await removeItemMutation.mutateAsync({ checklistId, itemId });
    },
  };
}
