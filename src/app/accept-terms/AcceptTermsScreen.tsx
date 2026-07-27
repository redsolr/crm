"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { ApiError } from "@/lib/api-client";
import { authService } from "@/lib/authTokenManager";
import { setPreferenceCookie } from "@/lib/cookies";
import { LOCALE_COOKIE, LOCALE_LABELS } from "@/lib/i18n/locales";
import { detectTermsLocale } from "@/lib/terms/locale";
import {
  GATE_BUTTON,
  GATE_CARDS,
  GATE_CHECKBOX,
  GATE_CHROME,
  GATE_HEADLINE,
  type TermsGateVariant,
  type TermsLocale,
} from "@/lib/terms/presentations";
import { termsApiClient, type TermsStatus } from "@/lib/terms/termsApi";

/** Post-acceptance landing — mirrors the auth callback's destination. */
const APP_HOME = "/sales";

const CARD_ICONS = ["🧭", "⚠️", "🔒"] as const;

type ScreenState =
  | { kind: "loading" }
  | { kind: "load-failed" }
  | { kind: "hold" }
  | { kind: "gate"; status: TermsStatus; variant: TermsGateVariant };

/**
 * The § 6.1 gate screen, rendered in the sign-in pages' card style
 * (velvet-dark page, white `card-light` card). Copy fidelity is
 * load-bearing: headline, the three key-terms cards, the
 * capacity-specific checkbox label, and the button text are the
 * platform's `TERMS_PRESENTATIONS` verbatim — the acceptance event
 * records a hash of exactly that copy (drift gate:
 * `src/__tests__/terms-presentations.test.ts`).
 */
