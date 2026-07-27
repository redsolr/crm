"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { favoritesApi, Favorite, FavoriteTargetType } from "@/lib/favoritesApi";
import { useAuthStore } from "@/stores/auth.store";

// ============================================================================
// Query: Fetch favorites list
// ============================================================================

export function useFavorites() {
  const isAuthenticated = useAuthStore((s) => !!s.user);

  return useQuery({
    queryKey: queryKeys.favorites.list(),
    queryFn: async () => {
      const response = await favoritesApi.list();
      return response.data;
    },
    enabled: isAuthenticated,
  });
}

// ============================================================================
// Mutation: Add favorite
// ============================================================================

export function useAddFavorite() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.favorites.list();

  return useMutation({
    mutationFn: async ({
      targetId,
      targetType,
      name,
    }: {
      targetId: string;
      targetType: FavoriteTargetType;
      name: string;
    }) => {
      const response = await favoritesApi.add({
        target_id: targetId,
        target_type: targetType,
      });
      return response.data;
    },
    onMutate: async ({ targetId, targetType, name }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Favorite[]>(queryKey);

      // Don't add duplicates
      if (previous?.some((f) => f.targetId === targetId)) {
        return { previous };
      }

      const optimistic: Favorite = {
        // Temp placeholder ID — not a real wire ID; widened via cast.
        id: `temp-${Date.now()}` as Favorite["id"],
        targetId,
        targetType,
        position: (previous?.length ?? 0) + 1,
        name,
        icon: null,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<Favorite[]>(queryKey, [
        ...(previous ?? []),
        optimistic,
      ]);

      return { previous };
    },
    onSuccess: (newFavorite) => {
      // Replace any temp item with the real one from the server
      queryClient.setQueryData<Favorite[]>(queryKey, (old) => {
        if (!old) return [newFavorite];
        const withoutDups = old.filter(
          (f) => f.targetId !== newFavorite.targetId || f.id === newFavorite.id,
        );
        if (withoutDups.some((f) => f.id === newFavorite.id)) {
          return withoutDups;
        }
        return [...withoutDups, newFavorite];
      });
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.favorites.all,
      });
    },
  });
}

// ============================================================================
// Mutation: Remove favorite by favorite ID
// ============================================================================

export function useRemoveFavorite() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.favorites.list();

  return useMutation({
    mutationFn: async (favoriteId: string) => {
      await favoritesApi.remove(favoriteId);
    },
    onMutate: async (favoriteId: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Favorite[]>(queryKey);

      queryClient.setQueryData<Favorite[]>(
        queryKey,
        (old) => old?.filter((f) => f.id !== favoriteId) ?? [],
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.favorites.all,
      });
    },
  });
}

// ============================================================================
// Mutation: Remove favorite by target ID (for "unfavorite" in context menus)
// ============================================================================

export function useRemoveFavoriteByTarget() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.favorites.list();

  return useMutation({
    mutationFn: async (targetId: string) => {
      await favoritesApi.removeByTarget(targetId);
    },
    onMutate: async (targetId: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Favorite[]>(queryKey);

      queryClient.setQueryData<Favorite[]>(
        queryKey,
        (old) => old?.filter((f) => f.targetId !== targetId) ?? [],
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.favorites.all,
      });
    },
  });
}

// ============================================================================
// Mutation: Reorder favorites
// ============================================================================

export function useReorderFavorites() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.favorites.list();

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await favoritesApi.reorder({
        order: orderedIds.map((id) => ({ id })),
      });
    },
    onMutate: async (orderedIds: string[]) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Favorite[]>(queryKey);

      if (previous) {
        // Map keys widened to plain string for the orderedIds lookup
        // (orderedIds is `string[]` from the caller, before type-narrowing).
        const favoriteMap = new Map<string, Favorite>(
          previous.map((f) => [f.id, f]),
        );
        const reordered: Favorite[] = [];

        for (let i = 0; i < orderedIds.length; i++) {
          const fav = favoriteMap.get(orderedIds[i]);
          if (fav) {
            reordered.push({ ...fav, position: i + 1 });
          }
        }

        queryClient.setQueryData<Favorite[]>(queryKey, reordered);
      }

      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.favorites.all,
      });
    },
  });
}
