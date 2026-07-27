"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/queries/query-keys";
import {
  pluginsApiClient,
  type Plugin,
  type PluginInstallation,
  type PluginReview,
} from "@/lib/pluginsApi";
import { useAuthStore } from "@/stores/auth.store";

// ──── Marketplace ────

export function useMarketplaceQuery(params?: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
}) {
  const user = useAuthStore((s) => s.user);

  const query = useQuery({
    queryKey: queryKeys.plugins.marketplace(params),
    queryFn: () => pluginsApiClient.getMarketplace(params),
    enabled: !!user,
  });

  return {
    plugins: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    hasMore: query.data?.hasMore ?? false,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
  };
}

// ──── Plugin Detail ────

export function usePluginDetailQuery(slug: string | null) {
  const query = useQuery({
    queryKey: queryKeys.plugins.detail(slug ?? ""),
    queryFn: () => pluginsApiClient.getPluginBySlug(slug!),
    enabled: !!slug,
  });

  return {
    plugin: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
  };
}

// ──── Installed Plugins ────

export function useInstalledPluginsQuery() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.plugins.installed(),
    queryFn: () => pluginsApiClient.getInstalled(),
    enabled: !!user,
  });

  const installMutation = useMutation({
    mutationFn: async ({
      pluginId,
      configuration,
    }: {
      pluginId: string;
      configuration?: Record<string, unknown>;
    }) => {
      return pluginsApiClient.install(pluginId, configuration);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.installed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.all });
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: async (installationId: string) => {
      return pluginsApiClient.uninstall(installationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.installed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.all });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      installationId,
      enabled,
    }: {
      installationId: string;
      enabled: boolean;
    }) => {
      return pluginsApiClient.updateInstallation(installationId, { enabled });
    },
    onMutate: async ({ installationId, enabled }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.plugins.installed(),
      });
      const previous = queryClient.getQueryData<PluginInstallation[]>(
        queryKeys.plugins.installed(),
      );
      queryClient.setQueryData<PluginInstallation[]>(
        queryKeys.plugins.installed(),
        (old) =>
          old?.map((i) =>
            i.id === installationId ? { ...i, enabled } : i,
          ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.plugins.installed(),
          context.previous,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.installed() });
    },
  });

  const install = useCallback(
    async (pluginId: string, configuration?: Record<string, unknown>) => {
      return installMutation.mutateAsync({ pluginId, configuration });
    },
    [installMutation],
  );

  const uninstall = useCallback(
    async (installationId: string) => {
      return uninstallMutation.mutateAsync(installationId);
    },
    [uninstallMutation],
  );

  const toggle = useCallback(
    async (installationId: string, enabled: boolean) => {
      return toggleMutation.mutateAsync({ installationId, enabled });
    },
    [toggleMutation],
  );

  const installations = query.data ?? [];
  const enabledPlugins = installations.filter((i) => i.enabled);

  return {
    installations,
    enabledPlugins,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    install,
    uninstall,
    toggle,
    isInstalling: installMutation.isPending,
    isUninstalling: uninstallMutation.isPending,
  };
}

// ──── Reviews ────

export function usePluginReviewsQuery(pluginId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.plugins.reviews(pluginId ?? ""),
    queryFn: () => pluginsApiClient.getReviews(pluginId!),
    enabled: !!pluginId,
  });

  const submitMutation = useMutation({
    mutationFn: async (review: { rating: number; reviewText?: string }) => {
      if (!pluginId) throw new Error("No plugin ID");
      return pluginsApiClient.submitReview(pluginId, review);
    },
    onSuccess: () => {
      if (pluginId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.plugins.reviews(pluginId),
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.plugins.all });
      }
    },
  });

  return {
    reviews: (query.data ?? []) as PluginReview[],
    isLoading: query.isLoading,
    submitReview: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
  };
}

// Re-export types for convenience
export type { Plugin, PluginInstallation, PluginReview };
