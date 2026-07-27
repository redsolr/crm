/**
 * Locale configuration — single source of truth for marketing i18n.
 *
 * English is the default locale and lives at the URL root (`/`, `/plans`)
 * so existing SEO equity is untouched. Every other locale is subpathed
 * (`/th`, `/th/plans`). Adding a locale = one entry here + one dictionary
 * file in `src/lib/i18n/dictionaries/` — the `Dictionary` type makes any
 * missing key a compile error.
 */

export const LOCALES = ["en", "th"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Locales that render at a URL subpath (everything except the default). */
export const SUBPATH_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

/**
 * Cookie remembering the visitor's chosen language so return visits can be
 * routed to their locale. Marketing-only — the app shell is not localized.
 */
export const LOCALE_COOKIE = "jurisimus-locale";

/** Native-script label for the language switcher. No flags — quiet luxury. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  th: "ไทย",
};

/** BCP 47 / Open Graph locale identifiers per locale. */
export const OG_LOCALES: Record<Locale, string> = {
  en: "en_US",
  th: "th_TH",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Build the URL path for a marketing page in a given locale.
 * `localePath("en", "/plans")` → `/plans`; `localePath("th", "/")` → `/th`.
 */
export function localePath(locale: Locale, path = "/"): string {
  const normalized = path === "/" ? "" : path;
  if (locale === DEFAULT_LOCALE) return normalized === "" ? "/" : normalized;
  return `/${locale}${normalized}`;
}
