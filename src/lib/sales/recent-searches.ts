/**
 * Recent-search memory for the global search surfaces.
 *
 * A successful search (the user opened a hit) records its query in
 * localStorage so the empty dropdown can offer it back next time,
 * Slack-style. MRU order, deduped case-insensitively, capped small —
 * this is a convenience shelf, not a history feature.
 */

const STORAGE_KEY = "crm-recent-searches";
const MAX_ENTRIES = 5;

function readRaw(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is string => typeof entry === "string" && entry !== ""
    );
  } catch (error) {
    console.warn("[recent-searches] failed to read stored searches:", error);
    return [];
  }
}

export function readRecentSearches(): string[] {
  return readRaw().slice(0, MAX_ENTRIES);
}

export function recordRecentSearch(term: string): void {
  const trimmed = term.trim();
  if (trimmed === "") return;
  const lower = trimmed.toLowerCase();
  const next = [
    trimmed,
    ...readRaw().filter((entry) => entry.toLowerCase() !== lower),
  ].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("[recent-searches] failed to persist searches:", error);
  }
}

export function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("[recent-searches] failed to clear searches:", error);
  }
}
