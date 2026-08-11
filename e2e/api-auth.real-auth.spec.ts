import { test, expect } from "@playwright/test";

/**
 * Adversarial authorization sweep — "an anonymous caller cannot read or
 * write ANY CRM data" — asserted the only way that claim can honestly
 * be asserted: by actually being anonymous against the real server.
 *
 * **Why this spec exists.** crm CLAUDE.md claimed the backend
 * cookie-guarded every `/api/*` call, so "data is never shipped to an
 * anon user". On 2026-08-08 a curl against production disproved it:
 * every data route answered 200, and POST reached body validation.
 * The claim had lived for nine days with NO test — the exact failure
 * shape testing-discipline.md warns about (a promise nothing
 * exercises). Unit tests could not have caught it either: they call
 * handlers directly, where "no session" is indistinguishable from the
 * dev fallback.
 *
 * This is the real-auth tier because it is the ONLY tier that runs
 * without MOCK_AUTH (see playwright.config.ts) — under mock auth the
 * gate deliberately allows everything, so a 401 assertion elsewhere
 * would be theatre.
 *
 * The `request` fixture carries no cookies and the specs never log it
 * in, so every call below is a genuine anonymous request.
 */

/** Representative of each data family the CRM serves. */
const PROTECTED_READS = [
  "/api/work_items?page_size=1",
  "/api/work_items/wi_probe",
  "/api/search?q=law",
  "/api/activities/workspace",
  "/api/activities/me",
  "/api/views",
  "/api/chats/history",
  "/api/workspaces",
  "/api/invites",
  "/api/memories",
  "/api/digest/latest",
  "/api/notifications/vapid-key",
];

const PROTECTED_WRITES = [
  { path: "/api/work_items", data: { title: "anon probe" } },
  { path: "/api/comments", data: { work_item_id: "wi_probe", content: "x" } },
  { path: "/api/views", data: { name: "anon", kind: "work_items" } },
  { path: "/api/chats", data: {} },
  { path: "/api/invites", data: { email: "anon@example.com" } },
  { path: "/api/memories", data: { content: "anon probe fact" } },
  { path: "/api/responses", data: { ask: "text", input: { question: "hi" } } },
];

test("anonymous callers cannot READ any data route", async ({ request }) => {
  for (const path of PROTECTED_READS) {
    const res = await request.get(path);
    expect(
      res.status(),
      `${path} must reject anonymous reads (got ${res.status()})`,
    ).toBe(401);
  }
});

test("anonymous callers cannot WRITE through any data route", async ({
  request,
}) => {
  for (const { path, data } of PROTECTED_WRITES) {
    const res = await request.post(path, {
      headers: { "Idempotency-Key": `anon-probe-${path}` },
      data,
    });
    // 401 specifically — NOT 422. A validation error would prove the
    // request was processed, which is how the original hole presented.
    expect(
      res.status(),
      `${path} must reject anonymous writes before validation (got ${res.status()})`,
    ).toBe(401);
  }
});

test("the 401 body is the platform error envelope, and leaks nothing", async ({
  request,
}) => {
  const res = await request.get("/api/work_items?page_size=1");
  expect(res.status()).toBe(401);
  const body = (await res.json()) as {
    statusCode: number;
    code: string;
    message: string;
  };
  expect(body.statusCode).toBe(401);
  expect(body.code).toBe("unauthorized");
  // Response-shape sanitization: the refusal must not describe internals.
  const serialized = JSON.stringify(body).toLowerCase();
  for (const leak of ["postgres", "drizzle", "workos", "select", "stack"]) {
    expect(serialized).not.toContain(leak);
  }
});

test("routes that are public BY DESIGN stay reachable", async ({ request }) => {
  // The invite door: an invitee has no session yet — the code IS the
  // credential. A bogus code must 404/410, never 401 (a 401 here would
  // mean the gate was applied where it must not be).
  const invite = await request.get("/api/invite/not-a-real-code");
  expect([400, 404, 410]).toContain(invite.status());

  // The agent door authenticates itself (bearer / OAuth), so it answers
  // its own 401 with an OAuth discovery challenge rather than ours.
  const mcp = await request.post("/mcp", {
    headers: { Accept: "application/json, text/event-stream" },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  });
  expect(mcp.status()).toBe(401);
  expect(mcp.headers()["www-authenticate"] ?? "").toContain("Bearer");
});
