/**
 * Mock handlers for document ingestion: the presign → S3 PUT → ingest flow used
 * by Lens "Upload PDF / Word…". Mirrors the platform contract:
 *  - `POST /api/uploads/presign` → `{ upload_url, file_url, key }`
 *  - a direct PUT to the (mock) S3 `upload_url`
 *  - `POST /api/legal/matters/:id/ingest_document` → `{ page, source }`
 *
 * The ingested page id is fed back so `useLens` adds a Lens row linked to it
 * (the existing lens handler creates the row). Register alongside the lens +
 * matters-lab handlers.
 */

import { Page } from "@playwright/test";

const MOCK_S3 = "https://mock-s3.example.com";
const INGESTED_PAGE_ID = "pg-ingested-1";

export async function setupIngestionHandlers(page: Page) {
  // 1. Presign — hand back a mock S3 PUT URL + a key.
  await page.route(
    (url) => url.pathname === "/api/uploads/presign",
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const body = (request.postDataJSON() ?? {}) as { file_name?: string };
      const name = body.file_name ?? "upload";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          upload_url: `${MOCK_S3}/upload/${encodeURIComponent(name)}`,
          file_url: `${MOCK_S3}/files/${encodeURIComponent(name)}`,
          key: `uploads/org-e2e/${name}`,
        }),
      });
    },
  );

  // 2. The direct S3 PUT — accept the bytes.
  await page.route(`${MOCK_S3}/**`, async (route, request) => {
    if (request.method() === "PUT") {
      await route.fulfill({ status: 200, body: "" });
      return;
    }
    await route.fallback();
  });

  // 3. Ingest — return the created matter page + provenance source block.
  await page.route(
    (url) => /^\/api\/legal\/matters\/[^/]+\/ingest_document$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const matterId = new URL(request.url()).pathname.split("/")[4];
      const body = (request.postDataJSON() ?? {}) as { file_name?: string };
      const fileName = body.file_name ?? "document.pdf";
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          page: {
            id: INGESTED_PAGE_ID,
            title: fileName.replace(/\.[^.]+$/, ""),
            content: "Governing law: State of New York.",
            matter_id: matterId,
          },
          source: {
            attachment_id: "att-1",
            kind: fileName.endsWith(".docx") ? "docx" : "pdf",
            page_count: 1,
            char_count: 33,
          },
        }),
      });
    },
  );

  return { ingestedPageId: INGESTED_PAGE_ID };
}
