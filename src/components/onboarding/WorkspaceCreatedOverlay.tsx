"use client";

import {
  FREE_PLAN_HIGHLIGHTS,
  PRO_PLAN_HIGHLIGHTS,
} from "./onboarding-data";

/**
 * Full-screen "workspace ready" celebration with a SOFT, solo-friendly plan
 * offer (no paywall): the Free plan is framed as the happy default, with Pro
 * shown as "what you can add later." Primary CTA continues on Free.
 */
export function WorkspaceCreatedOverlay({
  workspaceName,
  fullName,
  onContinue,
}: {
  workspaceName: string;
  fullName: string;
  onContinue: () => void;
}) {
  const firstName = fullName.trim().split(/\s+/)[0] || "there";

  return (
    <div className="onboarding-overlay onboarding-created fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#0a0a0a] px-4 py-10 text-white">
      <div className="onboarding-created-card w-full max-w-[460px] text-center">
        <div className="onboarding-created-emoji text-5xl">🎉</div>
        <h1 className="onboarding-created-title mt-4 text-2xl font-bold">
          {workspaceName.trim() || "Your workspace"} is ready
        </h1>
        <p className="onboarding-created-sub mt-1 text-sm text-white/60">
          You’re all set, {firstName}. Here’s what you’ve got.
        </p>

        <div className="onboarding-plan-card mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-[#FF7591]">
            Your Free plan includes
          </p>
          <ul className="mt-3 space-y-2">
            {FREE_PLAN_HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-center gap-2.5 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                {h}
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold text-white/40">
              Pro adds, whenever you grow
            </p>
            <ul className="mt-2 space-y-1.5">
              {PRO_PLAN_HIGHLIGHTS.map((h) => (
                <li
                  key={h}
                  className="flex items-center gap-2.5 text-sm text-white/50"
                >
                  <span className="text-white/30" aria-hidden>
                    +
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="onboarding-created-continue mt-6 w-full rounded-xl bg-[#FF385C] px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#E61E4D]"
        >
          Continue with Free
        </button>
        <p className="mt-3 text-xs text-white/40">
          You can upgrade anytime from Settings → Plan.
        </p>
      </div>
    </div>
  );
}
