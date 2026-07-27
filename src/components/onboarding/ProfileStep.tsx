"use client";

import { LabeledInput } from "./LabeledInput";
import {
  getInitials,
  colorFromSeed,
  BRAND_AVATAR_COLORS,
} from "@/lib/avatar";

export function ProfileStep({
  fullName,
  onChange,
}: {
  fullName: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="onboarding-profile space-y-5">
      <LabeledInput
        label="Your name"
        value={fullName}
        onChange={onChange}
        placeholder="e.g. Kreethup Hiranphan"
        maxLength={120}
        autoFocus
        showValid
      />

      <div className="onboarding-profile-photo">
        <p className="ctx-label">
          Profile photo{" "}
          <span className="text-ctx-muted font-normal">(optional)</span>
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div
            className="onboarding-profile-avatar flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-sm"
            style={{
              backgroundColor: colorFromSeed(fullName, BRAND_AVATAR_COLORS),
            }}
            aria-hidden
          >
            {getInitials(fullName)}
          </div>
          <p className="text-xs text-ctx-muted">
            We’ll use your initials for now — you can upload a photo from
            settings once you’re in.
          </p>
        </div>
      </div>
    </div>
  );
}
