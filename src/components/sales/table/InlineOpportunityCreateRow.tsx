"use client";

/**
 * Jira-style inline create row for the pipeline table — the create
 * modal's three required fields (title / account / use case) in one
 * compact strip; every other detail lands later via inline cells or
 * the peek panel. Enter creates, Escape cancels. At the list end
 * ("+ Create") the row stays open and clears for rapid entry (Jira
 * behavior); between rows it closes once the record lands.
 */

import { useRef, useState } from "react";
import type { WorkItem } from "@/lib/workItemsApi";
import { SelectMenu } from "@/components/ui/select";
import {
  USE_CASE_SELECT_OPTIONS,
  recordOptions,
} from "../select-options";

export interface InlineOpportunityInput {
  title: string;
  accountId: string;
  useCase: string;
}

const INLINE_INPUT_CLASS =
  "px-2.5 py-1.5 rounded-md bg-[var(--theme-bg-tertiary)] border border-[var(--theme-border-secondary)] text-[13px] text-[var(--claude-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-text-muted)]";

interface Props {
  accounts: WorkItem[];
  /** True when the slot is the table end — the form then stays open
   *  and clears after each create instead of closing. */
  atEnd: boolean;
  onSubmit: (input: InlineOpportunityInput) => Promise<void>;
  onClose: () => void;
}

export function InlineOpportunityCreateRow({
  accounts,
  atEnd,
  onSubmit,
  onClose,
}: Props) {
  const [title, setTitle] = useState("");
  const [accountId, setAccountId] = useState("");
  const [useCase, setUseCase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    title.trim().length > 0 &&
    accountId !== "" &&
    useCase !== "" &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), accountId, useCase });
      if (atEnd) {
        // Rapid entry: keep company/use case, clear the title, go again.
        setTitle("");
        titleRef.current?.focus();
      } else {
        onClose();
      }
    } catch (err) {
      console.error("[InlineOpportunityCreateRow] create failed:", err);
      setError("Could not create the opportunity. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="crm-inline-create-form"
      data-testid="sales-pipeline-inline-create-form"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <input
        ref={titleRef}
        type="text"
        autoFocus
        className={`crm-inline-create-title ${INLINE_INPUT_CLASS}`}
        placeholder="What's the opportunity?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        data-testid="sales-pipeline-inline-title"
      />
      <SelectMenu
        className={INLINE_INPUT_CLASS}
        ariaLabel="Account"
        value={accountId}
        onChange={setAccountId}
        options={recordOptions(accounts)}
        placeholder="Company…"
        searchPlaceholder="Search companies…"
        testId="sales-pipeline-inline-account"
      />
      <SelectMenu
        className={INLINE_INPUT_CLASS}
        ariaLabel="Use case"
        value={useCase}
        onChange={setUseCase}
        options={USE_CASE_SELECT_OPTIONS}
        placeholder="Use case…"
        testId="sales-pipeline-inline-use-case"
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
      <button
        type="submit"
        className="crm-btn-primary crm-inline-create-submit"
        disabled={!canSubmit}
        data-testid="sales-pipeline-inline-submit"
      >
        {submitting ? "Creating…" : "Create"}
      </button>
      <button
        type="button"
        className="crm-btn-ghost crm-inline-create-cancel"
        onClick={onClose}
        data-testid="sales-pipeline-inline-cancel"
      >
        Cancel
      </button>
    </form>
  );
}
