import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/server/api-error";
import { ASK_MODEL } from "@/server/ask";
import {
  findDefinition,
  listDefinitionsForType,
  listValuesForItem,
  serializeValue,
  upsertComputedValue,
  validateBareValue,
} from "@/server/attributes";
import { loadWorkItem } from "@/server/work-items";

/**
 * `POST /v1/work_items/{id}/attribute_values/{definitionId}/compute` —
 * sync single-item LLM enrichment for an AI-computed column (a
 * definition carrying an `enrichment` config), deferred from the
 * attributes swap step to here where the Anthropic client exists.
 *
 * Contract per `attributesApi.computeValue`: `{ outcome, value }` with
 * outcome `computed` | `skipped_manual_override` | `failed`. A human
 * (`manual`) value is never clobbered.
 */

const COMPUTE_MAX_TOKENS = 2048;

interface EnrichmentConfig {
  prompt?: unknown;
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string; definitionId: string }> },
): Promise<NextResponse> {
  const { id, definitionId } = await context.params;

  const item = await loadWorkItem(id);
  if (item === null) return apiError(404, "not_found", `Work item ${id} not found`);
  const definition = await findDefinition(definitionId);
  if (definition === null) {
    return apiError(404, "not_found", `Attribute definition ${definitionId} not found`);
  }
  if (definition.workItemTypeId !== item.type.id) {
    return apiError(
      422,
      "validation_failed",
      "Attribute definition does not belong to this work item's type",
    );
  }
  const enrichment = definition.enrichment as EnrichmentConfig | null;
  const enrichmentPrompt =
    enrichment !== null && typeof enrichment.prompt === "string"
      ? enrichment.prompt
      : null;
  if (enrichmentPrompt === null) {
    return apiError(
      422,
      "validation_failed",
      "This attribute is not an AI-computed column (no enrichment config)",
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return apiError(500, "llm_unavailable", "ANTHROPIC_API_KEY is not configured");
  }

  // Record context the enrichment grounds in: core fields + the
  // sibling attribute values by key.
  const definitions = await listDefinitionsForType(item.type.id);
  const keyById = new Map(definitions.map((d) => [d.id, d.key]));
  const values = await listValuesForItem(id);
  const attributeContext = Object.fromEntries(
    values
      .filter((v) => v.definitionId !== definitionId)
      .map((v) => [keyById.get(v.definitionId) ?? v.definitionId, v.value]),
  );
  const config = (definition.config ?? {}) as { options?: unknown[] };
  const options = Array.isArray(config.options) ? config.options : [];

  const instructions = [
    `Compute the "${definition.key}" attribute (${definition.dataType}) for this CRM record.`,
    `Enrichment instruction: ${enrichmentPrompt}`,
    definition.dataType === "select" && options.length > 0
      ? `Respond with EXACTLY one of: ${options.join(", ")}`
      : null,
    definition.dataType === "number"
      ? "Respond with a bare number, no units or prose."
      : null,
    definition.dataType === "date" ? "Respond with a date, YYYY-MM-DD." : null,
    "Respond with ONLY the value — no explanation, no quotes.",
    "",
    `Record: ${item.record.title} (type ${item.type.key}, stage ${item.state.key})`,
    item.record.subject !== null ? `Subject: ${item.record.subject}` : null,
    item.record.description !== null
      ? `Description: ${item.record.description}`
      : null,
    `Attributes: ${JSON.stringify(attributeContext)}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: ASK_MODEL,
      max_tokens: COMPUTE_MAX_TOKENS,
      messages: [{ role: "user", content: instructions }],
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ outcome: "failed", value: null });
    }
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    if (text === "") {
      return NextResponse.json({ outcome: "failed", value: null });
    }

    let bareValue: unknown = text;
    if (definition.dataType === "number") {
      const parsedNumber = Number(text.replace(/,/g, ""));
      if (!Number.isFinite(parsedNumber)) {
        return NextResponse.json({ outcome: "failed", value: null });
      }
      bareValue = parsedNumber;
    }
    if (validateBareValue(definition, bareValue) !== null) {
      return NextResponse.json({ outcome: "failed", value: null });
    }

    const result = await upsertComputedValue(id, definitionId, bareValue, ASK_MODEL);
    return NextResponse.json({
      outcome: result.outcome,
      value: serializeValue(result.row),
    });
  } catch (err) {
    console.error(
      `[attributes] compute failed for item ${id} definition ${definitionId}:`,
      err,
    );
    return NextResponse.json({ outcome: "failed", value: null });
  }
}
