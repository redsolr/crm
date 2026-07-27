"use client";

import { useState } from "react";
import { WELCOME_TABS } from "./onboarding-data";

/**
 * Full-screen welcome carousel shown once the workspace exists — the warm,
 * professional "here's what you can do" finale. Three Slack-parity cards plus
 * four lawyer-specific cards. Each slide pairs a gradient hero with a short
 * value statement; users can step through or skip straight in.
 */
export function WelcomeTabsOverlay({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const tab = WELCOME_TABS[index];
  const isLast = index === WELCOME_TABS.length - 1;

  return (
    <div className="onboarding-overlay onboarding-welcome-tabs fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0a] px-4 py-8 text-white">
      <div className="onboarding-tabs-card relative flex w-full max-w-[820px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141414] md:flex-row">
        {/* Skip */}
        <button
          type="button"
          onClick={onDone}
          className="onboarding-tabs-skip absolute right-4 top-4 z-10 rounded-md px-2 py-1 text-xs font-medium text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          Skip
        </button>

        {/* Hero */}
        <div
          key={tab.id}
          className="onboarding-tabs-hero onboarding-tabs-hero-in flex min-h-[220px] items-center justify-center p-10 md:w-1/2"
          style={{
            background: `linear-gradient(135deg, ${tab.from}, ${tab.to})`,
          }}
        >
          <span className="text-7xl drop-shadow-lg" aria-hidden>
            {tab.emoji}
          </span>
        </div>

        {/* Body */}
        <div className="onboarding-tabs-body flex flex-1 flex-col justify-center p-8 md:p-10">
          <p className="text-xs font-bold uppercase tracking-wider text-[#FF7591]">
            Welcome to Jurisimus
          </p>
          <h2
            key={`${tab.id}-title`}
            className="onboarding-tabs-title onboarding-tabs-text-in mt-2 text-2xl font-bold"
          >
            {tab.title}
          </h2>
          <p
            key={`${tab.id}-body`}
            className="onboarding-tabs-text onboarding-tabs-text-in mt-2 text-sm leading-relaxed text-white/70"
          >
            {tab.body}
          </p>

          {/* Dots */}
          <div className="onboarding-tabs-dots mt-6 flex items-center gap-1.5">
            {WELCOME_TABS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                aria-label={`Go to ${t.title}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index
                    ? "w-6 bg-[#FF385C]"
                    : "w-1.5 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="onboarding-tabs-actions mt-7 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className={`text-sm font-medium text-white/50 transition-colors hover:text-white ${
                index === 0 ? "pointer-events-none opacity-0" : ""
              }`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => (isLast ? onDone() : setIndex((i) => i + 1))}
              className="rounded-xl bg-[#FF385C] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#E61E4D]"
            >
              {isLast ? "Get started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
