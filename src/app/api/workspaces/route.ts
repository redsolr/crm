import { NextResponse } from "next/server";
import { STUB_WORKSPACE } from "@/server/bootstrap";
import { requireApiSession } from "@/server/api-auth";

/** `GET /api/workspaces` → `{ workspaces }` — the single static stub
 *  (single tenant; the workspace is a constant, not a table). */

export async function GET(): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  return NextResponse.json({ workspaces: [STUB_WORKSPACE] });
}
