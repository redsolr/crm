/**
 * Sales activation-ladder helper.
 *
 * Five PostHog events fire as the user works through their first
 * founder-led sales motion. Each rung is fired AT MOST ONCE per
 * browser; subsequent invocations are suppressed via a localStorage
 * receipt. Server-side analytics (per-tenant) lives on the activity
 * event_store; this helper exists only for the in-product activation
 * funnel.
 */

import { trackEvent } from "@/lib/tracking/posthog";
import {
  ACTIVATION_EVENTS,
  ACTIVATION_STORAGE_KEY,
} from "./constants";

type ActivationEventKey = keyof typeof ACTIVATION_EVENTS;

function readReceipts(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ACTIVATION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed !== null && typeof parsed === "object") {
      return parsed as Record<string, string>;
    }
    return {};
  } catch (err) {
    console.warn(
      "[sales/activation] failed to read activation receipts, treating as empty",
      err,
    );
    return {};
  }
}

function writeReceipts(receipts: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVATION_STORAGE_KEY, JSON.stringify(receipts));
  } catch {
    // Quota / private mode — swallow, the event itself already fired.
  }
}

/**
 * Fire an activation event if it hasn't fired yet for this browser.
 * No-op when the rung was already crossed.
 */
export function fireActivation(
  rung: ActivationEventKey,
  properties?: Record<string, unknown>,
): void {
  const event = ACTIVATION_EVENTS[rung];
  const receipts = readReceipts();
  if (event in receipts) return;
  trackEvent(event, properties);
  receipts[event] = new Date().toISOString();
  writeReceipts(receipts);
}

/**
 * Test / admin helper — wipes the activation receipt so a given rung
 * can be re-fired. Exposed because Phase 4's onboarding wizard may
 * re-anchor users mid-funnel and we don't want stale receipts to
 * suppress legitimate re-emits.
 */
export function clearActivationReceipts(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACTIVATION_STORAGE_KEY);
  } catch {
    /* swallow */
  }
}
