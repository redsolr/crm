"use client";

import { useState } from "react";

interface ToggleSwitchProps {
  name: string;
  defaultChecked?: boolean;
  label: React.ReactNode;
  "data-testid"?: string;
}

/**
 * Form-friendly switch for the auth pages. Same construction as the
 * settings `Toggle` (see `settings/primitives.tsx`): flex track with
 * `p-[2px]` + an `h-full aspect-square` thumb, so the knob's gaps all
 * equal the padding — symmetric by construction, nothing to drift.
 * The real checkbox stays in the DOM (`sr-only`) so the surrounding
 * <form> submits `name` natively and screen readers get a checkbox.
 * Travel = track 32 − 2×2 padding − 14 thumb = 14px.
 */
export function ToggleSwitch({
  name,
  defaultChecked = false,
  label,
  "data-testid": testId,
}: ToggleSwitchProps) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <label className="auth-toggle flex items-start gap-2.5 cursor-pointer select-none">
      <input
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="sr-only"
        data-testid={testId}
      />
      <span
        aria-hidden
        className={`auth-toggle-track mt-0.5 flex h-[18px] w-8 shrink-0 items-center rounded-full p-[2px] transition-colors ${checked ? "bg-[#FF385C]" : "bg-gray-200"}`}
      >
        <span
          className={`auth-toggle-thumb aspect-square h-full rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-[14px]" : ""}`}
        />
      </span>
      <span className="text-ctx-body text-[13px] leading-relaxed">{label}</span>
    </label>
  );
}
