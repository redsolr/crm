import { NextResponse } from "next/server";
import { STUB_WORKSPACE } from "@/server/bootstrap";

/** `GET /v1/workspaces` → `{ workspaces }` — the single static stub
 *  (single tenant; the workspace is a constant, not a table). */

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ workspaces: [STUB_WORKSPACE] });
}
