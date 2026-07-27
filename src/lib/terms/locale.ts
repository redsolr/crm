import { useSyncExternalStore } from "react";
import { LOCALE_COOKIE, isLocale } from "../i18n/locales";
import type { TermsLocale } from "./presentations";

/**
 * Resolve the locale for terms surfaces (the gate screen, the ai_ack
 * modal, the chat disclaimer). The app shell itself is not localized —
 * this is a per-surface decision because the acceptance event records
 * `locale_displayed` and the presentation hash differs per locale.
 *
 * Order: the marketing locale cookie (the visitor already chose a
 * language on the landing/marketing pages) → browser language → `en`.
 */
export function detectTermsLocale(): TermsLocale {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`),
    );
    const fromCookie = match?.[1];
    if (fromCookie !== undefined && isLocale(fromCookie)) return fromCookie;
  }
  if (typeof navigator !== "undefined") {
    if (navigator.language.toLowerCase().startsWith("th")) return "th";
  }
  return "en";
}

const noopSubscribe = () => () => {};
const serverSnapshot = (): TermsLocale => "en";

/**
 * Hydration-safe read of the terms locale: SSR renders `en`, the client
 * snapshot reads the cookie/browser language. `useSyncExternalStore`
 * avoids the setState-in-effect cascade a mount effect would cause.
 */
export function useTermsLocale(): TermsLocale {
  return useSyncExternalStore(noopSubscribe, detectTermsLocale, serverSnapshot);
}
