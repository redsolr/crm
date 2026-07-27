"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  consumePendingTermsGateNavigation,
  TERMS_ACCEPTANCE_REQUIRED_EVENT,
} from "@/lib/terms/gate-events";

/**
 * Routes to the full-screen `/accept-terms` gate whenever any API call
 * 403s with `terms_acceptance_required` (dispatched by
 * `notifyTermsGate403` from the API client / chat stream). Mounted once
 * in the root layout — the gate can fire from any surface: app views,
 * checkout, settings, the sales shell.
 *
 * Two paths converge here:
 *  - the window event, for 403s after mount;
 *  - the pending-navigation latch, for 403s from a page's FIRST
 *    fetches, which can fire before this effect subscribes — the
 *    dispatch would otherwise be lost and the user left on a broken
 *    page (every call 403s, nothing re-triggers).
 *
 * The ai_ack-only 403 dispatches a DIFFERENT event
 * (`terms:ai-ack-required`, handled by `AiAckModalHost`) — this
 * listener never sees it, so an outstanding first-AI-use acknowledgment
 * doesn't yank the user off their page (spec § 6.2: blocking for AI
 * surfaces only).
 */
export function TermsGateListener() {
  const router = useRouter();

  useEffect(() => {
    const navigateToGate = () => {
      // Consume the latch so a later remount can't replay a stale
      // pre-acceptance dispatch.
      consumePendingTermsGateNavigation();
      if (window.location.pathname === "/accept-terms") return;
      router.replace("/accept-terms");
    };

    if (consumePendingTermsGateNavigation()) {
      navigateToGate();
    }

    window.addEventListener(TERMS_ACCEPTANCE_REQUIRED_EVENT, navigateToGate);
    return () =>
      window.removeEventListener(
        TERMS_ACCEPTANCE_REQUIRED_EVENT,
        navigateToGate,
      );
  }, [router]);

  return null;
}
