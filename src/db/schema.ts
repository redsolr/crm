import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * CRM's own single-tenant schema (backend-swap step 1, strangler over
 * the platform `/api` surface — see the 2026-07-29 portfolio-split
 * handoff in the platform repo).
 *
 * The tables mirror the SEMANTICS the frontend consumes over the wire
 * (WorkItem with inline `state`/`type`, attribute definitions + values,
 * activities, comments) — not the platform's multi-tenant substrate.
 * No RLS, no organizations/workspaces tables (the workspace is a static
 * stub, step 3), no billing. IDs keep the platform's `<prefix>_<base58>`
 * wire form (see `ids.ts`) so the untouched frontend round-trips them.
 */

// Mints the workspace-scoped human identifier (`CRM-<n>`). A data
// import at cutover must advance this past the imported maximum.
export const recordIdentifierSeq = pgSequence("record_identifier_seq", {
  startWith: 1,
});

/** Named state machine (`pipeline` / `commitment` / `memory`). */
export const workflows = pgTable("workflows", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Workflow state — serialized inline on records as `state`. */
export const workflowStages = pgTable(
  "workflow_stages",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    /** `not_started` | `active` | `done` | `dead` (wire categories). */
    category: text("category").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("uq_workflow_stages_workflow_key").on(t.workflowId, t.key)],
);

