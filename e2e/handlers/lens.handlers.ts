/**
 * Mock handlers for the Lens (matter-scoped tabular document review) surface
 * (`/v1/lens`). Stateful in-memory store: GET assembles the grid from the
 * accumulated review/columns/rows/cells; POST review/column/row append; PUT
 * cell upserts on (row, column); DELETE removes a column/row.
 *
 * Wire shapes mirror the platform DTOs — snake_case, prefixed IDs, under
 * `/v1/`. Pair with `setupWorkspaceHandlers` + `setupMattersLabHandlers`.
 */

import { Page } from "@playwright/test";

const NOW = "2026-06-01T00:00:00.000Z";

interface LensReviewState {
  id: string;
  matter_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}
interface LensColumnState {
  id: string;
  label: string;
  prompt: string | null;
  format: string;
  position: number;
}
interface LensRowState {
  id: string;
  name: string;
  doc_type: string | null;
  source_page_id: string | null;
  position: number;
}
interface LensCellState {
  id: string;
  row_id: string;
  column_id: string;
  value: string;
  source_excerpt: string | null;
  status: "manual" | "filled" | "unanchored" | "not_found";
  verified_at: string | null;
}

interface LensColumnTemplateState {
  id: string;
  name: string;
  columns: Array<{ label: string; prompt: string; format: string }>;
  created_at: string;
}

