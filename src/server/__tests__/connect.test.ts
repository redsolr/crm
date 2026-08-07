/** @jest-environment node */

/**
 * Standalone Connect contracts: the completion helper speaks AuthKit's
 * API correctly (and fails loudly), and the /login/connect entry route
 * routes each state — no param, signed out (stash + our login page),
 * signed in (instant completion), completion failure (visible error).
 */

import { NextRequest } from "next/server";

// authkit-nextjs ships ESM-only exports jest's resolver can't load —
// a virtual mock intercepts both this file's handle and the route's
// import (the rest of the suite avoids the package by mocking
// `@/server/actor`; this test needs the withAuth seam itself).
jest.mock(
  "@workos-inc/authkit-nextjs",
  () => ({ withAuth: jest.fn() }),
  { virtual: true },
);

import { GET as connectEntry } from "@/app/(auth)/login/connect/route";
import {
  CONNECT_PENDING_COOKIE,
  completeStandaloneConnect,
} from "@/server/connect";

const { withAuth: mockedWithAuth } = jest.requireMock(
  "@workos-inc/authkit-nextjs",
) as { withAuth: jest.Mock };

const USER = {
  id: "user_01TEST",
  email: "admin@jurisimus.com",
  firstName: "Kreethup",
  lastName: "Hiranphan",
};

function entry(externalAuthId?: string): NextRequest {
  const url = new URL("http://localhost:3100/login/connect");
  if (externalAuthId !== undefined) {
    url.searchParams.set("external_auth_id", externalAuthId);
  }
  return new NextRequest(url);
}

describe("completeStandaloneConnect", () => {
  const previousKey = process.env.WORKOS_API_KEY;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    process.env.WORKOS_API_KEY = "sk_test_key";
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    if (previousKey === undefined) delete process.env.WORKOS_API_KEY;
    else process.env.WORKOS_API_KEY = previousKey;
  });

  it("posts the external_auth_id + user and returns the redirect_uri", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ redirect_uri: "https://authkit.example/resume" }),
        { status: 200 },
      ),
    );
    const redirectUri = await completeStandaloneConnect("ext_123", {
      id: "user_01TEST",
      email: "admin@jurisimus.com",
      firstName: "Kreethup",
      lastName: null,
    });
    expect(redirectUri).toBe("https://authkit.example/resume");

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.workos.com/authkit/oauth2/complete");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk_test_key",
    );
    expect(JSON.parse(init?.body as string)).toEqual({
      external_auth_id: "ext_123",
      user: {
        id: "user_01TEST",
        email: "admin@jurisimus.com",
        first_name: "Kreethup",
      },
    });
  });

  it("throws on a non-2xx completion response", async () => {
    fetchSpy.mockResolvedValue(new Response("expired", { status: 400 }));
    await expect(
      completeStandaloneConnect("ext_expired", {
        id: "u",
        email: "a@b.co",
      }),
    ).rejects.toThrow("completion failed (400)");
  });

  it("throws when the response carries no redirect_uri", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    await expect(
      completeStandaloneConnect("ext_odd", { id: "u", email: "a@b.co" }),
    ).rejects.toThrow("no redirect_uri");
  });

  it("throws without WORKOS_API_KEY — config errors fail loudly", async () => {
    delete process.env.WORKOS_API_KEY;
    await expect(
      completeStandaloneConnect("ext_1", { id: "u", email: "a@b.co" }),
    ).rejects.toThrow("WORKOS_API_KEY");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("/login/connect entry route", () => {
  const previousKey = process.env.WORKOS_API_KEY;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    process.env.WORKOS_API_KEY = "sk_test_key";
    fetchSpy = jest.spyOn(globalThis, "fetch");
    mockedWithAuth.mockReset();
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    if (previousKey === undefined) delete process.env.WORKOS_API_KEY;
    else process.env.WORKOS_API_KEY = previousKey;
  });

  it("without external_auth_id, bounces to /login untouched", async () => {
    const res = await connectEntry(entry());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3100/login");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("signed out: stashes the pending id and shows OUR login page", async () => {
    mockedWithAuth.mockResolvedValue({ user: null });
    const res = await connectEntry(entry("ext_456"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3100/login?connect=1",
    );
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${CONNECT_PENDING_COOKIE}=ext_456`);
    expect(cookie).toContain("HttpOnly");
  });

  it("signed in: completes immediately and resumes the OAuth flow", async () => {
    mockedWithAuth.mockResolvedValue({ user: USER });
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ redirect_uri: "https://authkit.example/resume" }),
        { status: 200 },
      ),
    );
    const res = await connectEntry(entry("ext_789"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://authkit.example/resume");
  });

  it("signed in but completion fails: visible error, never a dead end", async () => {
    mockedWithAuth.mockResolvedValue({ user: USER });
    fetchSpy.mockResolvedValue(new Response("nope", { status: 400 }));
    const res = await connectEntry(entry("ext_bad"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3100/login?error=connect_failed",
    );
  });
});
