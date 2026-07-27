/**
 * Mock handler for cite-check (`POST /v1/legal/matters/:id/check_citations`):
 * a verified citation, a not-found one, and a grounded suggestion. Register
 * alongside the lens + ingestion handlers.
 *
 * Shape mirrors the real response: the §448 suggestion is the corpus cross-ref
 * §420 points to, so its confidence matches the backend's `CROSS_REF_CONFIDENCE`
 * (band `high`, floor 100 — "confirm relevance"). §420 carries an `on_point`
 * relevance verdict; §537 is verified but `review` (a real section off-topic for
 * its claim — the F4 trust signal). This is a UI-render smoke; the
 * verify / not-found / relevance / suggestion LOGIC is proven against the real
 * corpus in `platform/test/legal-citecheck.integration-spec.ts` +
 * `legal-citecheck-semantic.real-llm.integration-spec.ts`.
 */

import { Page } from "@playwright/test";

export async function setupCiteCheckHandlers(page: Page) {
  await page.route(
    (url) =>
      /^\/v1\/legal\/matters\/[^/]+\/check_citations$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          citations: [
            {
              section_no: "420",
              citation: "ป.พ.พ. มาตรา 420",
              context: "the prescription period is set by ป.พ.พ. มาตรา 420",
              status: "verified",
              relevance: {
                verdict: "on_point",
                action: "confirm relevance",
                label: "On point (≥80%) — confirm relevance",
                floor_pct: 80,
              },
              suggestions: [
                {
                  code: "CCC",
                  section_no: "448",
                  citation: "ป.พ.พ. มาตรา 448",
                  confidence: { band: "high", floor_pct: 100 },
                },
              ],
            },
            {
              section_no: "537",
              citation: "ป.พ.พ. มาตรา 537",
              context:
                "the default interest rate is governed by ป.พ.พ. มาตรา 537",
              status: "verified",
              relevance: {
                verdict: "review",
                action: "review relevance",
                label: "The cited section may not support this claim — review",
                floor_pct: 40,
              },
              suggestions: [],
            },
            {
              section_no: "999",
              citation: "มาตรา 999",
              context: "see also มาตรา 999 for completeness",
              status: "not_found",
              suggestions: [],
            },
          ],
          summary: { total: 3, verified: 2, not_found: 1 },
        }),
      });
    },
  );
}