/** Work-item type (`account` / `contact` / `opportunity` / …). */
export const recordTypes = pgTable("record_types", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => workflows.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** The work_items subset the CRM consumes. */
export const records = pgTable("records", {
  id: text("id").primaryKey(),
  /** Human id (`CRM-42`; imported rows keep their original). */
  identifier: text("identifier").notNull().unique(),
  title: text("title").notNull(),
  subject: text("subject"),
  description: text("description"),
  /** Static single-tenant stub — always `CRM_WORKSPACE_ID`. */
  workspaceId: text("workspace_id").notNull(),
  typeId: text("type_id")
    .notNull()
    .references(() => recordTypes.id),
  stateId: text("state_id")
    .notNull()
    .references(() => workflowStages.id),
  /** `none` | `low` | `medium` | `high` | `urgent`. */
  priority: text("priority").notNull().default("none"),
  position: doublePrecision("position").notNull().default(0),
  parentId: text("parent_id").references((): AnyPgColumn => records.id, {
    onDelete: "set null",
  }),
  assigneeId: text("assignee_id"),
  assigneeName: text("assignee_name"),
  driId: text("dri_id"),
  driName: text("dri_name"),
  createdById: text("created_by_id").notNull(),
  createdByName: text("created_by_name"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  estimate: doublePrecision("estimate"),
  /** `private` | `internal` | `public` — CRM only uses `internal`. */
  visibility: text("visibility").notNull().default("internal"),
  /** Optimistic-concurrency version (AIP-154, `If-Match: W/"v<n>"`). */
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

/** Typed custom-field definition per record type (Magic Fields). */
export const attributeDefinitions = pgTable(
  "attribute_definitions",
  {
    id: text("id").primaryKey(),
    workItemTypeId: text("work_item_type_id")
      .notNull()
      .references(() => recordTypes.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    /** `text` | `number` | `date` | `select` | `url` | … (wire enum). */
    dataType: text("data_type").notNull(),
    required: boolean("required").notNull().default(false),
    config: jsonb("config"),
    position: integer("position").notNull().default(0),
    /** LLM-enrichment config (`{ prompt, refreshPolicy }`) or null. */
    enrichment: jsonb("enrichment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_attribute_definitions_type_key").on(t.workItemTypeId, t.key),
  ],
);

export const attributeValues = pgTable(
  "attribute_values",
  {
    id: text("id").primaryKey(),
    workItemId: text("work_item_id")
      .notNull()
      .references(() => records.id, { onDelete: "cascade" }),
    definitionId: text("definition_id")
      .notNull()
      .references(() => attributeDefinitions.id, { onDelete: "cascade" }),
    value: jsonb("value"),
    /** `manual` | `computed` — computed never overwrites manual. */
    source: text("source").notNull().default("manual"),
    computedAt: timestamp("computed_at", { withTimezone: true }),
    computedModel: text("computed_model"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_attribute_values_item_definition").on(
      t.workItemId,
      t.definitionId,
    ),
  ],
);

/** Timeline events (`task_created`, `state_changed`, `comment_added`, …). */
export const activities = pgTable("activities", {
  id: text("id").primaryKey(),
  /** Open string on the wire — writers introduce types freely. */
  type: text("type").notNull(),
  entityType: text("entity_type").notNull().default("work_item"),
  // Deliberately NO FK to records: the audit feed must survive record
  // deletion (`work_item_deleted` is itself an activity).
  entityId: text("entity_id").notNull(),
  entityIdentifier: text("entity_identifier"),
  actorId: text("actor_id"),
  /** `user` | `agent` | `system` (wire actor types). */
  actorType: text("actor_type").notNull().default("user"),
  actorName: text("actor_name"),
  changes: jsonb("changes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Ask conversation (backend-swap: Ask chat). One row per `POST /api/chats`. */
export const chats = pgTable("chats", {
  id: text("id").primaryKey(),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Durable Ask history — user text + final assistant text per turn.
 * Intra-turn tool traffic (tool_use/tool_result) is deliberately NOT
 * persisted: the transcript UI lives client-side and follow-up turns
 * only need the conversational thread.
 */
export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  /** `user` | `assistant`. */
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Durable saved query specs for the table/board surfaces (`Save view`).
 * `query` is opaque to the backend — the toolbar owns its shape
 * (`WorkItemsViewQuery`). Ported from the platform's views module during
 * the 2026-07-31 dead-call sweep: the FE shipped the full affordance but
 * the swap never brought the table, so every `/api/views` call 404'd.
 */
export const savedViews = pgTable("saved_views", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Surface discriminator (`work_items` today; open string on the wire). */
  kind: text("kind").notNull(),
  /** `private` | `shared` (wire enum). */
  visibility: text("visibility").notNull().default("private"),
  /** Static single-tenant stub — always `CRM_WORKSPACE_ID`. */
  workspaceId: text("workspace_id").notNull(),
  ownerAccountId: text("owner_account_id").notNull(),
  ownerName: text("owner_name"),
  query: jsonb("query").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  workItemId: text("work_item_id")
    .notNull()
    .references(() => records.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  authorId: text("author_id").notNull(),
  /** Real author identity (team attribution, swap step 6 — 2026-07-31).
   *  Null on rows written before the columns existed. */
  authorName: text("author_name"),
  authorEmail: text("author_email"),
  mentions: jsonb("mentions").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * CRM-native seat invites (own-the-invite-flow arc, 2026-08-03).
 * The invite record is the source of truth for WHO may enter; WorkOS
 * is a silent backend — the accept flow pre-creates the AuthKit user
 * server-side, so invitees never see a WorkOS-hosted screen and WorkOS
 * sends no emails. v1 is link-first: the creator copies the
 * `/invite/<code>` URL and shares it themselves.
 */
/**
 * Web-push subscriptions (ambient-digest arc, 2026-08-07). One row per
 * browser push endpoint; the actor who enabled notifications is
 * stamped for audit. Endpoints that the push service reports gone
 * (404/410 on delivery) are deleted by the sender — no soft-disable
 * state to drift.
 */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey(),
  /** Push-service URL — unique per browser installation. */
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  accountId: text("account_id").notNull(),
  accountName: text("account_name"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Morning-digest runs — one row per Bangkok calendar date. `payload`
 * holds the computed buckets + LLM follow-up drafts the Inbox tab
 * renders; `pushedAt` makes the daily web-push once-only (a same-day
 * re-run refreshes the payload but never re-notifies).
 */
export const digests = pgTable("digests", {
  id: text("id").primaryKey(),
  /** Local `YYYY-MM-DD` in Asia/Bangkok — the founder's morning. */
  runDate: text("run_date").notNull().unique(),
  payload: jsonb("payload").notNull(),
  pushedAt: timestamp("pushed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Agent memories — durable facts the assistant keeps about the founder
 * and the sales motion (ChatGPT-memory shape): tone preferences,
 * standing rules, business context. Written by the agent via the
 * remember_fact/forget_fact tools (Ask panel + /mcp) or by hand on
 * /account; injected into every Ask system prompt.
 */
export const agentMemories = pgTable("agent_memories", {
  id: text("id").primaryKey(),
  /** One durable fact, phrased as a short standalone sentence. */
  content: text("content").notNull(),
  /** Who saved it — a seat or an agent actor (attribution discipline). */
  createdById: text("created_by_id").notNull(),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const invites = pgTable("invites", {
  id: text("id").primaryKey(),
  /** URL token — the secret. High-entropy base58, never logged. */
  code: text("code").notNull().unique(),
  email: text("email").notNull(),
  invitedById: text("invited_by_id").notNull(),
  invitedByName: text("invited_by_name"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /** Set the moment the AuthKit user is provisioned via accept. */
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  /** AuthKit user id once provisioned (accept) — audit trail. */
  workosUserId: text("workos_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
