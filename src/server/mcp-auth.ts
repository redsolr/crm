import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { getWorkOS } from "@/lib/workos";
import { MCP_AGENT_ACTOR, MCP_BRIDGE_ACTOR } from "./constants";

/**
 * MCP authorization — the OAuth 2.1 resource-server layer plus the
 * legacy service token (Vercel/Cloudflare-style remote MCP posture,
 * founder ask 2026-08-06).
 *
 * Two credentials open the door:
 *
 * 1. `CRM_MCP_TOKEN` static bearer — the service side door for CI and
 *    the existing `claude mcp` registration. Writes stamp the Claude
 *    agent actor, unchanged.
 * 2. AuthKit access tokens — any MCP client that walked the OAuth flow
 *    against our AuthKit authorization server
 *    (`WORKOS_AUTHKIT_DOMAIN`). Verified against the issuer's JWKS,
 *    with a STRICT audience check: the token must be minted for THIS
 *    deployment's resource (`NEXT_PUBLIC_APP_URL` + /mcp, RFC 8707) —
 *    a token for another resource, or with no resource binding at
 *    all, is rejected. Writes stamp the REAL authenticated user
 *    (WHO-wrote doctrine) resolved via the WorkOS API and cached.
 *
 * Neither env set ⇒ every request 401s — closed-by-default, same
 * posture the static-token era had.
 */

export interface McpActor {
  id: string;
  name: string;
}

/** `https://<slug>.authkit.app` — normalized issuer, or null when the
 *  OAuth path is not configured. */
export function authkitIssuer(): string | null {
  const raw = process.env.WORKOS_AUTHKIT_DOMAIN;
  if (!raw) return null;
  const withScheme = raw.startsWith("http") ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

/** The RFC 8707 resource identifier this deployment answers for. */
export function mcpResourceUrl(): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100"
  ).replace(/\/+$/, "");
  return `${base}/mcp`;
}

function normalizeResource(value: string): string {
  return value.replace(/\/+$/, "");
}

export class McpTokenError extends Error {}

/**
 * Verify an AuthKit access token: signature (JWKS), issuer, expiry,
 * and the audience/resource binding. Key resolution is injectable so
 * unit tests can sign with a local key pair.
 */
export async function verifyAuthkitAccessToken(
  token: string,
  options: { issuer: string; audience: string; getKey: JWTVerifyGetKey },
): Promise<{ sub: string; clientId: string; scopes: string[]; expiresAt?: number }> {
  const { payload } = await jwtVerify(token, options.getKey, {
    issuer: options.issuer,
  });
  const aud = payload.aud;
  const audiences = (Array.isArray(aud) ? aud : aud ? [aud] : []).map(
    normalizeResource,
  );
  if (!audiences.includes(normalizeResource(options.audience))) {
    throw new McpTokenError(
      `token audience ${JSON.stringify(aud)} is not bound to ${options.audience}`,
    );
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new McpTokenError("token has no subject");
  }
  const clientId =
    typeof payload.client_id === "string"
      ? payload.client_id
      : typeof payload.azp === "string"
        ? payload.azp
        : "oauth-client";
  const scopes =
    typeof payload.scope === "string" && payload.scope.length > 0
      ? payload.scope.split(" ")
      : [];
  return { sub: payload.sub, clientId, scopes, expiresAt: payload.exp };
}

// Remote JWKS is cached per issuer for the process lifetime (jose
// handles refresh/backoff internally).
let cachedJwks: { issuer: string; getKey: JWTVerifyGetKey } | null = null;

function remoteJwksFor(issuer: string): JWTVerifyGetKey {
  if (cachedJwks?.issuer !== issuer) {
    cachedJwks = {
      issuer,
      getKey: createRemoteJWKSet(new URL(`${issuer}/oauth2/jwks`)),
    };
  }
  return cachedJwks.getKey;
}

// WHO-wrote attribution: resolve the token subject to a display name
// once per ACTOR_CACHE_TTL_MS, not once per tool call.
const ACTOR_CACHE_TTL_MS = 10 * 60 * 1000;
const actorCache = new Map<string, { actor: McpActor; at: number }>();

async function actorForUser(sub: string): Promise<McpActor> {
  const hit = actorCache.get(sub);
  if (hit && Date.now() - hit.at < ACTOR_CACHE_TTL_MS) return hit.actor;
  let actor: McpActor;
  try {
    const user = await getWorkOS().userManagement.getUser(sub);
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    actor = { id: sub, name };
  } catch (err) {
    // A profile-lookup hiccup must not lock out a valid token; the
    // stable WorkOS id keeps attribution truthful, just less pretty.
    console.warn(`[mcp-auth] could not resolve user ${sub}:`, err);
    actor = { id: sub, name: sub };
  }
  actorCache.set(sub, { actor, at: Date.now() });
  return actor;
}

/**
 * `withMcpAuth` verifier — undefined means unauthorized (the wrapper
 * answers 401 + WWW-Authenticate with our resource metadata URL).
 */
export async function verifyMcpToken(
  _req: Request,
  bearer?: string,
): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;

  const staticToken = process.env.CRM_MCP_TOKEN;
  if (staticToken && bearer === staticToken) {
    return {
      token: bearer,
      clientId: "crm-service-token",
      scopes: [],
      extra: { actor: MCP_AGENT_ACTOR },
    };
  }

  // The Jurisimus platform's crm-bridge — a SECOND static bearer with
  // its own actor so Mission Control-originated writes are attributed
  // to the system that made them (WHO-wrote doctrine), never to Claude.
  const bridgeToken = process.env.CRM_MCP_BRIDGE_TOKEN;
  if (bridgeToken && bearer === bridgeToken) {
    return {
      token: bearer,
      clientId: "jurisimus-bridge-token",
      scopes: [],
      extra: { actor: MCP_BRIDGE_ACTOR },
    };
  }

  const issuer = authkitIssuer();
  if (!issuer) return undefined;
  try {
    const verified = await verifyAuthkitAccessToken(bearer, {
      issuer,
      audience: mcpResourceUrl(),
      getKey: remoteJwksFor(issuer),
    });
    const actor = await actorForUser(verified.sub);
    return {
      token: bearer,
      clientId: verified.clientId,
      scopes: verified.scopes,
      expiresAt: verified.expiresAt,
      extra: { actor },
    };
  } catch (err) {
    // Reject quietly on the wire, loudly in the logs — a rejected
    // token is either an expired session (normal) or a misconfigured
    // client (needs the log line to debug).
    const detail = err instanceof Error ? err.message : String(err);
    const sub = (() => {
      try {
        return decodeJwt(bearer).sub;
      } catch (decodeErr) {
        // Bearer isn't even a decodable JWT — the outer warn below
        // still fires; note the shape for the same debug trail.
        console.warn(
          "[mcp-auth] bearer token is not a decodable JWT:",
          decodeErr instanceof Error ? decodeErr.message : decodeErr,
        );
        return undefined;
      }
    })();
    console.warn(
      `[mcp-auth] rejected OAuth token${sub ? ` (sub ${sub})` : ""}: ${detail}`,
    );
    return undefined;
  }
}

/** The actor a tool call runs as, from the request's verified auth. */
export function actorFromAuthInfo(authInfo: AuthInfo | undefined): McpActor {
  const actor = (authInfo?.extra as { actor?: McpActor } | undefined)?.actor;
  return actor ?? MCP_AGENT_ACTOR;
}
