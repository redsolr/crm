import { and, asc, eq } from "drizzle-orm";
import { db, attributeDefinitions, attributeValues } from "@/db";
import { mintId } from "@/db/ids";

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

/** Manual upsert — the platform's conflict rule (computed never
 *  overwrites manual) is trivially satisfied: all local writes are
 *  manual until the enrichment step lands. */
export async function upsertValue(
  workItemId: string,
  definitionId: string,
  bareValue: unknown,
): Promise<ValueRow> {
  const now = new Date();
  const existing = await db
    .select()
    .from(attributeValues)
    .where(
      and(
        eq(attributeValues.workItemId, workItemId),
        eq(attributeValues.definitionId, definitionId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(attributeValues)
      .set({ value: bareValue, source: "manual", updatedAt: now })
      .where(eq(attributeValues.id, existing[0].id));
    const updated = await db
      .select()
      .from(attributeValues)
      .where(eq(attributeValues.id, existing[0].id))
      .limit(1);
    return updated[0]!;
  }

  const id = mintId("av");
  await db.insert(attributeValues).values({
    id,
    workItemId,
    definitionId,
    value: bareValue,
    source: "manual",
    createdAt: now,
    updatedAt: now,
  });
  const created = await db
    .select()
    .from(attributeValues)
    .where(eq(attributeValues.id, id))
    .limit(1);
  return created[0]!;
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
