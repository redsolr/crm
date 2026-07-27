/**
 * Company-domain helpers for logo rendering (Attio-style: every account
 * row/card leads with the company's favicon). The domain derives from the
 * account's `company_url` attribute — no new template field needed.
 */

/** Bare hostname (no `www.`) from a URL-ish string, or null when unusable. */
export function domainFromUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  // Free-text values that aren't URLs are expected — initials fallback, not
  // an error path, so parse-check instead of try/catch.
  if (!URL.canParse(withScheme)) return null;
  const host = new URL(withScheme).hostname;
  if (!host.includes(".")) return null;
  return host.replace(/^www\./i, "").toLowerCase();
}

/** Favicon URL for a domain (Google s2 service — no API key, CDN-cached). */
export function faviconUrl(domain: string, size = 64): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}
