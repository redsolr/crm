import { test, expect, type APIRequestContext } from "@playwright/test";
import { envLocal } from "./helpers/real-auth";

/**
 * MCP endpoint against the REAL local stack — the agent door
 * (`POST /mcp`, docs/mcp.md) proven end-to-end: auth gate, tool
 * listing, a real write (create_account) and read-back
 * (find_crm_record) hitting the same Postgres the UI serves.
 *
 * Complements the unit tests in `src/server/__tests__/mcp-route.test.ts`
 * (auth contract, registry passthrough) by exercising the deployed
 * shape: the /mcp rewrite, the streamable-HTTP wire, and real DB
 * writes.
 */

const token = envLocal("CRM_MCP_TOKEN");
const stamp = Date.now().toString(36);
const COMPANY = `E2E MCP Co ${stamp}`;

async function mcpCall(
  request: APIRequestContext,
  body: Record<string, unknown>,
  bearer?: string,
): Promise<{ status: number; text: string }> {
  const res = await request.post("/mcp", {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(bearer !== undefined ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    data: body,
  });
  return { status: res.status(), text: await res.text() };
}

test("the /mcp door: 401 closed, tools listed, real write + read-back", async ({
  request,
}) => {
  test.setTimeout(120_000);
  test.skip(!token, "CRM_MCP_TOKEN missing (env or .env.local)");

  // Closed without the bearer.
  const anon = await mcpCall(request, {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });
  expect(anon.status).toBe(401);

  // Tool listing serves the sales registry.
  const listed = await mcpCall(
    request,
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    token,
  );
  expect(listed.status).toBe(200);
  for (const name of [
    "find_crm_record",
    "create_account",
    "create_opportunity",
    "update_opportunity",
    "log_call_note",
  ]) {
    expect(listed.text).toContain(name);
  }

  // Real write through the door…
  const created = await mcpCall(
    request,
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "create_account",
        arguments: { name: COMPANY, source: "other" },
      },
    },
    token,
  );
  expect(created.status).toBe(200);
  expect(created.text).toContain(`Created account \\"${COMPANY}\\"`);

  // …and the read-back finds it in the same database.
  const found = await mcpCall(
    request,
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "find_crm_record",
        arguments: { query: COMPANY, record_type: "account" },
      },
    },
    token,
  );
  expect(found.status).toBe(200);
  expect(found.text).toContain(COMPANY);
});
