import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/server/api-error";
import { runMorningDigest } from "@/server/digest";

/**
 * `GET|POST /api/digest/run` — the morning-digest trigger. Vercel's
 * cron (vercel.json, 00:00 UTC = 07:00 Bangkok) calls GET with
 * `Authorization: Bearer $CRON_SECRET` (sent automatically once the
 * env var exists); the founder can re-run manually with the same
 * header. Closed-by-default: no CRON_SECRET configured ⇒ 503, wrong
 * or missing bearer ⇒ 401 — same posture as the /mcp door.
 */

/** Digest runs must never be served from a cached GET. */
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === null || !header.startsWith("Bearer ")) return false;
  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!process.env.CRON_SECRET) {
    return apiError(
      503,
      "digest_disabled",
      "CRON_SECRET is not configured — the digest trigger is closed",
    );
  }
  if (!authorized(request)) {
    return apiError(401, "unauthorized", "Invalid or missing bearer token");
  }
  try {
    const result = await runMorningDigest();
    return NextResponse.json({
      run_date: result.runDate,
      pushed: result.pushed,
      push_skip_reason: result.pushSkipReason,
      push_report: result.pushReport,
      counts: {
        attention: result.payload.attention.length,
        due_commitments: result.payload.due_commitments.length,
        drafts: result.payload.drafts.length,
      },
      drafts_error: result.payload.drafts_error,
    });
  } catch (error) {
    console.error("[digest] run failed:", error);
    return apiError(
      500,
      "digest_failed",
      error instanceof Error ? error.message : "Digest run failed",
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}
