import { createHmac } from "node:crypto";
import {
  broadcastInvalidate,
  mintRealtimeToken,
  realtimeEnabled,
} from "@/server/realtime";
import { recordIdFromPath } from "@/lib/realtime/use-realtime-connection";

/**
 * Realtime channel contracts:
 *  - the HMAC token the crm mints is exactly what the worker verifies
 *    (payload.sig over base64url JSON, exp in seconds)
 *  - feature gating: everything is a no-op without the env pair
 *  - record-page path parsing drives presence "viewing" state
 */

const ENV_KEYS = ["REALTIME_URL", "REALTIME_SECRET"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("mintRealtimeToken", () => {
  it("mints a payload.sig token the worker's HMAC check accepts", () => {
    process.env.REALTIME_SECRET = "test-secret";
    const token = mintRealtimeToken(
      { id: "user_01", name: "Nan", email: "nan@x.com" },
      Date.parse("2026-08-01T10:00:00Z"),
    );
    const dot = token.lastIndexOf(".");
    const payloadB64 = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    // Signature: hex HMAC-SHA256 over the base64url payload.
    const expected = createHmac("sha256", "test-secret")
      .update(payloadB64)
      .digest("hex");
    expect(sig).toBe(expected);

    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as { id: string; name: string; email: string; exp: number };
    expect(payload.id).toBe("user_01");
    expect(payload.name).toBe("Nan");
    expect(payload.exp).toBe(
      Math.floor(Date.parse("2026-08-01T10:00:00Z") / 1000) + 3600,
    );
  });

  it("falls back to the email local part when the actor has no name", () => {
    process.env.REALTIME_SECRET = "test-secret";
    const token = mintRealtimeToken({
      id: "user_02",
      name: null,
      email: "crm-e2e@jurisimus.com",
    });
    const payload = JSON.parse(
      Buffer.from(token.slice(0, token.lastIndexOf(".")), "base64url").toString(
        "utf8",
      ),
    ) as { name: string };
    expect(payload.name).toBe("crm-e2e");
  });
});

describe("feature gating", () => {
  it("is disabled unless BOTH env vars are set", () => {
    delete process.env.REALTIME_URL;
    delete process.env.REALTIME_SECRET;
    expect(realtimeEnabled()).toBe(false);
    process.env.REALTIME_URL = "http://localhost:8788";
    expect(realtimeEnabled()).toBe(false);
    process.env.REALTIME_SECRET = "s";
    expect(realtimeEnabled()).toBe(true);
  });

  it("broadcastInvalidate is a silent no-op when disabled", () => {
    delete process.env.REALTIME_URL;
    delete process.env.REALTIME_SECRET;
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    expect(() => broadcastInvalidate("records")).not.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("recordIdFromPath", () => {
  it("extracts record ids from the two record routes only", () => {
    expect(recordIdFromPath("/sales/opportunity/wi_abc123")).toBe("wi_abc123");
    expect(recordIdFromPath("/sales/account/wi_xyz")).toBe("wi_xyz");
    expect(recordIdFromPath("/sales/opportunity/wi_abc?tab=notes")).toBe(
      "wi_abc",
    );
    expect(recordIdFromPath("/sales")).toBeNull();
    expect(recordIdFromPath("/sales/inbox")).toBeNull();
    expect(recordIdFromPath("/sales/companies")).toBeNull();
  });
});
