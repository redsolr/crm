/**
 * Mock handler for grounded redline (`POST /v1/legal/matters/:id/suggest_revision`):
 * a suggested revision of a flagged clause, grounded in §448. Register alongside
 * the cite-check handlers — the redline affordance lives in the cite-check modal.
 *
 * The grounded / abstain / ungrounded-reject LOGIC is proven against the backend
 * in `platform/test/legal-redline.integration-spec.ts`; this is a UI-render smoke.
 */

import { Page } from "@playwright/test";

export async function setupRedlineHandlers(page: Page) {
  await page.route(
    (url) =>
      /^\/v1\/legal\/matters\/[^/]+\/suggest_revision$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggested: true,
          original:
            "Clause 2: the prescription period is set by ป.พ.พ. มาตรา 420.",
          revision:
            "Clause 2: the prescription period is one year under ป.พ.พ. มาตรา 448.",
          grounding: {
            section_no: "448",
            citation: "ป.พ.พ. มาตรา 448",
            preview_th: "ตัวอย่าง มาตรา 448",
          },
          message: "Proposed a revision grounded in ป.พ.พ. มาตรา 448.",
        }),
      });
    },
  );

  // Accept the redline — write it into the document.
  await page.route(
    (url) => /^\/v1\/legal\/matters\/[^/]+\/apply_revision$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          applied: true,
          page: {
            id: "pg_doc",
            title: "Draft memo",
            content:
              "Clause 2: the prescription period is one year under ป.พ.พ. มาตรา 448.",
            version: 2,
          },
        }),
      });
    },
  );
}
