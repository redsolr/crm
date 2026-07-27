/**
 * Runtime-validated response schemas for the knowledge-graph API.
 * Mirrors `GraphViewResponseDto` in the platform. Any drift between
 * backend DTO and these schemas surfaces as a `ZodError` on first
 * bad response instead of a silent type mismatch — see
 * `src/lib/chat/schemas.ts` for the canonical pattern.
 *
 * Wire field names are snake_case (Stripe v2 / platform convention).
 */

import { z } from "zod";

// ── Serialized graphology graph ──────────────────────────────────────────

// NOTE: node/edge attribute names are deliberately NOT `type` —
// Sigma.js treats `type` as the rendering program name. Semantic
// type lives on `entity_type` / `relationship_type` instead. See
// the service comment in `graph-view.service.ts`.
const SerializedNodeSchema = z.object({
  key: z.string(),
  attributes: z
    .object({
      label: z.string(),
      entity_type: z.string(),
      description: z.string().nullable().optional(),
      mention_count: z.number(),
      community_id: z.number().nullable(),
      color: z.string(),
      size: z.number(),
      origin: z.enum(["structural", "extracted", "manual"]),
    })
    .passthrough(),
});

const SerializedEdgeSchema = z.object({
  key: z.string().optional(),
  source: z.string(),
  target: z.string(),
  attributes: z
    .object({
      relationship_type: z.string(),
      weight: z.number(),
    })
    .passthrough()
    .optional(),
  undirected: z.boolean().optional(),
});

const SerializedGraphSchema = z.object({
  attributes: z.record(z.string(), z.unknown()).optional(),
  options: z
    .object({
      type: z.enum(["directed", "undirected", "mixed"]).optional(),
      multi: z.boolean().optional(),
      allowSelfLoops: z.boolean().optional(),
    })
    .optional(),
  nodes: z.array(SerializedNodeSchema),
  edges: z.array(SerializedEdgeSchema),
});

const GraphCommunitySchema = z.object({
  id: z.string(),
  community_id: z.number(),
  title: z.string().nullable(),
  entity_count: z.number(),
  color: z.string(),
  key_entities: z.array(z.string()),
});

const GraphStatsSchema = z.object({
  node_count: z.number(),
  edge_count: z.number(),
  truncated: z.boolean(),
  total_entities: z.number(),
});

export const GraphViewResponseSchema = z.object({
  graph: SerializedGraphSchema,
  communities: z.array(GraphCommunitySchema),
  stats: GraphStatsSchema,
});

export type GraphViewResponse = z.infer<typeof GraphViewResponseSchema>;
export type GraphCommunity = z.infer<typeof GraphCommunitySchema>;
export type SerializedGraph = z.infer<typeof SerializedGraphSchema>;

// ── Node / edge attribute types (matched against Sigma's hooks) ──────────

export interface GraphNodeAttributes {
  label: string;
  /** Semantic entity type (person / technology / concept / …). Named
   *  `entity_type` instead of `type` because Sigma.js reads the
   *  `type` attribute as the rendering program name. */
  entity_type: string;
  description?: string | null;
  mention_count: number;
  community_id: number | null;
  color: string;
  size: number;
  origin: "structural" | "extracted" | "manual";
  // Set by forceatlas2 layout at runtime — optional on the wire shape.
  x?: number;
  y?: number;
  /** Sigma render-time flag. When true, Sigma's label-overlap grid
   *  is bypassed and the label is always drawn — prevents flicker
   *  from winner-selection flipping frame-to-frame. Attached at
   *  hydration time, not sent over the wire. */
  forceLabel?: boolean;
}

export interface GraphEdgeAttributes {
  /** Semantic relationship type. Named `relationship_type` for the
   *  same reason node attributes use `entity_type` — Sigma treats
   *  `type` on edges as the rendering program. */
  relationship_type: string;
  weight: number;
  // Derived client-side: tinted blend of endpoint community colors.
  color?: string;
}

// ── Entity detail (click-into-node panel) ──────────────────────────────

const EntityMentionSchema = z.object({
  source_type: z.string(),
  source_id: z.string(),
  title: z.string().nullable(),
  /** Workspace-key-prefixed identifier ("BMKT-3"). Tasks only. */
  identifier: z.string().nullable(),
  /** ISO 8601 string — the wire shape of `Date`. Parsed at use site. */
  created_at: z.string(),
});

