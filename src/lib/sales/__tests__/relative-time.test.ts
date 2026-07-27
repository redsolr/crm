import { latestActivity, timeAgo } from "../relative-time";

describe("timeAgo", () => {
  it("handles null/invalid", () => {
    expect(timeAgo(null)).toBe("—");
    expect(timeAgo(undefined)).toBe("—");
    expect(timeAgo("not-a-date")).toBe("—");
  });

  it("formats compact buckets", () => {
    const now = Date.now();
    expect(timeAgo(new Date(now - 30_000).toISOString())).toBe("just now");
    expect(timeAgo(new Date(now - 5 * 60_000).toISOString())).toBe("5m ago");
    expect(timeAgo(new Date(now - 3 * 3_600_000).toISOString())).toBe(
      "3h ago",
    );
    expect(timeAgo(new Date(now - 2 * 86_400_000).toISOString())).toBe(
      "2d ago",
    );
  });

  it("falls back to a date beyond 30 days", () => {
    const old = new Date(Date.now() - 60 * 86_400_000).toISOString();
    expect(timeAgo(old)).toBe(new Date(old).toLocaleDateString());
  });
});

describe("latestActivity", () => {
  it("takes the max across own + related timestamps", () => {
    expect(
      latestActivity("2026-07-01T00:00:00Z", [
        { updated_at: "2026-07-03T00:00:00Z" },
        { updated_at: "2026-07-02T00:00:00Z" },
      ]),
    ).toBe("2026-07-03T00:00:00Z");
  });

  it("survives missing values", () => {
    expect(latestActivity(null, [])).toBeNull();
    expect(latestActivity(null, [{ updated_at: "2026-07-02T00:00:00Z" }])).toBe(
      "2026-07-02T00:00:00Z",
    );
    expect(latestActivity("2026-07-05T00:00:00Z", [{ updated_at: null }])).toBe(
      "2026-07-05T00:00:00Z",
    );
  });
});
