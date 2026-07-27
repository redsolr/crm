/**
 * Shared pagination envelope types.
 *
 * Two envelope shapes coexist on the platform:
 *
 *  1. Stripe v2 cursor envelope (`CursorPage<T>`) — `data` + `has_more` +
 *     `next_page_url` + `previous_page_url`. Driven by `?page_size=` +
 *     `?page_token=`. The standard for list endpoints since Session 18.
 *
 *  2. Legacy meta envelope (`ListResponse<T>`) — `data` + `meta` block
 *     with `total` / `page` / `limit` / `has_more` / `has_next_page` /
 *     `has_previous_page`. Still used by `accounts` and `projects`.
 *
 * All field names are snake_case to match the BE wire shape per
 * `docs/platform/api-discipline.md` § "Field naming".
 */

/**
 * Stripe v2 cursor-paginated list envelope. The `next_page_url` /
 * `previous_page_url` strings are opaque URL-form tokens — paginate by
 * fetching them directly, not by reconstructing a token. `has_more` is
 * authoritative (the BE doesn't return a `total` for cursor pages).
 */
export interface CursorPage<T> {
  data: T[];
  has_more: boolean;
  next_page_url: string | null;
  previous_page_url: string | null;
}

// Standard list response meta — legacy `?page=&limit=` envelope.
export interface ListMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

// Generic list response — legacy meta envelope. New endpoints use
// `CursorPage<T>` instead.
export interface ListResponse<T> {
  data: T[];
  meta: ListMeta;
}

/**
 * Extract the opaque `page_token` query param from a `CursorPage`'s
 * `next_page_url`. The server signs the token with a fingerprint of
 * the request's filter combination, so we ferry it back unmodified —
 * never reconstruct it client-side. Returns `undefined` when the URL
 * is null/absent or the token query param is missing.
 *
 * SSR-safe: uses a fixed base URL so the parse works identically on
 * the server and client. The base host is irrelevant — we only read
 * the `page_token` query param, never the origin/path.
 */
const PAGE_TOKEN_PARSE_BASE = "http://localhost";

export function extractNextPageToken(
  nextPageUrl: string | null | undefined,
): string | undefined {
  if (nextPageUrl == null || nextPageUrl === "") return undefined;
  try {
    const url = new URL(nextPageUrl, PAGE_TOKEN_PARSE_BASE);
    return url.searchParams.get("page_token") ?? undefined;
  } catch (err) {
    console.warn("[pagination] failed to parse next_page_url", err);
    return undefined;
  }
}
