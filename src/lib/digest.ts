import type { FollowupReason } from "./sales/followup-ranking";

/**
 * Morning-digest wire shapes — shared verbatim by the server composer
 * (`src/server/digest.ts`), the `/api/digest/*` routes, and the
 * Summary-tab card, so the payload can never drift between the cron
 * and the page.
 */

export interface DigestAttentionItem {
  opportunity_id: string;
  identifier: string;
  title: string;
  account_name: string | null;
  reason: FollowupReason;
  detail: string;
  next_action: string | null;
}

export interface DigestCommitmentItem {
  commitment_id: string;
  identifier: string;
  title: string;
  /** ISO timestamp, or null when the commitment has no due date. */
  due_date: string | null;
  parent_title: string | null;
}

export interface DigestDraft {
  opportunity_id: string;
  identifier: string;
  title: string;
  account_name: string | null;
  /** LLM-drafted follow-up message, ready to copy. */
  draft: string;
}

export interface DigestPayload {
  /** Bangkok `YYYY-MM-DD` this digest describes. */
  run_date: string;
  /** ISO timestamp of composition. */
  generated_at: string;
  attention: DigestAttentionItem[];
  due_commitments: DigestCommitmentItem[];
  drafts: DigestDraft[];
  /** Model that produced `drafts`, or null when drafting was skipped. */
  drafts_model: string | null;
  /** Non-null when draft generation failed — surfaced, never silent. */
  drafts_error: string | null;
}