const EntityNeighborSchema = z.object({
  entity_id: z.string(),
  name: z.string(),
  entity_type: z.string(),
  relationship_type: z.string(),
  weight: z.number(),
  mention_count: z.number(),
  community_id: z.number().nullable(),
});

export const EntityDetailResponseSchema = z.object({
  entity: z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    description: z.string().nullable(),
    mention_count: z.number(),
    community_id: z.number().nullable(),
    origin: z.enum(["structural", "extracted"]),
  }),
  community: z
    .object({
      community_id: z.number(),
      title: z.string().nullable(),
    })
    .nullable(),
  mentions: z.array(EntityMentionSchema),
  neighbors: z.array(EntityNeighborSchema),
});

export type EntityDetailResponse = z.infer<typeof EntityDetailResponseSchema>;
export type EntityMention = z.infer<typeof EntityMentionSchema>;
export type EntityNeighbor = z.infer<typeof EntityNeighborSchema>;

// ── Curation (manual entity / relationship CRUD) ───────────────────────

/** Mirrors `kg_entity_type` enum in the backend. */
export const ENTITY_TYPES = [
  "concept",
  "person",
  "organization",
  "location",
  "topic",
  "technology",
  "document",
  "event",
  "term",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Mirrors `kg_relationship_type` enum in the backend. */
export const RELATIONSHIP_TYPES = [
  "mentions",
  "references",
  "related_to",
  "part_of",
  "authored_by",
  "located_in",
  "depends_on",
  "contradicts",
  "supports",
  "defines",
  "example_of",
  "caused_by",
  "precedes",
  "derived_from",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const CuratedEntityResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().nullable(),
  origin: z.enum(["structural", "extracted", "manual"]),
  mention_count: z.number(),
  community_id: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CuratedEntityResponse = z.infer<typeof CuratedEntityResponseSchema>;

export const CuratedRelationshipResponseSchema = z.object({
  id: z.string(),
  source_entity_id: z.string(),
  target_entity_id: z.string(),
  type: z.string(),
  weight: z.number(),
  created_at: z.string(),
});
export type CuratedRelationshipResponse = z.infer<
  typeof CuratedRelationshipResponseSchema
>;

export interface CreateEntityInput {
  name: string;
  type: EntityType;
  description?: string | null;
}

export interface UpdateEntityInput {
  name?: string;
  type?: EntityType;
  description?: string | null;
}

export interface CreateRelationshipInput {
  source_entity_id: string;
  target_entity_id: string;
  type: RelationshipType;
  weight?: number;
}

// ── User layout (drag-to-arrange persistence) ────────────────────────────

export const GRAPH_LAYOUT_SCOPES = ["project", "organization"] as const;
export type GraphLayoutScope = (typeof GRAPH_LAYOUT_SCOPES)[number];

const NodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type NodePosition = z.infer<typeof NodePositionSchema>;

/**
 * Sparse map `{ nodeId: { x, y } }`. Only nodes the user has
 * manually dragged appear here; the rest fall through to the
 * ForceAtlas2 layout at render time.
 */
export const GraphPositionsSchema = z.record(
  z.string(),
  NodePositionSchema,
);
export type GraphPositions = z.infer<typeof GraphPositionsSchema>;

/**
 * Wire shape: BE returns `{ data: { scope_type, scope_id, positions,
 * updated_at } }` (snake_case + envelope per platform Stripe v2
 * convention). Transform flattens the envelope and renames to the
 * internal camelCase shape consumers already use.
 */
export const GraphLayoutResponseSchema = z
  .object({
    data: z.object({
      scope_type: z.enum(GRAPH_LAYOUT_SCOPES),
      scope_id: z.string(),
      positions: GraphPositionsSchema,
      updated_at: z.string().nullable(),
    }),
  })
  .transform((input) => ({
    scopeType: input.data.scope_type,
    scopeId: input.data.scope_id,
    positions: input.data.positions,
    updated_at: input.data.updated_at,
  }));
export type GraphLayoutResponse = z.infer<typeof GraphLayoutResponseSchema>;

export interface GraphLayoutScopeRef {
  scopeType: GraphLayoutScope;
  scopeId: string;
}

// ── Query params ─────────────────────────────────────────────────────────

export interface GraphViewQuery {
  /** Active organization scope. Wired from `useAppContextStore` so each
   *  org renders its own clean graph even when several orgs share a
   *  billing account. Omit to view every entity in the account. */
  organization_id?: string;
  community_id?: number;
  since_days?: number;
  limit?: number;
}