interface LensExtractionJobState {
  id: string;
  review_id: string;
  column_id: string;
  status: "pending" | "running" | "completed" | "failed";
  total_rows: number;
  processed_rows: number;
  cells_written: number;
  skipped_rows: number;
  failed_rows: number;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface LensMockHandle {
  /** The matter the in-memory review belongs to (set on first review create). */
  reviewMatterId: () => string | null;
}

export async function setupLensHandlers(page: Page): Promise<LensMockHandle> {
  // One review per matter (the contract is idempotent per matter). The spec
  // exercises a single matter, so a single review object is sufficient — keyed
  // by matter_id so a second matter would get its own.
  const reviews = new Map<string, LensReviewState>();
  const columns: LensColumnState[] = [];
  const rows: LensRowState[] = [];
  const cells: LensCellState[] = [];
  const templates: LensColumnTemplateState[] = [];
  const jobs = new Map<string, LensExtractionJobState>();
  let seq = 0;
  const nextId = (prefix: string): string => {
    seq += 1;
    return `${prefix}_${seq}`;
  };

  // The (row, column) matrix-invariant upsert — one home for the cell write,
  // shared by the manual PUT handler and the AI-extract handler (mirrors the
  // backend's `upsertLensCell`). Any value write clears verification.
  const upsertCellState = (
    rowId: string,
    columnId: string,
    patch: Pick<LensCellState, "value" | "source_excerpt" | "status">,
  ): LensCellState => {
    let cell = cells.find(
      (c) => c.row_id === rowId && c.column_id === columnId,
    );
    if (cell) {
      Object.assign(cell, patch);
      cell.verified_at = null;
    } else {
      cell = {
        id: nextId("lcel"),
        row_id: rowId,
        column_id: columnId,
        ...patch,
        verified_at: null,
      };
      cells.push(cell);
    }
    return cell;
  };

  // GET /v1/lens?matter_id=… → assemble the grid for that matter.
  await page.route(
    (url) => url.pathname === "/v1/lens",
    async (route, request) => {
      if (request.method() !== "GET") {
        await route.fallback();
        return;
      }
      const matterId = new URL(request.url()).searchParams.get("matter_id");
      const review = matterId ? (reviews.get(matterId) ?? null) : null;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          review,
          columns: columns.slice(),
          rows: rows.slice(),
          cells: cells.slice(),
        }),
      });
    },
  );

  // POST /v1/lens/reviews {matter_id, name?} → existing or new review.
  await page.route(
    (url) => url.pathname === "/v1/lens/reviews",
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const body = (request.postDataJSON() ?? {}) as {
        matter_id?: string;
        name?: string;
      };
      const matterId = body.matter_id ?? "wi-matter-acme";
      let review = reviews.get(matterId);
      if (!review) {
        review = {
          id: nextId("lrev"),
          matter_id: matterId,
          name: body.name ?? "Document review",
          created_at: NOW,
          updated_at: NOW,
        };
        reviews.set(matterId, review);
      }
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ review }),
      });
    },
  );

  // POST /v1/lens/reviews/:reviewId/columns {label, prompt?, format?} → column
  await page.route(
    (url) => /^\/v1\/lens\/reviews\/[^/]+\/columns$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const body = (request.postDataJSON() ?? {}) as {
        label?: string;
        prompt?: string;
        format?: string;
      };
      const column: LensColumnState = {
        id: nextId("lcol"),
        label: body.label ?? "Untitled",
        prompt: body.prompt ?? null,
        format: body.format ?? "text",
        position: columns.length,
      };
      columns.push(column);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ column }),
      });
    },
  );

  // POST /v1/lens/reviews/:reviewId/rows {name, doc_type?, source_page_id?} → row
  await page.route(
    (url) => /^\/v1\/lens\/reviews\/[^/]+\/rows$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const body = (request.postDataJSON() ?? {}) as {
        name?: string;
        doc_type?: string;
        source_page_id?: string;
      };
      const row: LensRowState = {
        id: nextId("lrow"),
        name: body.name ?? "Untitled.pdf",
        doc_type: body.doc_type ?? null,
        source_page_id: body.source_page_id ?? null,
        position: rows.length,
      };
      rows.push(row);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ row }),
      });
    },
  );

  // PUT /v1/lens/reviews/:reviewId/cells {row_id, column_id, value, …} → upsert
  await page.route(
    (url) => /^\/v1\/lens\/reviews\/[^/]+\/cells$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "PUT") {
        await route.fallback();
        return;
      }
      const body = (request.postDataJSON() ?? {}) as {
        row_id?: string;
        column_id?: string;
        value?: string;
        source_excerpt?: string;
      };
      const cell = upsertCellState(body.row_id ?? "", body.column_id ?? "", {
        value: body.value ?? "",
        source_excerpt: body.source_excerpt ?? null,
        status: "manual",
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ cell }),
      });
    },
  );

  // POST /v1/lens/reviews/:reviewId/columns/:columnId/extract → AI auto-fill.
  // Mocks the extraction: for each row WITH a linked document, upsert a
  // `filled` cell with a canned value + source excerpt; rows with no document
  // are skipped + reported in `skipped_row_ids` (mirrors the backend's
  // "never invent" gate + loud-failure response shape). The real BE runs the
  // LLM with the verbatim-anchor guard.
  await page.route(
    (url) =>
      /^\/v1\/lens\/reviews\/[^/]+\/columns\/[^/]+\/extract$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const parts = new URL(request.url()).pathname.split("/");
      const columnId = parts[parts.length - 2];
      const written: LensCellState[] = [];
      const skipped: string[] = [];
      for (const row of rows) {
        if (row.source_page_id == null) {
          skipped.push(row.id); // nothing groundable — skip + report
          continue;
        }
        written.push(
          upsertCellState(row.id, columnId, {
            value: "State of New York",
            source_excerpt: "governed by the laws of the State of New York",
            status: "filled",
          }),
        );
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cells: written,
          skipped_row_ids: skipped,
          failures: [],
        }),
      });
    },
  );

  // POST /v1/lens/reviews/:reviewId/columns/:columnId/extract_async → enqueue.
  // Mirrors the sync extract's "never invent" gate but on the async lane: write
  // the groundable cells now, create a `running` job, return 202. The poll
  // (below) flips it to `completed` so the FE's enqueue → poll → refresh loop is
  // exercised end-to-end.
  await page.route(
    (url) =>
      /^\/v1\/lens\/reviews\/[^/]+\/columns\/[^/]+\/extract_async$/.test(
        url.pathname,
      ),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const parts = new URL(request.url()).pathname.split("/");
      const columnId = parts[parts.length - 2];
      const reviewId = parts[parts.length - 4];
      let written = 0;
      let skipped = 0;
      for (const row of rows) {
        if (row.source_page_id == null) {
          skipped += 1;
          continue;
        }
        upsertCellState(row.id, columnId, {
          value: "State of New York",
          source_excerpt: "governed by the laws of the State of New York",
          status: "filled",
        });
        written += 1;
      }
      const job: LensExtractionJobState = {
        id: nextId("lxj"),
        review_id: reviewId,
        column_id: columnId,
        status: "running",
        total_rows: rows.length,
        processed_rows: rows.length,
        cells_written: written,
        skipped_rows: skipped,
        failed_rows: 0,
        error_code: null,
        created_at: NOW,
        updated_at: NOW,
        started_at: NOW,
        finished_at: null,
      };
      jobs.set(job.id, job);
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify(job),
      });
    },
  );

  // GET /v1/lens/extract_jobs/:id → poll the job. First read flips
  // running → completed (the worker finished; cells were written at enqueue).
  await page.route(
    (url) => /^\/v1\/lens\/extract_jobs\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "GET") {
        await route.fallback();
        return;
      }
      const id = new URL(request.url()).pathname.split("/").pop() ?? "";
      const job = jobs.get(id);
      if (!job) {
        await route.fulfill({ status: 404 });
        return;
      }
      if (job.status === "running") {
        job.status = "completed";
        job.finished_at = NOW;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(job),
      });
    },
  );

  // POST/DELETE /v1/lens/cells/:id/verify → toggle human verification.
  await page.route(
    (url) => /^\/v1\/lens\/cells\/[^/]+\/verify$/.test(url.pathname),
    async (route, request) => {
      const method = request.method();
      if (method !== "POST" && method !== "DELETE") {
        await route.fallback();
        return;
      }
      const parts = new URL(request.url()).pathname.split("/");
      const cellId = parts[parts.length - 2];
      const cell = cells.find((c) => c.id === cellId);
      if (!cell) {
        await route.fulfill({ status: 404 });
        return;
      }
      cell.verified_at = method === "POST" ? NOW : null;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ cell }),
      });
    },
  );

  // GET /v1/lens/reviews/:id/export → CSV (value + status + source per column).
  await page.route(
    (url) => /^\/v1\/lens\/reviews\/[^/]+\/export$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "GET") {
        await route.fallback();
        return;
      }
      const header = [
        "Document",
        ...columns.flatMap((c) => [
          c.label,
          `${c.label} — status`,
          `${c.label} — source`,
        ]),
      ].join(",");
      const lines = rows.map((row) => {
        const fields = [row.name];
        for (const col of columns) {
          const cell = cells.find(
            (c) => c.row_id === row.id && c.column_id === col.id,
          );
          fields.push(
            cell?.value ?? "",
            cell ? cell.status : "",
            cell?.source_excerpt ?? "",
          );
        }
        return fields.join(",");
      });
      await route.fulfill({
        status: 200,
        contentType: "text/csv; charset=utf-8",
        body: `${[header, ...lines].join("\r\n")}\r\n`,
      });
    },
  );

  // GET/POST /v1/lens/column_templates → saved column sets.
  await page.route(
    (url) => url.pathname === "/v1/lens/column_templates",
    async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ column_templates: templates.slice() }),
        });
        return;
      }
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const body = (request.postDataJSON() ?? {}) as {
        name?: string;
        columns?: Array<{ label?: string; prompt?: string; format?: string }>;
      };
      const template: LensColumnTemplateState = {
        id: nextId("lct"),
        name: body.name ?? "Untitled set",
        columns: (body.columns ?? []).map((c) => ({
          label: c.label ?? "Untitled",
          prompt: c.prompt ?? "",
          format: c.format ?? "text",
        })),
        created_at: NOW,
      };
      templates.push(template);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ column_template: template }),
      });
    },
  );

  // DELETE /v1/lens/column_templates/:id → 204.
  await page.route(
    (url) => /^\/v1\/lens\/column_templates\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "DELETE") {
        await route.fallback();
        return;
      }
      const id = new URL(request.url()).pathname.split("/").pop() ?? "";
      const idx = templates.findIndex((t) => t.id === id);
      if (idx >= 0) templates.splice(idx, 1);
      await route.fulfill({ status: 204 });
    },
  );

  // POST /v1/lens/reviews/:id/apply_column_template → append the set's columns.
  await page.route(
    (url) =>
      /^\/v1\/lens\/reviews\/[^/]+\/apply_column_template$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const body = (request.postDataJSON() ?? {}) as {
        column_template_id?: string;
      };
      const template = templates.find((t) => t.id === body.column_template_id);
      if (!template) {
        await route.fulfill({ status: 404 });
        return;
      }
      const created: LensColumnState[] = template.columns.map((c, i) => ({
        id: nextId("lcol"),
        label: c.label,
        prompt: c.prompt,
        format: c.format,
        position: columns.length + i,
      }));
      columns.push(...created);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ columns: created }),
      });
    },
  );

  // DELETE /v1/lens/columns/:id → 204 (drop the column + its cells)
  await page.route(
    (url) => /^\/v1\/lens\/columns\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "DELETE") {
        await route.fallback();
        return;
      }
      const id = new URL(request.url()).pathname.split("/").pop() ?? "";
      const idx = columns.findIndex((c) => c.id === id);
      if (idx >= 0) columns.splice(idx, 1);
      for (let i = cells.length - 1; i >= 0; i--) {
        if (cells[i].column_id === id) cells.splice(i, 1);
      }
      await route.fulfill({ status: 204 });
    },
  );

  // DELETE /v1/lens/rows/:id → 204 (drop the row + its cells)
  await page.route(
    (url) => /^\/v1\/lens\/rows\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "DELETE") {
        await route.fallback();
        return;
      }
      const id = new URL(request.url()).pathname.split("/").pop() ?? "";
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) rows.splice(idx, 1);
      for (let i = cells.length - 1; i >= 0; i--) {
        if (cells[i].row_id === id) cells.splice(i, 1);
      }
      await route.fulfill({ status: 204 });
    },
  );

  return {
    reviewMatterId: () => {
      const first = reviews.values().next();
      return first.done ? null : first.value.matter_id;
    },
  };
}
