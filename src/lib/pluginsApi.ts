/**
 * Plugins/Packs API client.
 *
 * Endpoints mirror the Flutter app's PluginsApi — see
 * mobile/lib/features/plugins/data/plugins_api.dart for the
 * backend contract.
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type {
  AccountId,
  PluginId,
  PluginInstallId,
  PluginReviewId,
  PluginVersionId,
} from "./ids";

// ──── Types ────

export interface Plugin {
  id: PluginId;
  slug: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  coverImageUrl: string | null;
  category: string;
  visibility: string;
  status: string;
  priceInCents: number | null;
  installCount: number;
  averageRating: number | null;
  reviewCount: number | null;
  currentVersionId: PluginVersionId | null;
  currentVersion: string | null;
  creatorId: string | null;
  created_at: string;
  updated_at: string;
}

export interface PluginInstallation {
  id: PluginInstallId;
  pluginId: PluginId;
  account_id: AccountId;
  enabled: boolean;
  configuration: Record<string, unknown>;
  installedAt: string | null;
  plugin: Plugin | null;
}

export interface PluginVersion {
  id: PluginVersionId;
  pluginId: PluginId;
  version: string;
  systemPrompt: string;
  configSchema: Record<string, unknown> | null;
  changelog: string | null;
  tools: Record<string, unknown>[];
  created_at: string;
}

export interface PluginReview {
  id: PluginReviewId;
  pluginId: PluginId;
  rating: number;
  reviewText: string | null;
  userId: string;
  created_at: string;
}

export interface PaginatedPlugins {
  data: Plugin[];
  total: number;
  hasMore: boolean;
}

// ──── API Client ────

class PluginsApiClient extends BaseApiClient {
  // ── Marketplace ──

  async getMarketplace(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
  }): Promise<PaginatedPlugins> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.search) query.set("search", params.search);
    if (params?.category) query.set("category", params.category);
    const qs = query.toString();
    return this.request<PaginatedPlugins>(
      `/plugins/marketplace${qs ? `?${qs}` : ""}`,
    );
  }

  async getPluginBySlug(slug: string): Promise<Plugin> {
    return this.request<Plugin>(`/plugins/marketplace/${slug}`);
  }

  // ── Installations ──

  async getInstalled(): Promise<PluginInstallation[]> {
    const res = await this.request<
      { data: { installation: PluginInstallation; plugin: Plugin }[] }
    >("/plugins/installations");
    return res.data.map((r) => ({ ...r.installation, plugin: r.plugin }));
  }

  async install(
    pluginId: string,
    configuration?: Record<string, unknown>,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<PluginInstallation> {
    const res = await this.request<{ installation: PluginInstallation }>(
      `/plugins/${pluginId}/install`,
      {
        method: "POST",
        body: JSON.stringify({ configuration }),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    return res.installation;
  }

  async uninstall(
    installationId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    await this.request<void>(`/plugins/installations/${installationId}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async updateInstallation(
    installationId: string,
    updates: { enabled?: boolean; configuration?: Record<string, unknown> },
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<PluginInstallation> {
    const res = await this.request<{ installation: PluginInstallation }>(
      `/plugins/installations/${installationId}`,
      {
        method: "PUT",
        body: JSON.stringify(updates),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    return res.installation;
  }

  // ── Versions & Reviews ──

  async getVersions(pluginId: string): Promise<PluginVersion[]> {
    return this.request<PluginVersion[]>(`/plugins/${pluginId}/versions`);
  }

  async getReviews(
    pluginId: string,
  ): Promise<PluginReview[]> {
    const res = await this.request<{ reviews: PluginReview[] }>(
      `/plugins/${pluginId}/reviews`,
    );
    return res.reviews;
  }

  async submitReview(
    pluginId: string,
    review: { rating: number; reviewText?: string },
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    await this.request<void>(`/plugins/${pluginId}/reviews`, {
      method: "POST",
      body: JSON.stringify(review),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }
}

export const pluginsApiClient = new PluginsApiClient();
