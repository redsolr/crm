import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  attributeDefinitions,
  attributeValues,
  db,
  digests,
} from "@/db";
import { mintId } from "@/db/ids";
import type {
  DigestAttentionItem,
  DigestCommitmentItem,
  DigestDraft,
  DigestPayload,
} from "@/lib/digest";
import {
  rankFollowupSuggestions,
  type FollowupAttributeSnapshot,
} from "@/lib/sales/followup-ranking";
import { SALES_TYPE_KEYS, COMMITMENT_STATE_KEYS } from "@/lib/sales/constants";
import { todayInAppTimeZone } from "./ask-tools";
import { ASK_MODEL, openaiClient } from "./llm";
import { pushConfigured, sendPushToAll, type PushSendReport } from "./push";
import {
  listChildren,
  listWorkItems,
  serializeWorkItem,
} from "./work-items";

/**
 * Morning digest (ambient-digest arc, 2026-08-07): the 07:00-Bangkok
 * cron composes "what deserves attention today" — the SAME deterministic
 * neglect ranking the Summary tab runs (`followup-ranking.ts`), plus
 * open commitments due — drafts follow-up messages for the top
 * actionable deals via the LLM seam, persists one `digests` row per
 * Bangkok date, and web-pushes a one-line summary to every enrolled
 * browser. A same-day re-run refreshes the payload but never
 * re-notifies (`pushedAt` is the once-only latch).
 */

/** Every record the digest may scan, fetched via the standard list. */
const SCAN_LIMIT = 500;

/** How many top-ranked actionable deals get an LLM-drafted follow-up. */
const MAX_DRAFTS = 3;

const ATTENTION_LIMIT = 8;

/** Reasons a follow-up message can actually be sent for — "no next
 *  action" and "stale" need founder thinking, not a canned nudge. */
const DRAFTABLE_REASONS = new Set([
  "overdue_next_action",
  "due_today",
  "revisit_due",
]);

const FOLLOWUP_ATTRIBUTE_KEYS = [
  "next_action_date",
  "next_action",
  "not_now_until",
] as const;

async function listAllOfType(typeKey: string) {
  const { rows } = await listWorkItems({ typeKey }, SCAN_LIMIT, 0);
  return rows.map(serializeWorkItem);
}

/** Project the ranking's attribute subset for a set of opportunities
 *  server-side — the mirror of the client's `useOpportunityAttributes`
 *  snapshot, sourced from one joined query instead of a fan-out. */
async function loadFollowupSnapshots(
  opportunityIds: string[],
): Promise<Record<string, FollowupAttributeSnapshot>> {
  const snapshots: Record<string, FollowupAttributeSnapshot> = {};
  if (opportunityIds.length === 0) return snapshots;

  const rows = await db
    .select({
      itemId: attributeValues.workItemId,
      key: attributeDefinitions.key,
      value: attributeValues.value,
    })
    .from(attributeValues)
    .innerJoin(
      attributeDefinitions,
      eq(attributeValues.definitionId, attributeDefinitions.id),
    )
    .where(inArray(attributeValues.workItemId, opportunityIds));

  for (const row of rows) {
    if (
      !(FOLLOWUP_ATTRIBUTE_KEYS as readonly string[]).includes(row.key)
    ) {
      continue;
    }
    const snapshot = (snapshots[row.itemId] ??= {
      nextActionDate: null,
      nextAction: null,
      notNowUntil: null,
    });
    const value = typeof row.value === "string" ? row.value : null;
    if (row.key === "next_action_date") snapshot.nextActionDate = value;
    if (row.key === "next_action") snapshot.nextAction = value;
    if (row.key === "not_now_until") snapshot.notNowUntil = value;
  }
  return snapshots;
}

const draftsResponseSchema = z.object({
  drafts: z.array(
    z.object({
      opportunity_id: z.string(),
      draft: z.string().min(1),
    }),
  ),
});

interface DraftContext {
  opportunity_id: string;
  identifier: string;
  title: string;
  account_name: string | null;
  stage: string;
  detail: string;
  next_action: string | null;
  latest_call_note: string | null;
}

