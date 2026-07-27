import type { Dictionary } from "./dictionary";
import type { Locale } from "./locales";
import { en } from "./dictionaries/en";
import { th } from "./dictionaries/th";

/**
 * Static dictionary lookup. Dictionaries are plain TS modules (not JSON +
 * dynamic import) so the `satisfies Dictionary` check runs at compile time
 * and tree-shaking keeps unused locales out of client bundles — only server
 * components and the localized page itself import them.
 */
const DICTIONARIES: Record<Locale, Dictionary> = { en, th };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
