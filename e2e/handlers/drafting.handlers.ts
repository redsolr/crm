/**
 * Mock handlers for the legal drafting surface (`POST /v1/legal/matters/:id/draft`).
 *
 * Two modes mirror the backend's grounded/abstaining posture:
 *  - `grounded` → returns a memo page (cites only the matter's findings'
 *    §§) so the FE opens it in the document editor.
 *  - `abstain`  → returns `drafted: false` + a "research first" message (the
 *    matter has no findings), so the FE surfaces the notice instead of opening
 *    an empty doc.
 *
 * Register AFTER `setupMattersLabHandlers` so the memo's `GET /v1/pages/:id`
 * runs first (and falls back to the lab handler for any other page id).
 */

import { Page } from "@playwright/test";

const NOW = "2026-06-01T00:00:00.000Z";
const MEMO_ID = "pg-memo-1";
const MEMO_TITLE = "Legal memo";
const MEMO_CONTENT =
  "## Issue\nWhat liability arises?\n\n## Discussion\n" +
  "Under ป.พ.พ. มาตรา 420 the contractor is liable to make compensation.\n\n" +
  "---\n\n**Authorities (grounded in the matter's findings):** ป.พ.พ. มาตรา 420\n\n" +
  "_AI-drafted · unverified — verify each citation against the cited section._";

const ABSTAIN_MESSAGE =
  "This matter has no findings yet, so there is no controlling authority to " +
  "ground a memo on. Run legal research first (ask the matter chat a question " +
  "and add the cited answer to findings), then draft.";

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

export interface DraftingHandlerOptions {
  mode?: "grounded" | "abstain";
}

export async function setupDraftingHandlers(
  page: Page,
  opts: DraftingHandlerOptions = {},
) {
  const mode = opts.mode ?? "grounded";

  await page.route(
    (url) => /^\/v1\/legal\/matters\/[^/]+\/draft$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const matterId = new URL(request.url()).pathname.split("/")[4];
      const body =
        mode === "abstain"
          ? {
              drafted: false,
              page: null,
              citations: [],
              message: ABSTAIN_MESSAGE,
            }
          : {
              drafted: true,
              page: memoPage(matterId),
              citations: ["ป.พ.พ. มาตรา 420"],
              message: "Drafted a grounded memo from the matter findings.",
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
    (url) => /^\/v1\/pages\/[^/]+$/.test(url.pathname),
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
