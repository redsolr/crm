"use client";

/**
 * Controls for an AI-computed column (a definition carrying an
 * `enrichment` config) — the Folk-Magic-Fields / Attio-AI-attribute
 * face of the platform's attribute-enrichment primitive:
 *
 *   - ✨ Compute button → `POST …/compute` (metered, server-side)
 *   - "AI" provenance tag when the current value was computed
 *   - loud outcome notes: a manual value is never clobbered
 *     (`skipped_manual_override`), and failures say so.
 *
 * Rendered next to the field label in the record-page attribute
 * editors; safe to mount on any definition (renders nothing when the
 * definition has no enrichment config).
 */

import { useState } from "react";
import type {
  AttributeDefinition,
  AttributeValue,
} from "@/lib/generated/api/models";
import { useComputeAttributeValue } from "@/lib/sales/use-sales-mutations";

export function AttributeEnrichmentControls({
  workItemId,
  definition,
  valueRow,
}: {
  workItemId: string;
  definition: AttributeDefinition;
  /** The full value row (for provenance), when one exists. */
  valueRow: AttributeValue | undefined;
}) {
  const compute = useComputeAttributeValue();
  const [note, setNote] = useState<string | null>(null);

  if (definition.enrichment == null) return null;

  const isComputed = valueRow?.source === "computed";

  function runCompute() {
    if (compute.isPending) return;
    setNote(null);
    compute.mutate(
      { workItemId, definitionId: definition.id },
      {
        onSuccess: (result) => {
          if (result.outcome === "skipped_manual_override") {
            setNote("Kept your manual value — AI never overwrites it.");
          } else if (result.outcome === "failed") {
            setNote("Compute failed — try again or check usage limits.");
          }
        },
        onError: (err) => {
          console.error(
            `[AttributeEnrichmentControls] compute failed for ${definition.key}:`,
            err,
          );
          setNote("Compute failed — try again or check usage limits.");
        },
      },
    );
  }

  return (
    <span className="sales-attr-enrichment inline-flex items-center gap-1.5 ml-2 align-middle">
      {isComputed && (
        <span
          className="crm-tag"
          data-testid={`sales-attr-${definition.key}-ai-tag`}
          title={
            valueRow?.computed_model
              ? `Computed by ${valueRow.computed_model}${valueRow.computed_at ? ` · ${valueRow.computed_at}` : ""}`
              : "AI-computed value"
          }
        >
          AI
        </span>
      )}
      <button
        type="button"
        data-testid={`sales-attr-${definition.key}-compute`}
        className="crm-btn-ghost crm-btn-xs"
        disabled={compute.isPending}
        onClick={(e) => {
          // The controls render inside the field's <label> — stop the
          // click from activating the labeled input underneath.
          e.preventDefault();
          e.stopPropagation();
          runCompute();
        }}
        title="Compute with AI from this record's context (never overwrites a manual value)"
      >
        {compute.isPending ? "Computing…" : "✨ Compute"}
      </button>
      {note && (
        <span
          className="text-[11px] text-[var(--theme-text-muted)]"
          data-testid={`sales-attr-${definition.key}-compute-note`}
        >
          {note}
        </span>
      )}
    </span>
  );
}
