/** @jest-environment node */

/**
 * RFC 9728 protected-resource metadata route: advertises our AuthKit
 * authorization server for the /mcp resource; 404 when the OAuth layer
 * is unconfigured (static-token-only posture has nothing to discover).
 */

import { GET } from "@/app/.well-known/oauth-protected-resource/mcp/route";

describe("oauth-protected-resource metadata", () => {
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

  const req = new Request(
    "https://crm.example.com/.well-known/oauth-protected-resource/mcp",
  );

  it("serves the resource + authorization server when configured", async () => {
    process.env.WORKOS_AUTHKIT_DOMAIN = "https://foo.authkit.app";
    process.env.NEXT_PUBLIC_APP_URL = "https://crm.example.com";
    const res = GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      resource: string;
      authorization_servers: string[];
    };
    expect(body.resource).toBe("https://crm.example.com/mcp");
    expect(body.authorization_servers).toEqual(["https://foo.authkit.app"]);
  });

  it("404s when the OAuth layer is not configured", async () => {
    delete process.env.WORKOS_AUTHKIT_DOMAIN;
    const res = GET(req);
    expect(res.status).toBe(404);
  });
});
