/**
 * Mock handlers for document analysis ("which CCC sections apply?"): the
 * `POST /api/legal/matters/:id/analyze_document` result + the `POST
 * /api/legal/findings` create the "Add to findings" button fires. Register
 * alongside the lens + ingestion handlers.
 */

import { Page } from "@playwright/test";

export interface AnalysisHandlerOptions {
  /** "grounded" → returns applicable sections; "abstain" → none found. */
  mode?: "grounded" | "abstain";
}

export async function setupAnalysisHandlers(
  page: Page,
  opts: AnalysisHandlerOptions = {},
) {
  const mode = opts.mode ?? "grounded";

  await page.route(
    (url) =>
      /^\/api\/legal\/matters\/[^/]+\/analyze_document$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const body =
        mode === "abstain"
          ? { sections: [], abstained: true, chunks_analyzed: 1, chunks_total: 1 }
          : {
              sections: [
                {
                  code: "CCC",
                  section_no: "537",
                  citation: "ป.พ.พ. มาตรา 537",
                  preview_th: "อันว่าเช่าทรัพย์สินนั้น…",
                  basis: "cited-in-passage",
                  confidence: {
                    band: "high",
                    action: "verify",
                    floor_pct: 88,
                    label: "high",
                  },
                  passage: "This lease agreement governs the premises.",
                },
              ],
              abstained: false,
              chunks_analyzed: 1,
              chunks_total: 1,
            };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    },
  );

  // "Add to findings" → POST /api/legal/findings.
  await page.route(
    (url) => url.pathname === "/api/legal/findings",
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const body = (request.postDataJSON() ?? {}) as {
        issue?: string;
        work_item_id?: string;
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          finding: {
            id: "lfn-applicable-1",
            issue: body.issue ?? "Applicable section",
            status: "open",
            verified: false,
            work_item_id: body.work_item_id ?? null,
          },
        }),
      });
    },
  );
}
