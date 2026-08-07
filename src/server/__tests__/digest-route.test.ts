/** @jest-environment node */

/**
 * Morning-digest trigger contract (`/api/digest/run`): closed-by-default
 * like the /mcp door — no CRON_SECRET configured ⇒ 503, wrong/missing
 * bearer ⇒ 401, correct bearer ⇒ the run executes and reports counts.
 */

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/digest/run/route";
import { runMorningDigest } from "@/server/digest";

jest.mock("@/server/digest", () => ({
  runMorningDigest: jest.fn(),
}));

const mockedRun = runMorningDigest as jest.MockedFunction<
  typeof runMorningDigest
>;

function trigger(token?: string): NextRequest {
  return new NextRequest("http://localhost:3100/api/digest/run", {
    headers: token !== undefined ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe("digest run route", () => {
  const previousSecret = process.env.CRON_SECRET;
  beforeEach(() => {
    mockedRun.mockReset();
  });
  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousSecret;
    }
  });

  it("answers 503 when no CRON_SECRET is configured (closed, not open)", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(trigger("anything"));
    expect(res.status).toBe(503);
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it("rejects a missing bearer", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const res = await GET(trigger());
    expect(res.status).toBe(401);
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it("rejects a wrong bearer", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const res = await GET(trigger("wrong-secret"));
    expect(res.status).toBe(401);
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it("runs the digest with the right bearer and reports counts", async () => {
    process.env.CRON_SECRET = "cron-secret";
    mockedRun.mockResolvedValue({
      runDate: "2026-08-07",
      payload: {
        run_date: "2026-08-07",
        generated_at: "2026-08-07T00:00:00.000Z",
        attention: [
          {
            opportunity_id: "wi_1",
            identifier: "CRM-1",
            title: "Deal",
            account_name: "Firm",
            reason: "overdue_next_action",
            detail: "next action 2 days overdue",
            next_action: "Send recap",
          },
        ],
        due_commitments: [],
        drafts: [],
        drafts_model: null,
        drafts_error: "OPENAI_API_KEY is not configured",
      },
      pushed: false,
      pushSkipReason: "push_unconfigured",
      pushReport: null,
    });

    const res = await POST(trigger("cron-secret"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      run_date: string;
      pushed: boolean;
      push_skip_reason: string | null;
      counts: { attention: number; due_commitments: number; drafts: number };
      drafts_error: string | null;
    };
    expect(body.run_date).toBe("2026-08-07");
    expect(body.pushed).toBe(false);
    expect(body.push_skip_reason).toBe("push_unconfigured");
    expect(body.counts).toEqual({
      attention: 1,
      due_commitments: 0,
      drafts: 0,
    });
    // The LLM failure is REPORTED, never silently dropped.
    expect(body.drafts_error).toContain("OPENAI_API_KEY");
    expect(mockedRun).toHaveBeenCalledTimes(1);
  });

  it("answers 500 with the error surfaced when the run throws", async () => {
    process.env.CRON_SECRET = "cron-secret";
    mockedRun.mockRejectedValue(new Error("db unreachable"));
    const res = await GET(trigger("cron-secret"));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe("digest_failed");
    expect(body.message).toContain("db unreachable");
  });
});
