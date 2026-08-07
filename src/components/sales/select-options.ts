/**
 * Prebuilt menu options for the sales vocabulary — one place where the
 * `lib/sales/constants` key lists become `SelectMenu` options, so call
 * sites stop rebuilding identical arrays every render (and the menu's
 * filter memo actually caches). Dynamic lists (attribute configs,
 * table filter columns) keep calling `keyOptions` at the call site.
 */

import { keyOptions, type SelectOption } from "@/components/ui/select";
import {
  ACCOUNT_PRACTICE_AREA_OPTIONS,
  ACCOUNT_SEGMENT_OPTIONS,
  ACCOUNT_SOURCE_OPTIONS,
  CALL_NOTE_CALL_TYPE_OPTIONS,
  CALL_NOTE_OUTCOME_OPTIONS,
  CONTACT_DECISION_ROLE_OPTIONS,
  OPPORTUNITY_LOST_REASON_OPTIONS,
  OPPORTUNITY_USE_CASE_OPTIONS,
  PIPELINE_STAGE_ORDER,
} from "@/lib/sales/constants";
import type { WorkItem } from "@/lib/workItemsApi";

export const SOURCE_SELECT_OPTIONS = keyOptions(ACCOUNT_SOURCE_OPTIONS);
export const SEGMENT_SELECT_OPTIONS = keyOptions(ACCOUNT_SEGMENT_OPTIONS);
export const PRACTICE_AREA_SELECT_OPTIONS = keyOptions(
  ACCOUNT_PRACTICE_AREA_OPTIONS,
);
export const USE_CASE_SELECT_OPTIONS = keyOptions(OPPORTUNITY_USE_CASE_OPTIONS);
export const LOST_REASON_SELECT_OPTIONS = keyOptions(
  OPPORTUNITY_LOST_REASON_OPTIONS,
);
export const OUTCOME_SELECT_OPTIONS = keyOptions(CALL_NOTE_OUTCOME_OPTIONS);
export const CALL_TYPE_SELECT_OPTIONS = keyOptions(CALL_NOTE_CALL_TYPE_OPTIONS);
export const DECISION_ROLE_SELECT_OPTIONS = keyOptions(
  CONTACT_DECISION_ROLE_OPTIONS,
);
export const PIPELINE_STAGE_SELECT_OPTIONS = keyOptions(PIPELINE_STAGE_ORDER);

/** Record list (accounts, …) → menu options: the record ID is the
 *  committed value, the title the label. */
export function recordOptions(records: readonly WorkItem[]): SelectOption[] {
  return records.map((r) => ({ value: r.id, label: r.title }));
}
