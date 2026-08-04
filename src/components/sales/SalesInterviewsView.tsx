"use client";

/**
 * Interviews tab — quick access to the live discovery interview.
 *
 * The interview overlay itself is unchanged (InterviewMode); this view
 * removes the two-clicks-deep entry path: "New interview" quick-creates
 * (or reuses) the account + opportunity and drops straight into the
 * script. Below the CTA: in-progress local drafts (resume a call that
 * lost its tab) and every past interview across the workspace with its
 * signal summary — the tour's interview log in one list.
 *
 * `?new=1` opens the quick-create on mount (the ⌘K "Start interview"
 * action deep-links here).
 */

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import { BRAND_CTA_CLASS } from "./form";
import {
  useAccountsQuery,
  useCallNotesQuery,
  useOpportunitiesQuery,
} from "@/lib/sales/use-sales-queries";
import { useAttributeValuesByItem } from "@/lib/sales/use-item-attribute-values";
import { defKeyIndex, stringValuesByKey } from "@/lib/sales/attribute-projection";
import { SALES_TYPE_KEYS } from "@/lib/sales/constants";
import { listInterviewDraftOpportunityIds } from "@/lib/interview/draft";
import { isInterviewNote } from "@/lib/interview/interview-note";
import type { InterviewScript } from "@/lib/interview/script-schema";
import type { WorkItem } from "@/lib/workItemsApi";
import { InterviewMode } from "./interview/InterviewMode";
import { NewInterviewModal } from "./interview/NewInterviewModal";

interface ActiveInterview {
  opportunity: WorkItem;
  script?: InterviewScript;
}

