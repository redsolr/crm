/** @jest-environment node */

/**
 * MCP OAuth resource-server contract: AuthKit access tokens are
 * accepted only when signature, issuer, expiry, AND the RFC 8707
 * audience binding all hold; the static service token maps to the
 * Claude agent actor; metadata discovery serves the AuthKit issuer.
 */

import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from "jose";
import {
  actorFromAuthInfo,
  authkitIssuer,
  mcpResourceUrl,
  McpTokenError,
  verifyAuthkitAccessToken,
  verifyMcpToken,
} from "@/server/mcp-auth";
import { MCP_AGENT_ACTOR, MCP_BRIDGE_ACTOR } from "@/server/constants";

const ISSUER = "https://example-test.authkit.app";
const RESOURCE = "https://crm.example.com/mcp";

async function makeSigner() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test-key";
  jwk.alg = "RS256";
  const getKey = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims: Record<string, unknown>, expiresIn = "5m") =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(privateKey);
  return { getKey, sign };
}

describe("verifyAuthkitAccessToken", () => {
  it("accepts a token bound to the resource and extracts identity", async () => {
    const { getKey, sign } = await makeSigner();
    const token = await sign({
      iss: ISSUER,
      aud: RESOURCE,
      sub: "user_123",
      client_id: "client_abc",
      scope: "openid profile",
    });
    const result = await verifyAuthkitAccessToken(token, {
      issuer: ISSUER,
      audience: RESOURCE,
      getKey,
    });
    expect(result.sub).toBe("user_123");
    expect(result.clientId).toBe("client_abc");
    expect(result.scopes).toEqual(["openid", "profile"]);
  });

  it("accepts array audiences containing the resource", async () => {
    const { getKey, sign } = await makeSigner();
    const token = await sign({
      iss: ISSUER,
      aud: ["https://other.example.com", RESOURCE],
      sub: "user_123",
    });
    await expect(
      verifyAuthkitAccessToken(token, {
        issuer: ISSUER,
        audience: RESOURCE,
        getKey,
      }),
    ).resolves.toMatchObject({ sub: "user_123" });
  });

  it("rejects a token minted for a different resource", async () => {
    const { getKey, sign } = await makeSigner();
    const token = await sign({
      iss: ISSUER,
      aud: "https://other.example.com/mcp",
      sub: "user_123",
    });
    await expect(
      verifyAuthkitAccessToken(token, {
        issuer: ISSUER,
        audience: RESOURCE,
        getKey,
      }),
    ).rejects.toBeInstanceOf(McpTokenError);
  });

  it("rejects a token with no resource binding at all", async () => {
    const { getKey, sign } = await makeSigner();
    const token = await sign({ iss: ISSUER, sub: "user_123" });
    await expect(
      verifyAuthkitAccessToken(token, {
        issuer: ISSUER,
        audience: RESOURCE,
        getKey,
      }),
    ).rejects.toBeInstanceOf(McpTokenError);
  });

  it("rejects wrong issuer and expired tokens", async () => {
    const { getKey, sign } = await makeSigner();
    const wrongIssuer = await sign({
      iss: "https://evil.example.com",
      aud: RESOURCE,
      sub: "user_123",
    });
    await expect(
      verifyAuthkitAccessToken(wrongIssuer, {
        issuer: ISSUER,
        audience: RESOURCE,
        getKey,
      }),
    ).rejects.toThrow();

    const expired = await sign(
      { iss: ISSUER, aud: RESOURCE, sub: "user_123" },
      "-5m",
    );
    await expect(
      verifyAuthkitAccessToken(expired, {
        issuer: ISSUER,
        audience: RESOURCE,
        getKey,
      }),
    ).rejects.toThrow();
  });

  it("rejects a token without a subject", async () => {
    const { getKey, sign } = await makeSigner();
    const token = await sign({ iss: ISSUER, aud: RESOURCE });
    await expect(
      verifyAuthkitAccessToken(token, {
        issuer: ISSUER,
        audience: RESOURCE,
        getKey,
      }),
    ).rejects.toBeInstanceOf(McpTokenError);
  });
});

