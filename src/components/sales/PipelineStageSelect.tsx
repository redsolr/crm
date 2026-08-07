"use client";

/**
 * The record-page stage select (peek panel + opportunity detail header
 * share it verbatim): closed stages are INTERCEPTED — `lost` requires
 * `lost_reason`, `not_now` requires `not_now_until`, and the host's
 * TransitionToClosedModal writes the attribute before the workflow
 * transition — while every other stage PATCHes directly.
 *
 * The pipeline TABLE keeps its own `StageSelectCell` — that one layers
 * optimistic pending state over the list refetch, a different job.
 */

import { SelectMenu } from "@/components/ui/select";
import { useTransitionWorkItem } from "@/lib/sales/use-sales-mutations";
import { PIPELINE_STAGE_SELECT_OPTIONS } from "./select-options";
import type { WorkItem } from "@/lib/workItemsApi";

export function PipelineStageSelect({
  record,
  onClosedTransition,
  className,
  testId,
}: {
  record: WorkItem;
  /** Host opens its TransitionToClosedModal with the intercepted stage. */
  onClosedTransition: (next: "lost" | "not_now") => void;
  /** Site-specific trigger sizing/surface classes. */
  className?: string;
  testId?: string;
}) {
  const transition = useTransitionWorkItem();
  return (
    <SelectMenu
      value={record.state.key}
      onChange={(next) => {
        if (next === "lost" || next === "not_now") {
          onClosedTransition(next);
          return;
        }
        transition.mutate({
          id: record.id,
          version: record.version,
          state_key: next,
        });
      }}
      options={PIPELINE_STAGE_SELECT_OPTIONS}
      searchable={false}
      className={className}
      testId={testId}
      ariaLabel="Pipeline stage"
    />
  );
}