export function SalesInterviewsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { bundle, isLoading: bundleLoading } = useSalesWorkspaceBundle();
  const workspaceId = bundle?.workspace.id;

  const accounts = useAccountsQuery(workspaceId);
  const opportunities = useOpportunitiesQuery(workspaceId);
  const callNotes = useCallNotesQuery(workspaceId);

  // ⌘K deep-link: /sales/interviews?new=1 opens the quick-create —
  // seeded at mount, and render-time prop sync (the React-docs
  // "adjust state during render" pattern) covers an in-place client
  // navigation to ?new=1 without a remount.
  const wantsNew = searchParams.get("new") === "1";
  const [showNewModal, setShowNewModal] = useState(wantsNew);
  const [prevWantsNew, setPrevWantsNew] = useState(wantsNew);
  if (wantsNew !== prevWantsNew) {
    setPrevWantsNew(wantsNew);
    if (wantsNew) setShowNewModal(true);
  }

  const [active, setActive] = useState<ActiveInterview | null>(null);

  // ── In-progress local drafts → resumable rows ─────────────────────
  // localStorage has no same-document change events, so this is read
  // at mount and refreshed by the overlay-close handlers below — the
  // only moments a draft can appear or clear.
  const [draftIds, setDraftIds] = useState<string[]>(
    listInterviewDraftOpportunityIds,
  );
  function closeInterview() {
    setActive(null);
    setDraftIds(listInterviewDraftOpportunityIds());
  }
  const opportunitiesById = useMemo(() => {
    const map: Record<string, WorkItem> = {};
    for (const o of opportunities.data?.data ?? []) map[o.id] = o;
    return map;
  }, [opportunities.data?.data]);
  const draftRows = useMemo(
    () =>
      draftIds
        .map((id) => opportunitiesById[id])
        .filter((o): o is WorkItem => o !== undefined),
    [draftIds, opportunitiesById],
  );

  // ── Past interviews = interview-titled call notes ─────────────────
  const interviewNotes = useMemo(
    () =>
      (callNotes.data?.data ?? [])
        .filter((n) => isInterviewNote(n.title))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [callNotes.data?.data],
  );

  const noteAttrValues = useAttributeValuesByItem(interviewNotes);
  const noteDefIndex = useMemo(() => {
    const callNoteType = bundle?.workItemTypes.find(
      (t) => t.key === SALES_TYPE_KEYS.call_note,
    );
    const callNoteDefs = callNoteType
      ? bundle?.attributeDefinitionsByType[callNoteType.id] ?? []
      : [];
    return defKeyIndex(callNoteDefs);
  }, [bundle?.workItemTypes, bundle?.attributeDefinitionsByType]);

  if (bundleLoading || !bundle) {
    return (
      <div className="sales-interviews-view flex-1 min-w-0 flex items-center justify-center">
        <span className="text-sm text-[var(--theme-text-muted)]">
          Loading interviews…
        </span>
      </div>
    );
  }

  return (
    <div
      className="sales-interviews-view flex-1 min-w-0 flex flex-col min-h-0"
      data-testid="sales-interviews-view"
    >
      <div className="crm-view-header">
        <h1 className="crm-view-title">Interviews</h1>
        <span className="crm-view-meta">
          {interviewNotes.length > 0 && `${interviewNotes.length} done`}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          data-testid="interviews-new-button"
          onClick={() => setShowNewModal(true)}
          className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium ${BRAND_CTA_CLASS}`}
        >
          ▶ New interview
        </button>
      </div>

      <div className="sales-interviews-body flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {/* Reading column, centered on the SCREEN at wide widths (the
            .crm-screen-center rail compensation) — a left-flushed list
            in a 1600px window reads off-axis. */}
        <div className="sales-interviews-column crm-screen-center w-full max-w-[860px] mx-auto space-y-6">
        {/* ── Resume drafts ── */}
        {draftRows.length > 0 && (
          <section className="interview-drafts" data-testid="interview-drafts">
            <h2 className="text-[11px] uppercase tracking-wider text-[var(--theme-text-muted)] mb-2">
              In progress
            </h2>
            <div className="space-y-1.5">
              {draftRows.map((opp) => (
                <div
                  key={opp.id}
                  className="interview-draft-row flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)]"
                  data-testid={`interview-draft-${opp.id}`}
                >
                  <span className="flex-1 truncate text-sm text-[var(--theme-text-primary)]">
                    {opp.title}
                  </span>
                  {/* Utility action on a repeating row — neutral, not
                      the brand CTA (one red CTA per view: New
                      interview owns it here). */}
                  <button
                    type="button"
                    data-testid={`interview-resume-${opp.id}`}
                    onClick={() => setActive({ opportunity: opp })}
                    className="px-3 py-1 rounded-md text-[12px] font-medium border border-[var(--theme-border-hover)] text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-hover)] transition-colors"
                  >
                    Resume
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Past interviews ── */}
        <section className="interview-history" data-testid="interview-history">
          <h2 className="text-[11px] uppercase tracking-wider text-[var(--theme-text-muted)] mb-2">
            Done
          </h2>
          {callNotes.isLoading ? (
            <p className="text-sm text-[var(--theme-text-muted)]">Loading…</p>
          ) : interviewNotes.length === 0 ? (
            <div
              className="interview-empty-state text-center py-12"
              data-testid="interviews-empty-state"
            >
              <p className="text-sm text-[var(--theme-text-secondary)] mb-1">
                No interviews yet.
              </p>
              <p className="text-[13px] text-[var(--theme-text-muted)]">
                Tap ▶ New interview as the meeting starts — the pipeline
                records are created for you.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {interviewNotes.map((note) => {
                const attrs = stringValuesByKey(
                  noteAttrValues[note.id] ?? [],
                  noteDefIndex,
                );
                return (
                  <button
                    key={note.id}
                    type="button"
                    data-testid={`interview-note-${note.id}`}
                    onClick={() => {
                      if (note.parent_id) {
                        router.push(`/sales/opportunity/${note.parent_id}`);
                      }
                    }}
                    className="interview-history-row w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] hover:border-[var(--theme-border-hover)] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm text-[var(--theme-text-primary)]">
                        {note.title}
                      </p>
                      {attrs.summary && (
                        <p className="truncate text-[12px] text-[var(--theme-text-muted)] mt-0.5">
                          {attrs.summary}
                        </p>
                      )}
                    </div>
                    {attrs.outcome && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)]">
                        {attrs.outcome.replace(/_/g, " ")}
                      </span>
                    )}
                    <span className="text-[12px] tabular-nums text-[var(--theme-text-muted)]">
                      {attrs.call_date ?? note.created_at.slice(0, 10)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
        </div>
      </div>

      {showNewModal && (
        <NewInterviewModal
          bundle={bundle}
          accounts={accounts.data?.data ?? []}
          onClose={() => setShowNewModal(false)}
          onLaunch={(opportunity, script) => {
            setShowNewModal(false);
            setActive({ opportunity, script });
          }}
        />
      )}

      {active && (
        <InterviewMode
          bundle={bundle}
          opportunity={active.opportunity}
          script={active.script}
          onClose={closeInterview}
          onSaved={closeInterview}
        />
      )}
    </div>
  );
}
