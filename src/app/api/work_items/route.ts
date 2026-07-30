import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonBody } from "@/server/api-error";
import { logActivity } from "@/server/activities";
import {
  MAX_PAGE_SIZE,
  createWorkItemSchema,
  decodePageToken,
  encodePageToken,
  findTypeByKey,
  insertWorkItem,
  listWorkItems,
  loadWorkItem,
  resolveStage,
  serializeWorkItem,
  type ListFilters,
} from "@/server/work-items";

/**
 * `GET /api/work_items` (cursor list) + `POST /api/work_items` (create) —
 * local replacements for the platform endpoints the generated client
 * calls (backend-swap step 2). Auth arrives with swap step 6.
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;

  let pageSize = MAX_PAGE_SIZE;
  const rawPageSize = params.get("page_size");
  if (rawPageSize !== null) {
    pageSize = Number(rawPageSize);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      return apiError(
        422,
        "validation_failed",
        `page_size must be an integer between 1 and ${MAX_PAGE_SIZE}`,
      );
    }
  }

  let offset = 0;
  const rawToken = params.get("page_token");
  if (rawToken !== null) {
    const decoded = decodePageToken(rawToken);
    if (decoded === null) {
      return apiError(422, "validation_failed", "Invalid page_token");
    }
    offset = decoded;
  }

  // No iterations exist in the standalone CRM — an iteration filter can
  // never match anything.
  if (params.get("iteration_id") !== null) {
    return NextResponse.json({
      data: [],
      has_more: false,
      next_page_url: null,
      previous_page_url: null,
    });
  }

  // `workspace_id` is accepted-and-ignored: single tenant, the stub
  // workspace is the only universe. `include` has no local relations.
  const filters: ListFilters = {
    typeKey: params.get("type_key") ?? undefined,
    stateKey: params.get("state_key") ?? undefined,
    stateCategory: params.get("state_category") ?? undefined,
    parentId: params.get("parent_id") ?? undefined,
    assigneeId: params.get("assignee_id") ?? undefined,
  };

  const { rows, hasMore } = await listWorkItems(filters, pageSize, offset);

  return NextResponse.json({
    data: rows.map(serializeWorkItem),
    has_more: hasMore,
    next_page_url: hasMore
      ? `/api/work_items?page_token=${encodePageToken(offset + pageSize)}`
      : null,
    previous_page_url:
      offset > 0
        ? `/api/work_items?page_token=${encodePageToken(Math.max(0, offset - pageSize))}`
        : null,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const raw = parsedBody.body;

  const parsed = createWorkItemSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      422,
      "validation_failed",
      "Request body failed validation",
      parsed.error.issues,
    );
  }
  const body = parsed.data;

  const type = await findTypeByKey(body.type_key ?? "task");
  if (!type) {
    return apiError(
      422,
      "validation_failed",
      `Unknown work-item type key: ${body.type_key ?? "task"}`,
    );
  }

  const stage = await resolveStage(type, body.state_key);
  if (!stage) {
    return apiError(
      422,
      "validation_failed",
      `Unknown workflow state key for type ${type.key}: ${body.state_key ?? "(default)"}`,
    );
  }

  if (body.parent_id !== undefined) {
    const parent = await loadWorkItem(body.parent_id);
    if (!parent) {
      return apiError(
        422,
        "validation_failed",
        `parent_id does not reference an existing work item: ${body.parent_id}`,
      );
    }
  }

  const created = await insertWorkItem({ body, type, stage });
  await logActivity({
    type: "work_item_created",
    entityId: created.record.id,
    entityIdentifier: created.record.identifier,
  });
  return NextResponse.json(
    { work_item: serializeWorkItem(created) },
    { status: 201 },
  );
}
