import { createMcpHandler } from "mcp-handler";
import * as z from "zod";
import { ASK_TOOLS, type AskToolDefinition } from "@/server/ask-tools";
import { MCP_AGENT_ACTOR } from "@/server/constants";

/**
 * MCP server — the agent door to the CRM (public URL: `POST /mcp`, a
 * rewrite of `/api/mcp/mcp`; see next.config.ts).
 *
 * Exposes the SAME five sales tools the in-app Ask panel runs
 * (`src/server/ask-tools.ts`) over the Model Context Protocol's
 * Streamable HTTP transport, so any MCP client (Claude Code, Claude
 * Desktop, Cursor, …) can read and write the pipeline directly —
 * find records, create accounts/opportunities, log call notes. The
 * tool registry stays single-source: this file only adapts the
 * existing `AskTool` JSON-schema definitions onto the wire (the SDK's
 * `registerTool` wants Standard Schema objects, hence the mechanical
 * JSON-schema→zod conversion below), it defines no tools of its own.
 *
 * Auth: static bearer token (`CRM_MCP_TOKEN` env, server-only).
 * Internal-tool posture — one secret, rotated by changing the env var
 * and redeploying. If this ever serves third parties, upgrade to OAuth
 * (protected-resource metadata via mcp-handler's `withMcpAuth`).
 * With the env var unset the endpoint is CLOSED (401), never open.
 */

/** The narrow JSON-schema subset the ask-tools use: flat objects of
 *  string (optionally enum) and number properties. A new property type
 *  in ask-tools must extend this converter — the fallthrough is
 *  z.string(), which would silently accept anything stringly. */
function zodFromProperty(prop: unknown): z.ZodType {
  const p = prop as { type?: string; enum?: string[]; description?: string };
  let schema: z.ZodType;
  if (Array.isArray(p.enum) && p.enum.length > 0) {
    schema = z.enum(p.enum as [string, ...string[]]);
  } else if (p.type === "number") {
    schema = z.number();
  } else {
    schema = z.string();
  }
  return typeof p.description === "string"
    ? schema.describe(p.description)
    : schema;
}

function zodShapeFrom(
  definition: AskToolDefinition,
): Record<string, z.ZodType> {
  const required = new Set(definition.input_schema.required);
  return Object.fromEntries(
    Object.entries(definition.input_schema.properties).map(([key, prop]) => {
      const base = zodFromProperty(prop);
      return [key, required.has(key) ? base : base.optional()];
    }),
  );
}

const handler = createMcpHandler(
  (server) => {
    for (const tool of ASK_TOOLS) {
      server.registerTool(
        tool.definition.name,
        {
          description: tool.definition.description,
          inputSchema: z.object(zodShapeFrom(tool.definition)),
        },
        async (input: unknown) => {
          // The /mcp door IS Claude (the founder's coding/ops agent) —
          // distinct from the GPT-powered in-app Ask assistant.
          const result = await tool.execute(
            (input ?? {}) as Record<string, unknown>,
            MCP_AGENT_ACTOR,
          );
          return {
            content: [{ type: "text" as const, text: result.content }],
            ...(result.isError === true ? { isError: true } : {}),
          };
        },
      );
    }
  },
  {
    serverInfo: { name: "jurisimus-crm", version: "1.0.0" },
    verboseLogs: false,
  },
);

function unauthorized(): Response {
  return new Response(
    JSON.stringify({ error: "unauthorized", hint: "Bearer token required" }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
}

async function guarded(req: Request): Promise<Response> {
  const token = process.env.CRM_MCP_TOKEN;
  // No token configured → the endpoint is closed, never open-by-default.
  if (!token) return unauthorized();
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    return unauthorized();
  }
  return handler(req);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
