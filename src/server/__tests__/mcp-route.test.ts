/** @jest-environment node */

/**
 * MCP endpoint contract: bearer-gated, closed-by-default, and the tool
 * listing serves exactly the ask-tools registry (single source of
 * truth — a tool added there must appear on the wire with no edit to
 * the route).
 */

import { POST } from "@/app/api/mcp/[transport]/route";
import { ASK_TOOLS } from "@/server/ask-tools";

const LIST_TOOLS = { jsonrpc: "2.0", id: 1, method: "tools/list" };

function rpc(body: unknown, token?: string): Request {
  return new Request("http://localhost:3100/api/mcp/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(token !== undefined ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("MCP route", () => {
  const previousToken = process.env.CRM_MCP_TOKEN;
  afterEach(() => {
    if (previousToken === undefined) {
      delete process.env.CRM_MCP_TOKEN;
    } else {
      process.env.CRM_MCP_TOKEN = previousToken;
    }
  });

  it("rejects requests without a token, with an OAuth discovery challenge", async () => {
    process.env.CRM_MCP_TOKEN = "test-secret";
    const res = await POST(rpc(LIST_TOOLS));
    expect(res.status).toBe(401);
    // Remote-MCP posture: the 401 tells OAuth-capable clients where
    // the RFC 9728 resource metadata lives.
    const challenge = res.headers.get("WWW-Authenticate") ?? "";
    expect(challenge).toContain("Bearer");
    expect(challenge).toContain(
      "/.well-known/oauth-protected-resource/mcp",
    );
  });

  it("rejects requests with a wrong token", async () => {
    process.env.CRM_MCP_TOKEN = "test-secret";
    const res = await POST(rpc(LIST_TOOLS, "wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("is closed (not open) when no token is configured", async () => {
    delete process.env.CRM_MCP_TOKEN;
    const res = await POST(rpc(LIST_TOOLS, "anything"));
    expect(res.status).toBe(401);
  });

  it("serves every ask-tool in tools/list with the right token", async () => {
    process.env.CRM_MCP_TOKEN = "test-secret";
    const res = await POST(rpc(LIST_TOOLS, "test-secret"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(ASK_TOOLS.length).toBeGreaterThanOrEqual(5);
    for (const tool of ASK_TOOLS) {
      expect(text).toContain(tool.definition.name);
    }
  });
});
