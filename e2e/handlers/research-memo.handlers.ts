/**
 * Mock handlers for the research-memo surface
 * (`POST /api/legal/matters/:id/research_memo`).
 *
 * Two modes mirror the backend's grounded/abstaining posture:
 *  - `grounded` → returns a memo page (cites only the §§ research surfaced) so
 *    the FE opens it in the document editor.
 *  - `abstain`  → returns `researched: false` + a "refine the question" message
 *    (research found no controlling authority), so the FE surfaces the notice
 *    instead of opening an empty doc.
 *
 * Register AFTER `setupMattersLabHandlers` so the memo's `GET /api/pages/:id`
 * runs first (and falls back to the lab handler for any other page id).
 */

import { Page } from "@playwright/test";

const NOW = "2026-06-01T00:00:00.000Z";
const MEMO_ID = "pg-research-memo-1";
const MEMO_TITLE = "Research memo: prescription period";
const MEMO_CONTENT =
  "## Question\nWhat is the prescription period for a tort claim?\n\n" +
  "## Discussion\nUnder ป.พ.พ. มาตรา 448 a claim for damages from a wrongful " +
  "act prescribes one year after the injured party learns of it.\n\n" +
  "## Conclusion\nThe claim is time-barred after one year.\n\n" +
  "---\n\n**Authorities (grounded in researched CCC sections):** ป.พ.พ. มาตรา 448\n\n" +
  "_AI-researched · unverified — verify each citation against the cited section._";

const ABSTAIN_MESSAGE =
  "Research found no controlling Civil & Commercial Code authority for this " +
  "question in the corpus. The workbench abstains rather than answer from " +
  "general knowledge — refine the question, or ingest the governing document.";

function memoPage(matterId: string | null): Record<string, unknown> {
  return {
    id: MEMO_ID,
    title: MEMO_TITLE,
    content: MEMO_CONTENT,
    matter_id: matterId,
    folder_id: null,
    icon: null,
    version: 0,
    position: 0,
    created_at: NOW,
    updated_at: NOW,
  };
}

export interface ResearchMemoHandlerOptions {
  mode?: "grounded" | "abstain";
}

export async function setupResearchMemoHandlers(
  page: Page,
  opts: ResearchMemoHandlerOptions = {},
) {
  const mode = opts.mode ?? "grounded";

  await page.route(
    (url) =>
      /^\/api\/legal\/matters\/[^/]+\/research_memo$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const matterId = new URL(request.url()).pathname.split("/")[4];
      const body =
        mode === "abstain"
          ? {
              researched: false,
              page: null,
              citations: [],
              sections: [],
              message: ABSTAIN_MESSAGE,
            }
          : {
              researched: true,
              page: memoPage(matterId),
              citations: ["ป.พ.พ. มาตรา 448"],
              sections: [
                {
                  code: "CCC",
                  section_no: "448",
                  citation: "ป.พ.พ. มาตรา 448",
                  preview_th: "สิทธิเรียกร้องค่าเสียหาย…",
                  confidence: { band: "medium", floor_pct: 60 },
                },
              ],
              message: "Wrote a memo grounded in the researched authority.",
            };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    },
  );

  // The memo's own page read — so `selectNote` → MatterNoteEditor opens it with
  // content. Any other page id falls back to the matters-lab handler.
  await page.route(
    (url) => /^\/api\/pages\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      const id = new URL(request.url()).pathname.split("/").pop() ?? "";
      if (request.method() !== "GET" || id !== MEMO_ID) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ page: memoPage(null) }),
      });
    },
  );

  return { memoId: MEMO_ID, memoTitle: MEMO_TITLE };
}
