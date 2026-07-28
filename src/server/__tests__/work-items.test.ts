import {
  completedAtFor,
  decodePageToken,
  encodePageToken,
} from "@/server/work-items";
import { mintId } from "@/db/ids";

describe("cursor page tokens", () => {
  it("round-trips an offset", () => {
    expect(decodePageToken(encodePageToken(0))).toBe(0);
    expect(decodePageToken(encodePageToken(300))).toBe(300);
  });

  it("rejects malformed tokens", () => {
    expect(decodePageToken("not-a-token")).toBeNull();
    expect(
      decodePageToken(Buffer.from('{"o":-5}').toString("base64url")),
    ).toBeNull();
    expect(
      decodePageToken(Buffer.from('{"o":"x"}').toString("base64url")),
    ).toBeNull();
  });
});

describe("completedAtFor", () => {
  it("stamps completed_at on entering done and preserves an existing stamp", () => {
    expect(completedAtFor("done", null)).toBeInstanceOf(Date);
    const prior = new Date("2026-01-01T00:00:00Z");
    expect(completedAtFor("done", prior)).toBe(prior);
  });

  it("clears completed_at outside done", () => {
    const prior = new Date("2026-01-01T00:00:00Z");
    expect(completedAtFor("active", prior)).toBeNull();
    expect(completedAtFor("dead", prior)).toBeNull();
    expect(completedAtFor("not_started", null)).toBeNull();
  });
});

describe("mintId", () => {
  it("mints prefixed base58 ids in the platform wire form", () => {
    const id = mintId("wi");
    expect(id).toMatch(/^wi_[1-9A-HJ-NP-Za-km-z]+$/);
    expect(mintId("wi")).not.toBe(id);
  });
});