/**
 * One LLM call drafts every follow-up (strict-JSON response). Failures
 * are surfaced in the payload (`drafts_error`) and logged — the
 * deterministic digest still ships. A missing OPENAI_API_KEY surfaces
 * the same way: the seam's fail-loudly throw becomes the visible
 * error, never a silent empty list.
 */
async function draftFollowups(
  contexts: DraftContext[],
): Promise<{ drafts: Map<string, string>; model: string | null; error: string | null }> {
  if (contexts.length === 0) {
    return { drafts: new Map(), model: null, error: null };
  }
  try {
    const client = openaiClient();
    const response = await client.chat.completions.create({
      model: ASK_MODEL,
      max_completion_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content:
            "You are the founder's sales assistant in a CRM. For each deal " +
            "below, draft a short, warm, specific follow-up message (2-4 " +
            "sentences, plain text, no subject line, no placeholders) the " +
            "founder can send to the firm's contact today. Ground each " +
            "draft in the deal's next action and latest call note; never " +
            "invent facts, names, or dates that are not in the data. " +
            'Return STRICT JSON: {"drafts":[{"opportunity_id":"...",' +
            '"draft":"..."}]} with one entry per deal.\n\nDeals:\n' +
            JSON.stringify(contexts, null, 2),
        },
      ],
    });
    const text = response.choices[0]?.message.content;
    if (!text) throw new Error("LLM returned an empty drafts response");
    const parsed = draftsResponseSchema.parse(JSON.parse(text) as unknown);
    const drafts = new Map(
      parsed.drafts.map((d) => [d.opportunity_id, d.draft]),
    );
    return { drafts, model: response.model, error: null };
  } catch (error) {
    console.error("[digest] follow-up drafting failed:", error);
    return {
      drafts: new Map(),
      model: null,
      error: error instanceof Error ? error.message : "drafting failed",
    };
  }
}

/** Latest call note logged under an opportunity (or null). */
async function latestCallNote(opportunityId: string): Promise<string | null> {
  const children = await listChildren(opportunityId);
  const notes = children.filter((c) => c.type.key === SALES_TYPE_KEYS.call_note);
  const latest = notes[notes.length - 1];
  if (!latest) return null;
  const text = latest.record.description ?? latest.record.subject ?? "";
  return text === "" ? null : text.slice(0, 800);
}

export interface DigestRunResult {
  runDate: string;
  payload: DigestPayload;
  /** Whether THIS run sent the daily push. */
  pushed: boolean;
  /** Why no push went out, when it didn't. */
  pushSkipReason: "already_pushed" | "push_unconfigured" | "nothing_due" | null;
  pushReport: PushSendReport | null;
}

