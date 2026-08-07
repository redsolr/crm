import { NextResponse } from "next/server";
import { latestDigest } from "@/server/digest";
import { requireApiSession } from "@/server/api-auth";

/**
 * `GET /api/digest/latest` — the newest morning digest for the Summary
 * tab's card. `digest: null` until the first cron run lands.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  const digest = await latestDigest();
  return NextResponse.json({ digest });
}
