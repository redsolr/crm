/**
 * Pure grouping + routing logic for the global-search dialog.
 *
 * Search hits for CRM records are work items on the wire
 * (`source_type: "task"`, `source_id: "wi_..."`); WHAT a record is
 * (company / deal / contact / call note) rides `metadata.typeKey` —
 * the work-item type key the platform indexer stamps on every task
 * hit (see `search-indexer.service.ts#indexTask`). Everything the
 * dialog needs to label, group, and route a hit lives here so it can
 * be unit-tested without a DOM.
 */

import type { SearchHit } from "@/lib/searchApi";
import { SALES_TYPE_KEYS } from "./constants";

export type SearchResultKind =
  | "account"
  | "opportunity"
  | "contact"
  | "call_note"
  | "other";

/** Section order + human labels — Companies first, junk drawer last. */
export const SEARCH_GROUP_ORDER: ReadonlyArray<{
  kind: SearchResultKind;
  label: string;
}> = [
  { kind: "account", label: "Companies" },
  { kind: "opportunity", label: "Deals" },
  { kind: "contact", label: "Contacts" },
  { kind: "call_note", label: "Call notes" },
  { kind: "other", label: "Other" },
];

function metadataString(hit: SearchHit, key: string): string | null {
  const value = hit.metadata?.[key];
  return typeof value === "string" && value !== "" ? value : null;
}

/** Classify a hit by its work-item type key (unknown/absent → other). */
export function kindOfHit(hit: SearchHit): SearchResultKind {
  switch (metadataString(hit, "typeKey")) {
    case SALES_TYPE_KEYS.account:
      return "account";
    case SALES_TYPE_KEYS.opportunity:
      return "opportunity";
    case SALES_TYPE_KEYS.contact:
      return "contact";
    case SALES_TYPE_KEYS.call_note:
      return "call_note";
    default:
      return "other";
  }
}

/** Human identifier (e.g. `SAL-12`) when the hit carries one. */
export function identifierOfHit(hit: SearchHit): string | null {
  return metadataString(hit, "identifier");
}

/**
 * Where opening a hit navigates:
 * - account → its detail page; opportunity → its detail page;
 * - contact → the contacts list (no per-contact page);
 * - call_note → its parent opportunity when the hit carries one
 *   (`metadata.parentId`), else the pipeline;
 * - anything else → the pipeline.
 */
export function routeForHit(hit: SearchHit): string {
  switch (kindOfHit(hit)) {
    case "account":
      return `/sales/account/${hit.source_id}`;
    case "opportunity":
      return `/sales/opportunity/${hit.source_id}`;
    case "contact":
      return "/sales/contacts";
    case "call_note": {
      const parentId = metadataString(hit, "parentId");
      return parentId !== null ? `/sales/opportunity/${parentId}` : "/sales";
    }
    case "other":
      return "/sales";
  }
}

export interface SearchResultGroup {
  kind: SearchResultKind;
  label: string;
  hits: SearchHit[];
}

/**
 * Bucket hits into the fixed group order, preserving backend rank
 * within each group. Empty groups are dropped.
 */
export function groupHits(hits: SearchHit[]): SearchResultGroup[] {
  const buckets = new Map<SearchResultKind, SearchHit[]>();
  for (const hit of hits) {
    const kind = kindOfHit(hit);
    const bucket = buckets.get(kind);
    if (bucket) {
      bucket.push(hit);
    } else {
      buckets.set(kind, [hit]);
    }
  }
  return SEARCH_GROUP_ORDER.filter((g) => buckets.has(g.kind)).map((g) => ({
    kind: g.kind,
    label: g.label,
    hits: buckets.get(g.kind) ?? [],
  }));
}
