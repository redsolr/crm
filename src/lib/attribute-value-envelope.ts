/**
 * The platform's attribute-value storage envelope, in one place.
 *
 * The platform stores + serves every attribute value wrapped as
 * `{ value: <typed> }` (uniform JSONB shape — see platform
 * `attribute-value-validation.ts`; the wire shape is pinned by its
 * `attributes.integration-spec`). This app works with BARE typed
 * values everywhere past the API boundary.
 *
 * Both directions live here so the app client (`attributesApi`, which
 * unwraps) and the e2e mock handlers (which store wrapped, mirroring
 * the real backend) can never drift apart — mock-vs-contract drift is
 * exactly how the 2026-07-18 `{"value":"client_comms"}` render bug
 * shipped.
 */

function isEnvelope(raw: unknown): raw is { value: unknown } {
  return (
    typeof raw === "object" &&
    raw !== null &&
    !Array.isArray(raw) &&
    "value" in raw
  );
}

/** Wire/storage shape → bare typed value. Bare input passes through
 *  (the optimistic cache writes bare rows). */
export function unwrapAttributeValue(raw: unknown): unknown {
  return isEnvelope(raw) ? raw.value : raw;
}

/** Bare-or-wrapped payload → storage envelope, mirroring the
 *  platform's `validateAttributeValue` envelope handling. */
export function toStorageEnvelope(raw: unknown): { value: unknown } {
  return { value: unwrapAttributeValue(raw) };
}
