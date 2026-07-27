"use client";

import { BRAND_AVATAR_COLORS, colorFromSeed, getInitials } from "@/lib/avatar";

/**
 * Round initials avatar for people (contacts). Companies get the square
 * `CompanyLogo`; people get a circle — the same shape distinction Attio
 * and Linear use so the two record kinds scan differently at a glance.
 */
export function PersonAvatar({
  name,
  size = 18,
}: {
  name: string;
  /** Diameter in px (default 18 — table inline scale). */
  size?: number;
}) {
  return (
    <span
      className="crm-person-avatar crm-company-logo-fallback"
      data-testid="crm-person-avatar"
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        borderRadius: 9999,
        width: size,
        height: size,
        fontSize: Math.max(8, Math.round(size * 0.42)),
        background: colorFromSeed(name, BRAND_AVATAR_COLORS),
      }}
    >
      {getInitials(name)}
    </span>
  );
}
