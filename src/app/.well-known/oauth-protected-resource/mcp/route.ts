import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { authkitIssuer, mcpResourceUrl } from "@/server/mcp-auth";

/**
 * RFC 9728 protected-resource metadata for the /mcp resource — the
 * discovery document MCP clients fetch after a 401's WWW-Authenticate
 * challenge. Points at our AuthKit authorization server; without
 * `WORKOS_AUTHKIT_DOMAIN` configured there is no OAuth story to
 * advertise, so the route 404s (the static service token needs no
 * discovery).
 */

export function GET(req: Request): Response {
  const issuer = authkitIssuer();
  if (!issuer) {
    return new Response(JSON.stringify({ error: "not_configured" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return protectedResourceHandler({
    authServerUrls: [issuer],
    resourceUrl: mcpResourceUrl(),
  })(req);
}

// Browser-based MCP clients preflight the metadata fetch.
export function OPTIONS(): Response {
  return metadataCorsOptionsRequestHandler()();
}
