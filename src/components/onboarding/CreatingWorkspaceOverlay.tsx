"use client";

/**
 * Full-screen "setting up your workspace" moment — Slack's creating-workspace
 * flourish. Five brand-colored petals orbit and pulse while the org is
 * actually being provisioned (the overlay is shown for the real async call,
 * with a minimum display time so it doesn't flicker). Escapes the auth card
 * via `fixed inset-0`.
 */

const PETALS = ["#FF385C", "#3B82F6", "#10B981", "#F59E0B", "#7C3AED"];

export function CreatingWorkspaceOverlay({
  workspaceName,
}: {
  workspaceName: string;
}) {
  return (
    <div className="onboarding-overlay onboarding-creating fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0a0a] text-white">
      <div className="onboarding-flower" aria-hidden>
        {PETALS.map((color, i) => (
          <span
            key={color}
            className="onboarding-petal"
            style={
              {
                backgroundColor: color,
                "--petal-index": i,
                "--petal-angle": `${i * 72}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <p className="onboarding-creating-title mt-10 text-lg font-semibold">
        Setting up your workspace…
      </p>
      {workspaceName.trim() && (
        <p className="onboarding-creating-sub mt-1 text-sm text-white/50">
          Getting {workspaceName.trim()} ready for you
        </p>
      )}
    </div>
  );
}