describe("verifyMcpToken (service token path)", () => {
  const previous = {
    token: process.env.CRM_MCP_TOKEN,
    bridgeToken: process.env.CRM_MCP_BRIDGE_TOKEN,
    domain: process.env.WORKOS_AUTHKIT_DOMAIN,
  };
  afterEach(() => {
    if (previous.token === undefined) delete process.env.CRM_MCP_TOKEN;
    else process.env.CRM_MCP_TOKEN = previous.token;
    if (previous.bridgeToken === undefined)
      delete process.env.CRM_MCP_BRIDGE_TOKEN;
    else process.env.CRM_MCP_BRIDGE_TOKEN = previous.bridgeToken;
    if (previous.domain === undefined) delete process.env.WORKOS_AUTHKIT_DOMAIN;
    else process.env.WORKOS_AUTHKIT_DOMAIN = previous.domain;
  });

  const req = new Request("http://localhost:3100/mcp");

  it("maps the static token to the Claude agent actor", async () => {
    process.env.CRM_MCP_TOKEN = "service-secret";
    const auth = await verifyMcpToken(req, "service-secret");
    expect(auth?.clientId).toBe("crm-service-token");
    expect(actorFromAuthInfo(auth)).toEqual(MCP_AGENT_ACTOR);
  });

  it("maps the bridge token to the Jurisimus Platform actor (both tokens coexist)", async () => {
    process.env.CRM_MCP_TOKEN = "service-secret";
    process.env.CRM_MCP_BRIDGE_TOKEN = "bridge-secret";
    const bridge = await verifyMcpToken(req, "bridge-secret");
    expect(bridge?.clientId).toBe("jurisimus-bridge-token");
    expect(actorFromAuthInfo(bridge)).toEqual(MCP_BRIDGE_ACTOR);
    const claude = await verifyMcpToken(req, "service-secret");
    expect(actorFromAuthInfo(claude)).toEqual(MCP_AGENT_ACTOR);
  });

  it("returns undefined with no bearer, and with a wrong token when OAuth is unconfigured", async () => {
    process.env.CRM_MCP_TOKEN = "service-secret";
    delete process.env.WORKOS_AUTHKIT_DOMAIN;
    await expect(verifyMcpToken(req, undefined)).resolves.toBeUndefined();
    await expect(verifyMcpToken(req, "wrong")).resolves.toBeUndefined();
  });

  it("is closed when nothing is configured", async () => {
    delete process.env.CRM_MCP_TOKEN;
    delete process.env.WORKOS_AUTHKIT_DOMAIN;
    await expect(verifyMcpToken(req, "anything")).resolves.toBeUndefined();
  });
});

describe("config helpers", () => {
  const previous = {
    domain: process.env.WORKOS_AUTHKIT_DOMAIN,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  };
  afterEach(() => {
    if (previous.domain === undefined) delete process.env.WORKOS_AUTHKIT_DOMAIN;
    else process.env.WORKOS_AUTHKIT_DOMAIN = previous.domain;
    if (previous.appUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous.appUrl;
  });

  it("normalizes the issuer (bare domain, trailing slash)", () => {
    process.env.WORKOS_AUTHKIT_DOMAIN = "foo.authkit.app";
    expect(authkitIssuer()).toBe("https://foo.authkit.app");
    process.env.WORKOS_AUTHKIT_DOMAIN = "https://foo.authkit.app/";
    expect(authkitIssuer()).toBe("https://foo.authkit.app");
    delete process.env.WORKOS_AUTHKIT_DOMAIN;
    expect(authkitIssuer()).toBeNull();
  });

  it("derives the resource identifier from the app url", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://crm.example.com/";
    expect(mcpResourceUrl()).toBe("https://crm.example.com/mcp");
  });

  it("falls back to the agent actor when auth carries no actor", () => {
    expect(actorFromAuthInfo(undefined)).toEqual(MCP_AGENT_ACTOR);
  });
});
