import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, readJsonBody } from "@/server/api-error";
import { requireApiSession } from "@/server/api-auth";
import { currentActor } from "@/server/actor";
import {
  listMemories,
  rememberFact,
  serializeMemory,
} from "@/server/memories";
import { isMemoryEnabled, setMemoryEnabled } from "@/server/settings";

/**
 * Admin surface of agent memory (ChatGPT-memory shape):
 * `GET /api/memories` → `{ data, enabled }` (oldest first),
 * `POST /api/memories` → `{ memory }` (201; 200 with the EXISTING row
 * when an identical fact is already saved — dedupe, not an error), and
 * `PATCH /api/memories` → `{ enabled }` (the pause toggle: paused =
 * not injected into Ask sends and not writable by the agent tools).
 * The agent's own writes go through the remember_fact/forget_fact
 * tools; this surface is the founder managing the list on /account.
 */

const createMemorySchema = z.object({
  content: z.string().trim().min(1).max(500),
});

const patchSettingsSchema = z.object({
  enabled: z.boolean(),
});

export async function GET(): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  const [rows, enabled] = await Promise.all([
    listMemories(),
    isMemoryEnabled(),
  ]);
  return NextResponse.json({ data: rows.map(serializeMemory), enabled });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = createMemorySchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return apiError(
      422,
      "validation_failed",
      "Request body failed validation",
      parsed.error.issues,
    );
  }

  const actor = await currentActor();
  const result = await rememberFact(parsed.data.content, actor);
  if (!result.saved && result.reason === "memory_full") {
    return apiError(
      422,
      "memory_full",
      "Memory is full — delete some saved memories first.",
    );
  }
  return NextResponse.json(
    { memory: serializeMemory(result.memory) },
    { status: result.saved ? 201 : 200 },
  );
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = patchSettingsSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return apiError(
      422,
      "validation_failed",
      "Request body failed validation",
      parsed.error.issues,
    );
  }
  await setMemoryEnabled(parsed.data.enabled);
  return NextResponse.json({ enabled: parsed.data.enabled });
}
