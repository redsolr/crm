"use client";

import { useState } from "react";
import Image from "next/image";
import { BRAND_AVATAR_COLORS, colorFromSeed, getInitials } from "@/lib/avatar";
import { faviconUrl } from "@/lib/sales/company-domain";

/**
 * Company logo tile — favicon when the account has a usable domain
 * (`company_url` attribute), deterministic initials tile otherwise or when
 * the favicon fails to load. The Attio visual signature: every account
 * reference leads with this.
 *
 * `unoptimized`: favicons are ~1 KB external icons — routing them through
 * the Next image optimizer adds latency and a remotePatterns config for
 * zero gain.
 */
export function CompanyLogo({
  name,
  domain,
  size = 16,
}: {
  name: string;
  domain: string | null;
  /** Square edge in px (default 16 — card/table inline scale). */
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showFavicon = domain !== null && !failed;

  if (showFavicon) {
    return (
      <Image
        className="crm-company-logo"
        data-testid="crm-company-logo"
        src={faviconUrl(domain, 64)}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        unoptimized
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className="crm-company-logo crm-company-logo-fallback"
      data-testid="crm-company-logo-fallback"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(8, Math.round(size * 0.45)),
        background: colorFromSeed(name, BRAND_AVATAR_COLORS),
      }}
    >
      {getInitials(name)}
    </span>
  );
}
