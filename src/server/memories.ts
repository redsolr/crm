import { and, asc, eq, ilike } from "drizzle-orm";
import { agentMemories, db } from "@/db";
import { mintId } from "@/db/ids";

/**
 * Agent memory (ChatGPT-memory shape, 2026-08-12) — durable facts about
 * the founder and the sales motion, injected into every Ask system
 * prompt and readable/writable through the agent tools on both doors
 * (Ask panel + /mcp). The founder manages the list on /account.
 *
 * Shared by the ask-tools executors and the `/api/memories` routes so
 * both surfaces get identical dedupe/matching semantics.
 */

/** Total memories — bounds the injected prompt block. */
export const MEMORY_CAP = 200;

/** How many memories ride into the Ask system prompt per send. */
export const MEMORY_PROMPT_ITEMS = 100;

export interface MemoryRow {
  id: string;
  content: string;
  createdById: string;
  createdByName: string | null;
  createdAt: Date;
}

export async function listMemories(limit = MEMORY_CAP): Promise<MemoryRow[]> {
  return db
    .select({
      id: agentMemories.id,
      content: agentMemories.content,
      createdById: agentMemories.createdById,
      createdByName: agentMemories.createdByName,
      createdAt: agentMemories.createdAt,
    })
    .from(agentMemories)
    .orderBy(asc(agentMemories.createdAt))
    .limit(limit);
}

export type RememberResult =
  | { saved: true; id: string }
  | { saved: false; reason: "already_saved" | "memory_full" };

/** Save a fact unless an identical one exists (case-insensitive). */
export async function rememberFact(
  content: string,
  actor: { id: string; name: string | null },
): Promise<RememberResult> {
  const existing = await db.query.agentMemories.findFirst({
    where: ilike(agentMemories.content, content),
  });
  if (existing) return { saved: false, reason: "already_saved" };

  const rows = await listMemories();
  if (rows.length >= MEMORY_CAP) {
    return { saved: false, reason: "memory_full" };
  }

  const id = mintId("memo");
  await db.insert(agentMemories).values({
    id,
    content,
    createdById: actor.id,
    createdByName: actor.name,
  });
  return { saved: true, id };
}

export type ForgetResult =
  | { forgotten: string }
  | { ambiguous: string[] }
  | { notFound: true };

/**
 * Delete the memory whose wording matches — exactly one match deletes;
 * several matches are returned so the caller can ask which one.
 */
export async function forgetFact(match: string): Promise<ForgetResult> {
  const escaped = match.replace(/[\\%_]/g, (c) => `\\${c}`);
  const matches = await db
    .select({ id: agentMemories.id, content: agentMemories.content })
    .from(agentMemories)
    .where(ilike(agentMemories.content, `%${escaped}%`))
    .limit(5);
  if (matches.length === 0) return { notFound: true };
  if (matches.length > 1) return { ambiguous: matches.map((m) => m.content) };
  await db
    .delete(agentMemories)
    .where(and(eq(agentMemories.id, matches[0].id)));
  return { forgotten: matches[0].content };
}

export async function deleteMemoryById(id: string): Promise<boolean> {
  const deleted = await db
    .delete(agentMemories)
    .where(eq(agentMemories.id, id))
    .returning({ id: agentMemories.id });
  return deleted.length > 0;
}

/** Wire shape for `/api/memories` — snake_case like every CRM route. */
export function serializeMemory(row: MemoryRow): {
  id: string;
  content: string;
  created_by_name: string | null;
  created_at: string;
} {
  return {
    id: row.id,
    content: row.content,
    created_by_name: row.createdByName,
    created_at: row.createdAt.toISOString(),
  };
}
