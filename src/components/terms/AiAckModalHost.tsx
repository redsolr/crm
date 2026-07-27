"use client";

import { useCallback, useEffect, useState } from "react";
import { recordAiAcknowledgment, useAiAckStore } from "@/stores/ai-ack.store";
import { ApiError } from "@/lib/api-client";
import { TERMS_AI_ACK_REQUIRED_EVENT } from "@/lib/terms/gate-events";
import { AI_ACK_MODAL } from "@/lib/terms/presentations";
import { useTermsLocale } from "@/lib/terms/locale";

/**
 * The first-AI-use acknowledgment modal (spec § 6.2) — copy is the
 * platform's `TERMS_PRESENTATIONS.ai_ack_modal`, verbatim (the POST
 * records a hash of exactly this text; see
 * `src/lib/terms/presentations.ts`).
 *
 * Opens from two paths: `ensureAiAcknowledged()` before a chat send
 * (proactive — the send awaits the click), and the
 * `terms:ai-ack-required` window event when any other AI surface's call
 * 403s at the platform's LLM seam (fallback — the user retries their
 * action after acknowledging). Dismissible (ESC / backdrop): the
 * acknowledgment blocks AI surfaces only, never the rest of the app.
 *
 * Mounted once in the root layout.
 */
export function AiAckModalHost() {
  const open = useAiAckStore((s) => s.open);
  const version = useAiAckStore((s) => s.version);
  const locale = useTermsLocale();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleRequired = () => useAiAckStore.getState().openModal();
    window.addEventListener(TERMS_AI_ACK_REQUIRED_EVENT, handleRequired);
    return () =>
      window.removeEventListener(TERMS_AI_ACK_REQUIRED_EVENT, handleRequired);
  }, []);

  // Clear any prior failure whenever the modal (re-)opens.
  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const dismiss = useCallback(() => {
    if (submitting) return;
    useAiAckStore.getState().resolveDismissed();
  }, [submitting]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, dismiss]);

  const accept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Version resolution + stale-echo retry live in the store module
      // (`recordAiAcknowledgment`) — this component owns only the UI.
      await recordAiAcknowledgment(locale, version);
    } catch (err) {
      console.error("[AiAckModalHost] ai_ack acknowledgment failed:", err);
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong — please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  const copy = AI_ACK_MODAL[locale];

  return (
    <div
      role="presentation"
      className="ai-ack-overlay fixed inset-0 z-[10050] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        // Backdrop-only dismissal — clicks inside the dialog bubble up
        // with a different target. Keyboard dismissal is the window
        // ESC listener above.
        if (e.target === e.currentTarget) dismiss();
      }}
      data-testid="ai-ack-modal"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-ack-title"
        className="ai-ack-modal w-full max-w-md rounded-2xl bg-[var(--theme-bg-primary,#212121)] border border-[var(--theme-border,rgba(255,255,255,0.1))] p-6 shadow-2xl"
      >
        <h2
          id="ai-ack-title"
          className="ai-ack-title text-lg font-semibold text-[var(--theme-text-primary,#ececec)]"
        >
          {copy.title}
        </h2>
        {/* The EN body carries the platform text's hard line breaks
            (hashed verbatim) — normal whitespace collapses them to
            spaces so the paragraph wraps naturally. */}
        <p className="ai-ack-body mt-3 text-sm leading-relaxed text-[var(--theme-text-secondary,#b4b4b4)]">
          {copy.body}
        </p>
        {error !== null && (
          <p className="ai-ack-error mt-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          data-testid="ai-ack-accept"
          onClick={() => void accept()}
          disabled={submitting}
          className="ai-ack-accept mt-5 w-full rounded-xl bg-[var(--theme-accent,#2ea043)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {copy.button}
        </button>
      </div>
    </div>
  );
}
