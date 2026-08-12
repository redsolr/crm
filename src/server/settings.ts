import { eq, sql } from "drizzle-orm";
import { appSettings, db } from "@/db";

/**
 * Single-tenant app settings — a jsonb key/value read through typed
 * accessors only. Missing key = the documented default, so features
 * stay zero-config until the founder flips them.
 */

const MEMORY_ENABLED_KEY = "memory_enabled";

async function getSetting(key: string): Promise<unknown> {
  const row = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, key),
  });
  return row?.value;
}

async function setSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: sql`now()` },
    });
}

/** Memory defaults ON; paused = not injected and not writable. */
export async function isMemoryEnabled(): Promise<boolean> {
  return (await getSetting(MEMORY_ENABLED_KEY)) !== false;
}

export async function setMemoryEnabled(enabled: boolean): Promise<void> {
  await setSetting(MEMORY_ENABLED_KEY, enabled);
}
