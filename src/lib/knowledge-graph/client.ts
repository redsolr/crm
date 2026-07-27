/**
 * `KnowledgeGraphApiClient` — thin HTTP wrapper for the graph-view
 * endpoint plus the existing build/stats endpoints on
 * `/search/graph/*`.
 *
 * Contract: every method maps 1:1 to a backend DTO in
 * `platform/src/modules/search/`. Schemas in `./schemas.ts` mirror the
 * backend shape; any drift fails loudly with `ZodError` on first bad
 * response — same pattern as `ChatApiClient`.
 */

import { BaseApiClient } from "../api-client";
import { parseApiResponse } from "../chat/schemas";
import { freshIdempotencyKey } from "../idempotency";
import {
  CuratedEntityResponseSchema,
  CuratedRelationshipResponseSchema,
  EntityDetailResponseSchema,
  GraphLayoutResponseSchema,
  GraphViewResponseSchema,
  type CreateEntityInput,
  type CreateRelationshipInput,
  type CuratedEntityResponse,
  type CuratedRelationshipResponse,
  type EntityDetailResponse,
  type GraphLayoutResponse,
  type GraphLayoutScopeRef,
  type GraphPositions,
  type GraphViewQuery,
  type GraphViewResponse,
  type UpdateEntityInput,
} from "./schemas";

class KnowledgeGraphApiClient extends BaseApiClient {
  /**
   * `GET /search/graph/view` — serialized graphology graph + community
   * metadata + stats. Caller reshapes into Sigma via `graph.import()`.
   */
  async getView(query: GraphViewQuery = {}): Promise<GraphViewResponse> {
    const params = new URLSearchParams();
    if (query.organization_id != null && query.organization_id !== "") {
      params.set("organization_id", query.organization_id);
    }
    if (query.community_id != null) {
      params.set("community_id", String(query.community_id));
    }
    if (query.since_days != null) {
      params.set("since_days", String(query.since_days));
    }
    if (query.limit != null) {
      params.set("limit", String(query.limit));
    }
    const qs = params.toString();
    const endpoint = `/search/graph/view${qs !== "" ? `?${qs}` : ""}`;
    const raw = await this.request<unknown>(endpoint, { method: "GET" });
    return parseApiResponse(GraphViewResponseSchema, endpoint, raw);
  }

  /**
   * `GET /search/graph/entities/:entity_id` — entity row + mentions
   * (joined to task/page titles) + first-degree neighbors. Backs the
   * click-into-node details panel.
   */
  async getEntityDetail(entity_id: string): Promise<EntityDetailResponse> {
    const endpoint = `/search/graph/entities/${encodeURIComponent(entity_id)}`;
    const raw = await this.request<unknown>(endpoint, { method: "GET" });
    return parseApiResponse(EntityDetailResponseSchema, endpoint, raw);
  }

  // ── Curation: hand-curated entities + relationships ────────────────

  /** `POST /search/graph/entities` — create a manual entity. */
  async createEntity(
    input: CreateEntityInput,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<CuratedEntityResponse> {
    const endpoint = "/search/graph/entities";
    const raw = await this.request<unknown>(endpoint, {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return parseApiResponse(CuratedEntityResponseSchema, endpoint, raw);
  }

  /** `PATCH /search/graph/entities/:id` — edit a manual entity. */
  async updateEntity(
    entity_id: string,
    input: UpdateEntityInput,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<CuratedEntityResponse> {
    const endpoint = `/search/graph/entities/${encodeURIComponent(entity_id)}`;
    const raw = await this.request<unknown>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(input),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return parseApiResponse(CuratedEntityResponseSchema, endpoint, raw);
  }

  /** `DELETE /search/graph/entities/:id` — delete entity + cascade
   *  to its mentions/relationships. */
  async deleteEntity(
    entity_id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    const endpoint = `/search/graph/entities/${encodeURIComponent(entity_id)}`;
    await this.request<unknown>(endpoint, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /** `POST /search/graph/relationships` — create a manual edge. */
  async createRelationship(
    input: CreateRelationshipInput,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<CuratedRelationshipResponse> {
    const endpoint = "/search/graph/relationships";
    const raw = await this.request<unknown>(endpoint, {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return parseApiResponse(CuratedRelationshipResponseSchema, endpoint, raw);
  }

  /** `DELETE /search/graph/relationships/:id` — drop an edge. */
  async deleteRelationship(
    relationshipId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    const endpoint = `/search/graph/relationships/${encodeURIComponent(relationshipId)}`;
    await this.request<unknown>(endpoint, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  // ── Layout (per-user, per-scope drag-to-arrange persistence) ──────

  /** `GET /knowledge_graph/layout` — sparse position overrides. */
  async getLayout(scope: GraphLayoutScopeRef): Promise<GraphLayoutResponse> {
    const qs = layoutScopeQuery(scope);
    const endpoint = `/knowledge_graph/layout?${qs}`;
    const raw = await this.request<unknown>(endpoint, { method: "GET" });
    return parseApiResponse(GraphLayoutResponseSchema, endpoint, raw);
  }

  /** `PATCH /knowledge_graph/layout` — shallow-merge a partial
   *  `{ nodeId: { x, y } }` map into the stored positions. Only the
   *  nodes included in `positions` get updated; others stay. */
  async patchLayout(
    scope: GraphLayoutScopeRef,
    positions: GraphPositions,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<GraphLayoutResponse> {
    const qs = layoutScopeQuery(scope);
    const endpoint = `/knowledge_graph/layout?${qs}`;
    const raw = await this.request<unknown>(endpoint, {
      method: "PATCH",
      body: JSON.stringify({ positions }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return parseApiResponse(GraphLayoutResponseSchema, endpoint, raw);
  }

  /** `DELETE /knowledge_graph/layout` — clear all overrides for the
   *  scope. Used by the "reset layout" action in the toolbar. */
  async clearLayout(
    scope: GraphLayoutScopeRef,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<GraphLayoutResponse> {
    const qs = layoutScopeQuery(scope);
    const endpoint = `/knowledge_graph/layout?${qs}`;
    const raw = await this.request<unknown>(endpoint, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return parseApiResponse(GraphLayoutResponseSchema, endpoint, raw);
  }

  /** `DELETE /knowledge_graph/layout/nodes/:nodeId` — drop a single
   *  node's override, snapping it back to the force layout. */
  async clearLayoutNode(
    scope: GraphLayoutScopeRef,
    nodeId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<GraphLayoutResponse> {
    const qs = layoutScopeQuery(scope);
    const endpoint = `/knowledge_graph/layout/nodes/${encodeURIComponent(nodeId)}?${qs}`;
    const raw = await this.request<unknown>(endpoint, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return parseApiResponse(GraphLayoutResponseSchema, endpoint, raw);
  }
}

/**
 * Build the `?scope_type=...&scope_id=...` query for layout endpoints.
 * Hoisted to a free function rather than a private method so the URL
 * stays inline at each call site (visible to source-walking tooling
 * like the public-API coverage ratchet) while the only DRY-able piece
 * — the param building — stays factored out.
 */
function layoutScopeQuery(scope: GraphLayoutScopeRef): string {
  return new URLSearchParams({
    scope_type: scope.scopeType,
    scope_id: scope.scopeId,
  }).toString();
}

export const knowledgeGraphApi = new KnowledgeGraphApiClient();
