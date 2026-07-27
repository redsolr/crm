/**
 * The claim under test: crm-web consumers receive BARE attribute
 * values even though the platform serves the canonical storage
 * envelope `value: { value: <typed> }` on the wire (pinned by the
 * platform's attributes.integration-spec). The unwrap lives at the
 * API boundary (`attributesApi`) so every downstream consumer —
 * AttributeFieldEditor, the projection helpers, table snapshots —
 * can assume bare values.
 *
 * Regression for the 2026-07-18 bug where the peek panel rendered
 * `{"value":"client_comms"}` verbatim and every select/filter
 * projection silently read as empty.
 */

import { unwrapAttributeValueRow } from "@/lib/attributesApi";
import {
  toStorageEnvelope,
  unwrapAttributeValue,
} from "@/lib/attribute-value-envelope";
import type { AttributeValue } from "@/lib/generated/api/models";

function row(value: unknown): AttributeValue {
  return {
    id: "av_1",
    work_item_id: "wi_1",
    definition_id: "ad_1",
    value,
    source: "manual",
    computed_at: null,
    computed_model: null,
    created_at: "2026-07-18T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
  } as AttributeValue;
}

describe("unwrapAttributeValueRow", () => {
  it("unwraps the wire envelope for every typed shape", () => {
    expect(unwrapAttributeValueRow(row({ value: "client_comms" })).value).toBe(
      "client_comms",
    );
    expect(unwrapAttributeValueRow(row({ value: 42000 })).value).toBe(42000);
    expect(unwrapAttributeValueRow(row({ value: true })).value).toBe(true);
    expect(
      unwrapAttributeValueRow(row({ value: ["a", "b"] })).value,
    ).toEqual(["a", "b"]);
    expect(unwrapAttributeValueRow(row({ value: null })).value).toBeNull();
  });

  it("passes already-bare values through untouched (optimistic-cache shape)", () => {
    expect(unwrapAttributeValueRow(row("client_comms")).value).toBe(
      "client_comms",
    );
    expect(unwrapAttributeValueRow(row(42000)).value).toBe(42000);
    expect(unwrapAttributeValueRow(row(null)).value).toBeNull();
    expect(unwrapAttributeValueRow(row(["a"])).value).toEqual(["a"]);
  });

  it("preserves the rest of the row (provenance fields)", () => {
    const unwrapped = unwrapAttributeValueRow(row({ value: "x" }));
    expect(unwrapped.id).toBe("av_1");
    expect(unwrapped.definition_id).toBe("ad_1");
    expect(unwrapped.source).toBe("manual");
  });
});

describe("attribute-value-envelope round-trip", () => {
  // The e2e mock handlers store via toStorageEnvelope and the app
  // client reads via unwrapAttributeValue — if these ever stop being
  // inverses, the mocked tier drifts from the platform contract.
  it("unwrap(toStorageEnvelope(x)) === x for every typed shape", () => {
    for (const bare of ["client_comms", 42000, true, ["a", "b"], null]) {
      expect(unwrapAttributeValue(toStorageEnvelope(bare))).toEqual(bare);
    }
  });

  it("toStorageEnvelope accepts an already-wrapped payload without double-wrapping", () => {
    expect(toStorageEnvelope({ value: "x" })).toEqual({ value: "x" });
    expect(toStorageEnvelope("x")).toEqual({ value: "x" });
  });
});
