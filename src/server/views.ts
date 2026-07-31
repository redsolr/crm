import { z } from "zod";
import type { savedViews } from "@/db/schema";

/**
 * Saved-views domain: wire serialization + request validation, kept out
 * of the route files so they stay thin and this stays unit-testable
 * (`__tests__/views.test.ts`). Wire shape mirrors `lib/viewsApi.ts`'s
 * `SavedView` — snake_case, timestamps as ISO strings.
 */

export type SavedViewRow = typeof savedViews.$inferSelect;

export const VIEW_VISIBILITIES = ["private", "shared"] as const;

export const createViewSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.string().min(1).max(100),
  visibility: z.enum(VIEW_VISIBILITIES).optional(),
  query: z.record(z.string(), z.unknown()).optional(),
});

export const updateViewSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    visibility: z.enum(VIEW_VISIBILITIES).optional(),
    query: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.visibility !== undefined ||
      body.query !== undefined,
    { message: "At least one of name, visibility, query is required" },
  );

export function serializeSavedView(row: SavedViewRow): {
  id: string;
  name: string;
  kind: string;
  visibility: string;
  workspace_id: string;
  owner_account_id: string;
  owner_name: string | null;
  query: Record<string, unknown>;
  created_at: string;
  updated_at: string;
} {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    visibility: row.visibility,
    workspace_id: row.workspaceId,
    owner_account_id: row.ownerAccountId,
    owner_name: row.ownerName,
    query: (row.query ?? {}) as Record<string, unknown>,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
