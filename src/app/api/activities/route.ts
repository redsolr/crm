import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/server/api-error";
import { listActivitiesPaged, serializeActivity } from "@/server/activities";

/** `GET /api/activities` (sidebar feed) → `{ activities, total }`. */

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;

  let page = 1;
  const rawPage = params.get("page");
  if (rawPage !== null) {
    page = Number(rawPage);
    if (!Number.isInteger(page) || page < 1) {
      return apiError(422, "validation_failed", "page must be a positive integer");
    }
  }
  let limit = 50;
  const rawLimit = params.get("limit");
  if (rawLimit !== null) {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return apiError(
        422,
        "validation_failed",
        "limit must be an integer between 1 and 100",
      );
    }
  }

  // `workspace_id` is accepted-and-ignored (single tenant).
  const { rows, total } = await listActivitiesPaged({
    entityType: params.get("entity_type") ?? undefined,
    entityId: params.get("entity_id") ?? undefined,
    page,
    limit,
  });

  return NextResponse.json({
    activities: rows.map(serializeActivity),
    total,
  });
}
