import { createMcpHandler, withMcpAuth } from "mcp-handler";
import * as z from "zod";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { ASK_TOOLS, type AskToolDefinition } from "@/server/ask-tools";
import { actorFromAuthInfo, verifyMcpToken } from "@/server/mcp-auth";

/**
 * MCP server — the agent door to the CRM (public URL: `POST /mcp`, a
 * rewrite of `/api/mcp/mcp`; see next.config.ts).
 *
 * Exposes the SAME sales tools the in-app Ask panel runs
 * (`src/server/ask-tools.ts`) over the Model Context Protocol's
 * Streamable HTTP transport, so any MCP client (Claude Code, Claude
 * Desktop, Cursor, …) can read and write the pipeline directly —
 * find records, create accounts/opportunities, log call notes. The
 * tool registry stays single-source: this file only adapts the
 * existing `AskTool` JSON-schema definitions onto the wire (the SDK's
 * `registerTool` wants Standard Schema objects, hence the mechanical
 * JSON-schema→zod conversion below), it defines no tools of its own.
 *
 * Auth (2026-08-06, remote-MCP posture): OAuth 2.1 resource server
 * against our AuthKit authorization server, PLUS the `CRM_MCP_TOKEN`
 * static bearer as the service side door — see `src/server/mcp-auth.ts`
 * for the full contract. Unauthenticated requests get 401 with a
 * `WWW-Authenticate` challenge pointing at the RFC 9728 metadata
 * (`/.well-known/oauth-protected-resource/mcp`), which is how MCP
 * clients discover the OAuth flow. Neither env set ⇒ CLOSED (401),
 * never open.
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
        async (
          input: unknown,
          ctx: { http?: { authInfo?: AuthInfo } },
        ) => {
          // WHO-wrote doctrine: OAuth sessions stamp the REAL
          // authenticated user; the service token stamps Claude (the
          // founder's coding/ops agent) — distinct from the
          // GPT-powered in-app Ask assistant.
          const result = await tool.execute(
            (input ?? {}) as Record<string, unknown>,
            actorFromAuthInfo(ctx.http?.authInfo),
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

// `required: true` — no anonymous access; the wrapper's 401 carries
// the WWW-Authenticate challenge with our resource-metadata URL so
// OAuth-capable clients self-configure. The rewrite serves this route
// at the public /mcp, so the metadata path is resource-specific
// (RFC 9728 path insertion for the /mcp resource).
const guarded = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource/mcp",
});

export { guarded as GET, guarded as POST, guarded as DELETE };
