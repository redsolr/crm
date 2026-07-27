/**
 * Phase 0 regression tests — guard against the four bugs the
 * public-API-completeness audit (2026-05-01) found in the consumer
 * app's auth + onboarding routes:
 *
 *   1. `use-onboarding.ts` was POSTing to kebab-case
 *      `/v1/user-preferences/onboarding` (snake-case backend → 404).
 *   2. The same POSTs sent `roles`/`responseLength` — backend expects
 *      `role` (singular) + `response_length` (snake).
 *   3. `preferencesApi.getSessionCount()` routed `/auth/sessions`
 *      through `BaseApiClient.request()` which prefixes `/v1` — the
 *      backend mounts `/auth/*` outside the prefix → 404.
 *   4. `preferencesApi.revokeAllSessions()` had the same prefix bug
 *      AND used kebab-case `revoke-all` — backend route is snake
 *      `revoke_all`.
 *
 * Tests mock the global `fetch` and assert exact URL + body shape on
 * each call. Failure modes here are silent (404 just disappears); the
 * assertions are the only signal a future regression doesn't reach
 * production.
 */
import { preferencesApiClient } from "@/lib/preferencesApi";
import { API_BASE } from "@/lib/api-base";

interface CapturedCall {
  url: string;
  method: string;
  body: string | null;
}

let captured: CapturedCall[] = [];
let nextPayload: unknown;
let nextStatus = 200;

/**
 * Build the minimal `Response`-shaped object that `BaseApiClient` and
 * its consumers actually touch: `ok`, `status`, `headers.get`, and
 * `json()`. jsdom does not expose the WHATWG `Response` constructor,
 * so a duck-typed object is simpler than polyfilling.
 */
function makeFakeResponse(payload: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: new Headers({ "Content-Type": "application/json" }),
    redirected: false,
    type: "basic" as ResponseType,
    url: "",
    body: null,
    bodyUsed: false,
    clone: () => makeFakeResponse(payload, status),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob([JSON.stringify(payload)])),
    bytes: () => Promise.resolve(new Uint8Array()),
    formData: () => Promise.resolve(new FormData()),
    json: () => Promise.resolve(payload),
    text: () => Promise.resolve(JSON.stringify(payload)),
  } as Response;
}

beforeEach(() => {
  captured = [];
  nextPayload = { data: null };
  nextStatus = 200;
  global.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      captured.push({
        url,
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : null,
      });
      return makeFakeResponse(nextPayload, nextStatus);
    },
  ) as unknown as typeof fetch;
});

describe("preferencesApi.submitOnboarding — wire shape", () => {
  it("POSTs to snake_case /v1/user_preferences/onboarding (not kebab)", async () => {
    nextPayload = { data: { id: "up_1" } };
    await preferencesApiClient.submitOnboarding({
      role: "Software Engineer, Founder",
      interests: ["code_technical"],
      response_length: "balanced",
      tone: "professional",
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe(
      `${API_BASE}/v1/user_preferences/onboarding`,
    );
    expect(captured[0].url).not.toContain("user-preferences");
  });

  it("sends role (singular) + response_length (snake), not roles + responseLength", async () => {
    nextPayload = { data: { id: "up_1" } };
    await preferencesApiClient.submitOnboarding({
      role: "Founder, Engineer",
      interests: ["code_technical", "ai"],
      response_length: "concise",
      tone: "casual",
    });

    expect(captured).toHaveLength(1);
    const body = JSON.parse(captured[0].body ?? "{}") as Record<string, unknown>;
    expect(body).toEqual({
      role: "Founder, Engineer",
      interests: ["code_technical", "ai"],
      response_length: "concise",
      tone: "casual",
    });
    // Negative assertions — the camelCase / plural shape that was
    // silently 422'ing must not appear on the wire.
    expect(body).not.toHaveProperty("roles");
    expect(body).not.toHaveProperty("responseLength");
  });
});

describe("preferencesApi.getSessionCount — bypasses /v1 prefix", () => {
  it("hits unprefixed /auth/sessions, not /v1/auth/sessions", async () => {
    nextPayload = { count: 3 };
    const count = await preferencesApiClient.getSessionCount();

    expect(count).toBe(3);
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe(`${API_BASE}/auth/sessions`);
    expect(captured[0].url).not.toContain("/v1/auth/");
  });
});

describe("preferencesApi.revokeAllSessions — bypasses /v1 prefix + snake_case path", () => {
  it("POSTs to unprefixed /auth/sessions/revoke_all (snake), not revoke-all", async () => {
    nextPayload = { success: true };
    await preferencesApiClient.revokeAllSessions("idem-key-1");

    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe(
      `${API_BASE}/auth/sessions/revoke_all`,
    );
    expect(captured[0].method).toBe("POST");
    // Negative assertions — both the prefix bug AND the kebab/snake
    // bug must stay fixed.
    expect(captured[0].url).not.toContain("/v1/auth/");
    expect(captured[0].url).not.toContain("revoke-all");
  });
});
