"use client";

import { create } from "zustand";
import { ApiError } from "@/lib/api-client";
import { termsApiClient, type TermsStatus } from "@/lib/terms/termsApi";
import type { TermsLocale } from "@/lib/terms/presentations";

/**
 * First-AI-use acknowledgment (`ai_ack`) state — spec § 6.2.
 *
 * The platform blocks user-visible generative calls at the LLM seam
 * until the account holds a current `ai_ack` artifact. Two entry paths
 * converge on this store:
 *
 *  1. **Proactive** — `ensureAiAcknowledged()` runs before the first
 *     chat send of a session: one `GET /v1/terms/status`; if `ai_ack`
 *     is outstanding, the modal opens and the send awaits the user's
 *     click, so the happy path never eats a 403 mid-stream.
 *  2. **Fallback** — any other AI surface's 403 dispatches
 *     `terms:ai-ack-required`; `AiAckModalHost` opens the same modal
 *     (the user retries their action after acknowledging).
 *
 * `acknowledged` is a session-lifetime positive cache. A registry
 * version flip mid-session re-403s at the seam and re-enters via the
 * fallback path, so the cache can never mask a stale acknowledgment.
 */

interface AiAckState {
  /** Modal visibility — rendered by `AiAckModalHost`. */
  open: boolean;
  /** Positive cache: this account holds a current ai_ack. */
  acknowledged: boolean;
  /** The ai_ack version rendered in the modal (echoed on POST). */
  version: string | null;
  /** Resolvers of `ensureAiAcknowledged()` calls awaiting the modal. */
  waiters: Array<(ok: boolean) => void>;
}

interface AiAckActions {
  /** Open the modal (fallback path — version fetched lazily on accept). */
  openModal: () => void;
  /** Register a waiter and open the modal (proactive path). */
  awaitAcknowledgment: (version: string | null) => Promise<boolean>;
  /** User accepted and the POST succeeded. */
  resolveAccepted: () => void;
  /** User dismissed the modal without accepting. */
  resolveDismissed: () => void;
  markAcknowledged: () => void;
}

export const useAiAckStore = create<AiAckState & AiAckActions>()((set, get) => ({
  open: false,
  acknowledged: false,
  version: null,
  waiters: [],

  openModal: () => set({ open: true }),

  awaitAcknowledgment: (version) =>
    new Promise<boolean>((resolve) => {
      set((s) => ({
        open: true,
        version: version ?? s.version,
        waiters: [...s.waiters, resolve],
      }));
    }),

  resolveAccepted: () => {
    const { waiters } = get();
    set({ open: false, acknowledged: true, waiters: [] });
    waiters.forEach((w) => w(true));
  },

  resolveDismissed: () => {
    const { waiters } = get();
    set({ open: false, waiters: [] });
    waiters.forEach((w) => w(false));
  },

  markAcknowledged: () => set({ acknowledged: true }),
}));

/**
 * Ensure the account holds a current first-AI-use acknowledgment before
 * an AI action proceeds. Returns `true` when clear to send, `false`
 * when the user dismissed the modal (caller aborts quietly).
 *
 * Errors from the status fetch resolve `true` — availability of chat
 * must not hinge on this pre-flight; if the acknowledgment really is
 * missing, the platform's LLM seam 403s and the fallback event path
 * opens the modal anyway (fail-open here, fail-closed on the server).
 */
export async function ensureAiAcknowledged(): Promise<boolean> {
  const store = useAiAckStore.getState();
  if (store.acknowledged) return true;

  let version: string | null = null;
  try {
    const status = await termsApiClient.getStatus();
    const needsAiAck = status.required_actions.some(
      (a) => a.document_key === "ai_ack",
    );
    if (!needsAiAck) {
      useAiAckStore.getState().markAcknowledged();
      return true;
    }
    version = aiAckVersionFrom(status);
  } catch (err) {
    console.error(
      "[ai-ack] terms status pre-flight failed — deferring to the server-side gate:",
      err,
    );
    return true;
  }

  return useAiAckStore.getState().awaitAcknowledgment(version);
}

function aiAckVersionFrom(status: TermsStatus): string | null {
  return status.documents.find((d) => d.key === "ai_ack")?.version ?? null;
}

async function fetchAiAckVersion(): Promise<string> {
  const version = aiAckVersionFrom(await termsApiClient.getStatus());
  if (version === null) {
    throw new Error("ai_ack version missing from /v1/terms/status");
  }
  return version;
}

/**
 * Record the first-AI-use acknowledgment: resolve the current ai_ack
 * version when the caller doesn't hold one (the 403-fallback path
 * opens the modal without a version), POST the echo, and retry ONCE on
 * a stale echo (`409 terms_version_stale` — the registry revved between
 * render and click; the fresh version is re-fetched, mirroring the gate
 * screen's re-render rule). Throws on any other failure — the caller
 * owns the error surface. Marks the session cache on success.
 */
export async function recordAiAcknowledgment(
  locale: TermsLocale,
  knownVersion: string | null,
): Promise<void> {
  const version = knownVersion ?? (await fetchAiAckVersion());
  try {
    await termsApiClient.acknowledgeAi(locale, [
      { document_key: "ai_ack", version },
    ]);
  } catch (err) {
    if (!(err instanceof ApiError) || err.code !== "terms_version_stale") {
      throw err;
    }
    await termsApiClient.acknowledgeAi(locale, [
      { document_key: "ai_ack", version: await fetchAiAckVersion() },
    ]);
  }
  useAiAckStore.getState().resolveAccepted();
}
