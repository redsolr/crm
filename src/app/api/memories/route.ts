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

/**
 * Admin surface of agent memory (ChatGPT-memory shape):
 * `GET /api/memories` → `{ data }` (oldest first) and
 * `POST /api/memories` → `{ memory }` (201; 200 with the EXISTING row
 * when an identical fact is already saved — dedupe, not an error).
 * The agent's own writes go through the remember_fact/forget_fact
 * tools; this surface is the founder managing the list on /account.
 */

const createMemorySchema = z.object({
  content: z.string().trim().min(1).max(500),
});

export async function GET(): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  const rows = await listMemories();
  return NextResponse.json({ data: rows.map(serializeMemory) });
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

  const rows = await listMemories();
  if (!result.saved) {
    const existing = rows.find(
      (r) => r.content.toLowerCase() === parsed.data.content.toLowerCase(),
    );
    if (existing) {
      return NextResponse.json({ memory: serializeMemory(existing) });
    }
    // Dedupe hit but the row is gone — a concurrent delete; retry-able.
    return apiError(409, "conflict", "The memory changed underneath — retry.");
  }
  const created = rows.find((r) => r.id === result.id);
  if (!created) throw new Error(`Memory ${result.id} vanished after insert`);
  return NextResponse.json(
    { memory: serializeMemory(created) },
    { status: 201 },
  );
}
