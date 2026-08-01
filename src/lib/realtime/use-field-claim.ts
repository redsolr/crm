"use client";

/**
 * Field claims — "Nan is editing this field" (Attio-class field-level
 * presence, commit-based collaboration's answer to edit conflicts: you
 * SEE a field is taken before you type into it).
 *
 * A claim is just presence data: each client folds its focused field
 * key into its `view` (see `publishFieldFocus` in the connection
 * hook); this selector answers "which colleague holds field X of
 * record Y right now". First claimant wins the render (with two seats
 * there is no meaningful contention).
 */

import {
  selectOthers,
  useRealtimeStore,
  type RealtimePeer,
} from "./realtime-store";

export function useFieldClaim(
  recordId: string,
  fieldKey: string,
): RealtimePeer | null {
  return useRealtimeStore((s) => {
    const others = selectOthers(s);
    return (
      others.find(
        (p) =>
          p.view?.recordId === recordId && p.view?.fieldKey === fieldKey,
      ) ?? null
    );
  });
}