export function AcceptTermsScreen() {
  const router = useRouter();
  // View-only preview (`?preview=1` gate / `?preview=hold`; `&variant=
  // member` for the member wording): renders the screen with the REAL
  // current document versions regardless of acceptance state. The
  // ledger is append-only by grant, so there is no "reset acceptance"
  // — this is the sanctioned way to see the screen again (a repeat
  // accept in preview is an idempotent server-side no-op).
  const searchParams = useSearchParams();
  const previewParam = searchParams.get("preview");
  const previewVariant: TermsGateVariant =
    searchParams.get("variant") === "member" ? "gate_member" : "gate_signatory";
  const [locale, setLocale] = useState<TermsLocale>("en");
  const [screen, setScreen] = useState<ScreenState>({ kind: "loading" });
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [staleNotice, setStaleNotice] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setLocale(detectTermsLocale());
  }, []);

  const loadStatus = useCallback(async (): Promise<void> => {
    setScreen({ kind: "loading" });
    try {
      const status = await termsApiClient.getStatus();
      if (previewParam !== null) {
        if (previewParam === "hold") {
          setScreen({ kind: "hold" });
          return;
        }
        setChecked(false);
        setScreen({ kind: "gate", status, variant: previewVariant });
        return;
      }
      if (!status.acceptance_required) {
        router.replace(APP_HOME);
        return;
      }
      if (status.blocked_on_owner) {
        setScreen({ kind: "hold" });
        return;
      }
      const variant: TermsGateVariant = status.required_actions.some(
        (a) => a.capacity === "organization_signatory",
      )
        ? "gate_signatory"
        : "gate_member";
      setChecked(false);
      setScreen({ kind: "gate", status, variant });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      console.error("[AcceptTermsScreen] terms status load failed:", err);
      setScreen({ kind: "load-failed" });
    }
  }, [router, previewParam, previewVariant]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const chrome = GATE_CHROME[locale];

  const accept = async () => {
    if (screen.kind !== "gate" || !checked || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Echo EXACTLY what this screen rendered: the tos + privacy_notice
      // versions from the status the cards were built from (spec § 4).
      const echoed = screen.status.documents
        .filter((d) => d.key === "tos" || d.key === "privacy_notice")
        .map((d) => ({ document_key: d.key, version: d.version }));
      const result = await termsApiClient.acceptTos(locale, echoed);
      if (!result.acceptance_required) {
        router.replace(APP_HOME);
        return;
      }
      // Still gated after a recorded acceptance — a member whose owner
      // hasn't signed yet. Re-evaluate; the hold screen takes over.
      setStaleNotice(false);
      await loadStatus();
    } catch (err) {
      if (err instanceof ApiError && err.code === "terms_version_stale") {
        // The registry revved between render and click: re-fetch and
        // re-render with the fresh versions (spec § 6.1 item 5).
        setStaleNotice(true);
        await loadStatus();
      } else {
        console.error("[AcceptTermsScreen] acceptance failed:", err);
        setSubmitError(
          err instanceof ApiError
            ? err.message
            : "Something went wrong — please try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = () => {
    void authService.logout();
  };

  const switchLocale = (next: TermsLocale) => {
    setLocale(next);
    setPreferenceCookie(LOCALE_COOKIE, next);
  };

  return (
    <div
      className="accept-terms-page auth-page velvet-dark fixed inset-0 z-[10000] flex flex-col overflow-y-auto"
      data-testid="accept-terms-page"
    >
      {/* Header — mirrors the (auth) layout: logo left, locale right. */}
      <div className="accept-terms-header shrink-0 z-20 px-4">
        <div className="mx-auto max-w-[1300px]">
          <div className="flex h-14 items-center justify-between md:h-16">
            <BrandLogo />
            <div
              className="accept-terms-locale flex gap-1"
              role="group"
              aria-label="Language"
            >
              {(["en", "th"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => switchLocale(l)}
                  aria-pressed={locale === l}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    locale === l
                      ? "bg-white/15 text-white"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {LOCALE_LABELS[l]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Card wrapper — same structure as the sign-in pages. */}
      <div className="accept-terms-card-wrapper relative z-10 flex w-full flex-1 items-start justify-center px-3 py-4 sm:px-4 sm:py-8 md:items-center">
        <div className="accept-terms-card card-light relative w-full max-w-[520px] rounded-2xl bg-white px-4 pb-6 pt-6 text-gray-900 shadow-[0_20px_60px_rgba(10,37,64,0.1)] sm:px-8 sm:pb-7 sm:pt-7">
          {screen.kind === "loading" && (
            <p className="accept-terms-loading py-16 text-center text-sm text-gray-400">
              …
            </p>
          )}

          {screen.kind === "load-failed" && (
            <div className="accept-terms-load-failed py-10 text-center">
              <p className="text-sm text-gray-600">{chrome.loadFailed}</p>
              <button
                type="button"
                onClick={() => void loadStatus()}
                className="mt-4 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                {chrome.retry}
              </button>
            </div>
          )}

          {screen.kind === "hold" && (
            <div
              className="accept-terms-hold py-10 text-center"
              data-testid="terms-hold-screen"
            >
              <h1 className="text-2xl font-semibold text-gray-900">
                {chrome.holdTitle}
              </h1>
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-gray-600">
                {chrome.holdBody}
              </p>
            </div>
          )}

          {screen.kind === "gate" && (
            <div className="accept-terms-gate">
              {previewParam !== null && (
                <p
                  className="accept-terms-preview-note mb-4 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-500"
                  data-testid="terms-preview-note"
                >
                  Preview — your recorded acceptance is unchanged.
                </p>
              )}
              <h1 className="accept-terms-headline text-[22px] font-semibold leading-snug tracking-tight text-gray-900 sm:text-2xl">
                {GATE_HEADLINE[locale]}
              </h1>

              {staleNotice && (
                <p
                  className="accept-terms-stale mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                  role="alert"
                  data-testid="terms-stale-notice"
                >
                  {chrome.staleBanner}
                </p>
              )}

              <div className="accept-terms-cards mt-5 grid gap-2.5">
                {GATE_CARDS[locale].map((card, i) => {
                  // Each card is one hashed "title — body" string; split
                  // on the FIRST " — " for typography only — the visible
                  // words are the string, unchanged.
                  const sep = card.indexOf(" — ");
                  const title = card.slice(0, sep);
                  const body = card.slice(sep + 3);
                  return (
                    <div
                      key={CARD_ICONS[i]}
                      className="accept-terms-card-item rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                    >
                      <p className="text-[14px] leading-relaxed text-gray-600">
                        <span aria-hidden="true" className="mr-2">
                          {CARD_ICONS[i]}
                        </span>
                        <strong className="font-semibold text-gray-900">
                          {title}
                        </strong>
                        {" — "}
                        {body}
                      </p>
                    </div>
                  );
                })}
              </div>

              <p className="accept-terms-links mt-4 text-sm text-gray-600">
                <a
                  href="https://jurisimus.com/legal/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#7c3aed] underline underline-offset-4 hover:text-[#6d28d9]"
                >
                  {chrome.readToS}
                </a>
                {" · "}
                <a
                  href="https://jurisimus.com/legal/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#7c3aed] underline underline-offset-4 hover:text-[#6d28d9]"
                >
                  {chrome.readPrivacy}
                </a>
              </p>

              {/* Standout consent row: the checkbox is the legal act —
                  large purple control, purple-tinted frame that
                  brightens once ticked. */}
              <label
                className={`accept-terms-checkbox mt-5 flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3.5 transition-colors ${
                  checked
                    ? "border-[#7c3aed] bg-[#7c3aed]/[0.06]"
                    : "border-[#7c3aed]/40 bg-white hover:border-[#7c3aed]/70"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  data-testid="terms-agree-checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-[#7c3aed]"
                />
                <span className="text-sm leading-relaxed text-gray-800">
                  {GATE_CHECKBOX[screen.variant][locale]}
                </span>
              </label>

              {submitError !== null && (
                <p
                  className="accept-terms-error mt-3 text-sm text-red-600"
                  role="alert"
                >
                  {submitError}
                </p>
              )}

              <button
                type="button"
                onClick={() => void accept()}
                disabled={!checked || submitting}
                data-testid="terms-agree-continue"
                className="accept-terms-continue mt-4 w-full rounded-xl bg-[#7c3aed] px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
              >
                {submitting ? chrome.submitting : GATE_BUTTON[locale]}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer — quiet sign-out, the only other exit (spec § 6.1). */}
      <footer className="accept-terms-footer z-10 flex shrink-0 justify-center px-8 py-4">
        <button
          type="button"
          onClick={signOut}
          data-testid="terms-sign-out"
          className="accept-terms-signout text-xs font-semibold text-white/40 transition-colors hover:text-white/70"
        >
          {chrome.signOut}
        </button>
      </footer>
    </div>
  );
}
