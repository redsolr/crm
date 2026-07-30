/**
 * Public-board client — typed surface over the platform's anonymous
 * `/api/public/{slug}/feature_requests` + `/api/public/{slug}/changelog`
 * routes.
 *
 * Singleton `featureRequestsApi` is configured with
 * `credentials: 'include'` so the `jurisimus_anon_cookie` set by the
 * platform's `AnonymousPrincipalMiddleware` round-trips correctly —
 * the cookie is the durable upvote identity for anonymous users.
 */
import {
  Configuration,
  FeatureRequestsApi,
  type FeatureRequest,
} from "@/lib/generated/api";

const apiConfig = new Configuration({
  basePath: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080",
  credentials: "include",
});

export const featureRequestsApi = new FeatureRequestsApi(apiConfig);

export type StateCategory = FeatureRequest["state"]["category"];

/** Display order for the kanban — left-to-right pipeline. */
export const STATE_CATEGORIES: ReadonlyArray<StateCategory> = [
  "not_started",
  "active",
  "done",
  "dead",
];

export const STATE_CATEGORY_LABELS: Record<StateCategory, string> = {
  not_started: "Under Review",
  active: "In Progress",
  done: "Shipped",
  dead: "Declined",
};

/** Group a flat feature-request list into kanban columns by category. */
export function groupByStateCategory(
  rows: ReadonlyArray<FeatureRequest>,
): Record<StateCategory, FeatureRequest[]> {
  const buckets: Record<StateCategory, FeatureRequest[]> = {
    not_started: [],
    active: [],
    done: [],
    dead: [],
  };
  for (const row of rows) {
    buckets[row.state.category].push(row);
  }
  return buckets;
}

/** Slug Jurisimus dogfoods on its own marketing site (customer 0). */
export const JURISIMUS_PUBLIC_SLUG =
  process.env.NEXT_PUBLIC_JURISIMUS_PUBLIC_SLUG || "jurisimus";

/**
 * Base URL of the canonical public roadmap renderer (urban-portal /
 * feedback-board). The marketing-shell roadmap + changelog widgets on
 * `app.jurisimus.com` deep-link individual feature-requests to this
 * domain so the FR-detail / comments UX lives in one place. Falls back
 * to the production URL when the env var isn't set; in local dev set
 * `NEXT_PUBLIC_PORTAL_BASE_URL=http://localhost:3003` (or whichever
 * port `feedback-board` runs on) to point deep-links at the local
 * renderer.
 */
export const PORTAL_BASE_URL =
  process.env.NEXT_PUBLIC_PORTAL_BASE_URL ||
  "https://roadmap.jurisimus.com";
