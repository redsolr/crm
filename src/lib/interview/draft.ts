/**
 * localStorage draft persistence for an in-progress interview.
 *
 * A live call must survive an accidental tab close / refresh, so the
 * whole session state is written on every change, keyed by
 * opportunity id. Parsed through Zod on load — a stale or corrupted
 * draft (schema drift between deploys) is discarded rather than
 * crashing interview mode mid-meeting.
 */

import { z } from "zod";
import type { AdhocQuestion, AnswerMap } from "./script-schema";

const answerSchema = z.object({
  question_id: z.string(),
  choice_keys: z.array(z.string()),
  note: z.string(),
});

const adhocSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  after_id: z.string(),
  section: z.string(),
});

const draftSchema = z.object({
  script_key: z.string(),
  answers: z.record(z.string(), answerSchema),
  adhoc: z.array(adhocSchema),
  cursor: z.number().int(),
  started_at: z.number(),
});

export interface InterviewDraft {
  script_key: string;
  answers: AnswerMap;
  adhoc: AdhocQuestion[];
  cursor: number;
  started_at: number;
}

const STORAGE_KEY_PREFIX = "crm-interview-draft-";

function storageKey(opportunityId: string): string {
  return `${STORAGE_KEY_PREFIX}${opportunityId}`;
}

/** Opportunity ids with an in-progress local draft — the Interviews
 *  tab's "resume" rows. Corrupted entries are skipped here (they're
 *  validated + pruned on the actual load). Safe to call from a state
 *  initializer: returns [] where localStorage doesn't exist (SSR). */
export function listInterviewDraftOpportunityIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const ids: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        ids.push(key.slice(STORAGE_KEY_PREFIX.length));
      }
    }
    return ids;
  } catch (error) {
    console.warn("[interview-draft] list failed:", error);
    return [];
  }
}

export function loadInterviewDraft(
  opportunityId: string,
  scriptKey: string,
): InterviewDraft | null {
  try {
    const raw = window.localStorage.getItem(storageKey(opportunityId));
    if (!raw) return null;
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.script_key !== scriptKey) {
      console.warn(
        "[interview-draft] discarding stale/invalid draft for",
        opportunityId,
      );
      window.localStorage.removeItem(storageKey(opportunityId));
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.error("[interview-draft] load failed:", error);
    return null;
  }
}

export function saveInterviewDraft(
  opportunityId: string,
  draft: InterviewDraft,
): void {
  try {
    window.localStorage.setItem(
      storageKey(opportunityId),
      JSON.stringify(draft),
    );
  } catch (error) {
    // Quota / private-mode failure: the interview keeps working, it
    // just loses crash-resume. Worth a warning, never a crash.
    console.warn("[interview-draft] save failed:", error);
  }
}

export function clearInterviewDraft(opportunityId: string): void {
  try {
    window.localStorage.removeItem(storageKey(opportunityId));
  } catch (error) {
    console.warn("[interview-draft] clear failed:", error);
  }
}
