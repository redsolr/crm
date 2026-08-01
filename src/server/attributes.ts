import { and, asc, eq } from "drizzle-orm";
import { db, attributeDefinitions, attributeValues } from "@/db";
import { mintId } from "@/db/ids";
import { broadcastInvalidate } from "./realtime";

/**
 * Attributes family (Magic Fields). Definitions are seeded per record
 * type (`scripts/db-seed.ts`); values store the BARE typed value in
 * jsonb and serialize wrapped as `{ value: <typed> }` — the platform's
 * storage envelope the frontend unwraps at its API boundary
 * (`src/lib/attribute-value-envelope.ts`).
 *
 * The `/compute` enrichment endpoint is NOT here — it needs the LLM
 * and lands with the Ask-chat swap step.
 */

type DefinitionRow = typeof attributeDefinitions.$inferSelect;
type ValueRow = typeof attributeValues.$inferSelect;

export function serializeDefinition(row: DefinitionRow): Record<string, unknown> {
  return {
    id: row.id,
    work_item_type_id: row.workItemTypeId,
    key: row.key,
    name: row.name,
    data_type: row.dataType,
    required: row.required,
    config: row.config,
    position: row.position,
    enrichment: row.enrichment,
    template_id: null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function serializeValue(row: ValueRow): Record<string, unknown> {
  return {
    id: row.id,
    work_item_id: row.workItemId,
    definition_id: row.definitionId,
    // Storage envelope — the FE unwraps `{ value }` at its boundary.
    value: { value: row.value },
    source: row.source,
    computed_at: row.computedAt === null ? null : row.computedAt.toISOString(),
    computed_model: row.computedModel,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listDefinitionsForType(
  workItemTypeId: string,
): Promise<DefinitionRow[]> {
  return db
    .select()
    .from(attributeDefinitions)
    .where(eq(attributeDefinitions.workItemTypeId, workItemTypeId))
    .orderBy(asc(attributeDefinitions.position), asc(attributeDefinitions.key));
}

export async function listValuesForItem(workItemId: string): Promise<ValueRow[]> {
  return db
    .select()
    .from(attributeValues)
    .where(eq(attributeValues.workItemId, workItemId))
    .orderBy(asc(attributeValues.createdAt));
}

export async function findDefinition(id: string): Promise<DefinitionRow | null> {
  const rows = await db
    .select()
    .from(attributeDefinitions)
    .where(eq(attributeDefinitions.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** Bare-value validation against the definition's `data_type` +
 *  `config`, mirroring the platform's checks. Null = valid. */
export function validateBareValue(
  definition: DefinitionRow,
  value: unknown,
): string | null {
  if (value === null) return null;
  const config = (definition.config ?? {}) as {
    options?: unknown[];
    maxLength?: number;
  };
  switch (definition.dataType) {
    case "select":
      if (typeof value !== "string" || !(config.options ?? []).includes(value)) {
        return `Value must be one of: ${(config.options ?? []).join(", ")}`;
      }
      return null;
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? null
        : "Value must be a finite number";
    case "date":
      return typeof value === "string" && !Number.isNaN(Date.parse(value))
        ? null
        : "Value must be a date string";
    case "text":
    case "url":
      if (typeof value !== "string") return "Value must be a string";
      if (config.maxLength !== undefined && value.length > config.maxLength) {
        return `Value exceeds maxLength ${config.maxLength}`;
      }
      return null;
    default:
      return null;
  }
}

async function findExistingValue(
  workItemId: string,
  definitionId: string,
): Promise<ValueRow | undefined> {
  const rows = await db
    .select()
    .from(attributeValues)
    .where(
      and(
        eq(attributeValues.workItemId, workItemId),
        eq(attributeValues.definitionId, definitionId),
      ),
    )
    .limit(1);
  return rows[0];
}

/**
 * Shared write path for both upserts: update the existing row or insert
 * a new one, with the source/provenance columns supplied by the caller.
 * `.returning()` gives the written row back without a re-select.
 */
async function writeValue(
  existing: ValueRow | undefined,
  workItemId: string,
  definitionId: string,
  bareValue: unknown,
  provenance: Pick<ValueRow, "source"> &
    Partial<Pick<ValueRow, "computedAt" | "computedModel">>,
): Promise<ValueRow> {
  const now = new Date();
  if (existing) {
    const rows = await db
      .update(attributeValues)
      .set({ value: bareValue, updatedAt: now, ...provenance })
      .where(eq(attributeValues.id, existing.id))
      .returning();
    if (!rows[0]) throw new Error(`Attribute value ${existing.id} vanished mid-update`);
    return rows[0];
  }
  const rows = await db
    .insert(attributeValues)
    .values({
      id: mintId("av"),
      workItemId,
      definitionId,
      value: bareValue,
      createdAt: now,
      updatedAt: now,
      ...provenance,
    })
    .returning();
  if (!rows[0]) throw new Error("Attribute value insert returned no row");
  return rows[0];
}

/** Manual upsert — the human PUT path (and the Ask agent's writes,
 *  which ride the same validation). */
export async function upsertValue(
  workItemId: string,
  definitionId: string,
  bareValue: unknown,
): Promise<ValueRow> {
  const existing = await findExistingValue(workItemId, definitionId);
  const row = await writeValue(existing, workItemId, definitionId, bareValue, {
    source: "manual",
  });
  broadcastInvalidate("records");
  return row;
}

/**
 * Enrichment upsert — a suggestion with provenance, never a clobber:
 * an existing `manual` value stays untouched (caller reports
 * `skipped_manual_override`).
 */
export async function upsertComputedValue(
  workItemId: string,
  definitionId: string,
  bareValue: unknown,
  model: string,
): Promise<{ outcome: "computed" | "skipped_manual_override"; row: ValueRow }> {
  const existing = await findExistingValue(workItemId, definitionId);
  if (existing && existing.source === "manual") {
    return { outcome: "skipped_manual_override", row: existing };
  }
  const row = await writeValue(existing, workItemId, definitionId, bareValue, {
    source: "computed",
    computedAt: new Date(),
    computedModel: model,
  });
  broadcastInvalidate("records");
  return { outcome: "computed", row };
}

export async function deleteValue(
  workItemId: string,
  definitionId: string,
): Promise<void> {
  await db
    .delete(attributeValues)
    .where(
      and(
        eq(attributeValues.workItemId, workItemId),
        eq(attributeValues.definitionId, definitionId),
      ),
    );
}