export async function composeDigestPayload(): Promise<DigestPayload> {
  const [opportunities, accounts, commitments] = await Promise.all([
    listAllOfType(SALES_TYPE_KEYS.opportunity),
    listAllOfType(SALES_TYPE_KEYS.account),
    listAllOfType(SALES_TYPE_KEYS.commitment),
  ]);

  const today = todayInAppTimeZone();
  const snapshots = await loadFollowupSnapshots(opportunities.map((o) => o.id));
  const accountsById = Object.fromEntries(accounts.map((a) => [a.id, a]));

  const suggestions = rankFollowupSuggestions(
    opportunities,
    snapshots,
    accountsById,
    { today, nowMs: Date.now() },
    ATTENTION_LIMIT,
  );

  const attention: DigestAttentionItem[] = suggestions.map((s) => ({
    opportunity_id: s.opportunity.id,
    identifier: s.opportunity.identifier,
    title: s.opportunity.title,
    account_name: s.account?.title ?? null,
    reason: s.reason,
    detail: s.detail,
    next_action: s.nextAction,
  }));

  // Open commitments due today or earlier (Bangkok calendar) — the
  // Inbox's "due" bucket, mirrored for the push.
  const dueCommitments: DigestCommitmentItem[] = commitments
    .filter(
      (c) =>
        c.state.key === COMMITMENT_STATE_KEYS.open &&
        c.due_date !== null &&
        c.due_date.slice(0, 10) <= today,
    )
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .map((c) => ({
      commitment_id: c.id,
      identifier: c.identifier,
      title: c.title,
      due_date: c.due_date,
      parent_title:
        c.parent_id !== null
          ? (accountsById[c.parent_id]?.title ??
            opportunities.find((o) => o.id === c.parent_id)?.title ??
            null)
          : null,
    }));

  const draftTargets = suggestions
    .filter((s) => DRAFTABLE_REASONS.has(s.reason))
    .slice(0, MAX_DRAFTS);
  const contexts: DraftContext[] = await Promise.all(
    draftTargets.map(async (s) => ({
      opportunity_id: s.opportunity.id,
      identifier: s.opportunity.identifier,
      title: s.opportunity.title,
      account_name: s.account?.title ?? null,
      stage: s.opportunity.state.key,
      detail: s.detail,
      next_action: s.nextAction,
      latest_call_note: await latestCallNote(s.opportunity.id),
    })),
  );
  const drafted = await draftFollowups(contexts);

  const drafts: DigestDraft[] = draftTargets.flatMap((s) => {
    const draft = drafted.drafts.get(s.opportunity.id);
    if (draft === undefined) return [];
    return [
      {
        opportunity_id: s.opportunity.id,
        identifier: s.opportunity.identifier,
        title: s.opportunity.title,
        account_name: s.account?.title ?? null,
        draft,
      },
    ];
  });

  return {
    run_date: today,
    generated_at: new Date().toISOString(),
    attention,
    due_commitments: dueCommitments,
    drafts,
    drafts_model: drafted.model,
    drafts_error: drafted.error,
  };
}

function pushBody(payload: DigestPayload): string {
  const parts: string[] = [];
  if (payload.attention.length > 0) {
    parts.push(
      `${payload.attention.length} deal${payload.attention.length === 1 ? "" : "s"} need attention`,
    );
  }
  if (payload.due_commitments.length > 0) {
    parts.push(
      `${payload.due_commitments.length} commitment${payload.due_commitments.length === 1 ? "" : "s"} due`,
    );
  }
  if (payload.drafts.length > 0) {
    parts.push(`${payload.drafts.length} drafts ready`);
  }
  return parts.join(" · ");
}

export async function runMorningDigest(): Promise<DigestRunResult> {
  const payload = await composeDigestPayload();
  const runDate = payload.run_date;

  const existing = await db
    .select()
    .from(digests)
    .where(eq(digests.runDate, runDate))
    .limit(1);
  const alreadyPushed = existing[0]?.pushedAt != null;

  await db
    .insert(digests)
    .values({ id: mintId("dig"), runDate, payload })
    .onConflictDoUpdate({
      target: digests.runDate,
      set: { payload, updatedAt: new Date() },
    });

  const body = pushBody(payload);
  let pushed = false;
  let pushSkipReason: DigestRunResult["pushSkipReason"] = null;
  let pushReport: PushSendReport | null = null;

  if (alreadyPushed) {
    pushSkipReason = "already_pushed";
  } else if (body === "") {
    // A quiet pipeline is a fine morning — no bubble about nothing.
    pushSkipReason = "nothing_due";
  } else if (!pushConfigured()) {
    // Env-gated layer (realtime pattern): without VAPID keys the digest
    // still composes and renders in-app; only the push leg is off.
    console.warn("[digest] VAPID keys unset — skipping the push leg");
    pushSkipReason = "push_unconfigured";
  } else {
    pushReport = await sendPushToAll({
      title: "Morning digest",
      body,
      url: "/sales",
      tag: "crm-digest",
    });
    pushed = true;
    await db
      .update(digests)
      .set({ pushedAt: new Date() })
      .where(eq(digests.runDate, runDate));
  }

  return { runDate, payload, pushed, pushSkipReason, pushReport };
}

export async function latestDigest(): Promise<DigestPayload | null> {
  const rows = await db
    .select()
    .from(digests)
    .orderBy(desc(digests.runDate))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return row.payload as DigestPayload;
}
