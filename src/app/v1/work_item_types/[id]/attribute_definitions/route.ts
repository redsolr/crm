import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, recordTypes } from "@/db";
import { apiError } from "@/server/api-error";
import {
  listDefinitionsForType,
  serializeDefinition,
} from "@/server/attributes";

/** `GET /v1/work_item_types/:id/attribute_definitions` → `{ data }`. */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  const type = await db
    .select()
    .from(recordTypes)
    .where(eq(recordTypes.id, id))
    .limit(1);
  if (!type[0]) {
    return apiError(404, "not_found", `Work item type not found: ${id}`);
  }
  const definitions = await listDefinitionsForType(id);
  return NextResponse.json({ data: definitions.map(serializeDefinition) });
}
