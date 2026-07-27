# Handoff — React-side, post Session 18 sweep

> **Drop this into a fresh Claude session as the first message.** Self-contained.
> The auto-loaded memory already covers tenant-0 positioning, codegen pipeline,
> and the no-shims rule — this doc is session-specific state.

**Date:** 2026-04-26
**Repo state:** `tsc --noEmit` 0 errors · `jest` 20/20 · `next build` OK · `eslint` 0 errors
**Backend pinned at:** `Jurisimus-Version: 2026-04-24.basil` (commit `ecfce94` on `platform` `platform` branch)

---

## Standing rule (non-negotiable)

Jurisimus is a **fresh project**. No legacy framing — no BC aliases, no `@deprecated`, no `.transform()` shims, no camelCase wrappers over snake_case wires. The wire IS the shape. TS components consume snake_case directly. If a component prop name differs, fix the prop. If a sed-rename takes 200 sites, do all 200.

Saved as `feedback_no_shims.md` in memory; will auto-load.

---

## What just landed (don't re-do)

The big Session 18 sweep is done. Don't add shims, don't introduce projection helpers, don't add camelCase wrappers anywhere these touch:

- **Spec pipeline.** `openapi/openapi.yaml` synced from `../platform/openapi.yaml` (full internal surface, ~30k lines). Generated TS at `src/lib/generated/api/models/index.ts`. Re-sync via `npm run openapi`. tsconfig excludes `apis/` and `runtime.ts` (we use `models/` only).
- **Routes.** `/v1/work-items` → `/v1/work_items`. `/v1/file-system/*` → `/v1/file_system/*`. Other paths unchanged.
- **Headers.** `Jurisimus-Version: 2026-04-24.basil` on every request through `BaseApiClient`. `If-Match: W/"v<n>"` on WorkItem PATCH/DELETE. Retry-on-503 (Fargate Spot).
- **Auth.** Wire shape is snake_case end-to-end (`access_token`, `refresh_token`, `organization_id`, `organization_name`, `user.full_name`, `user.avatar_url`). `AuthUser` carries `account_id` (the human/payer = `user.id`) AND `organization_id` (the tenant). Active-org primitives wired: `accountApiClient.listMyOrganizations()` and `switchOrganization(id)`.
- **Chat permission.** `POST /v1/organizations/{org_id}/usage/validate` with `useChatPermissions(user.organization_id)`.
- **Folders module.** [`tasksApi.ts`](../../src/lib/tasksApi.ts) `Folder = ApiFolder` direct re-export. View envelopes (`FolderBoardView`/`FolderBacklogView`/`FolderCalendarView`/`FolderTimelineView`) re-exported from generated. Inner JSONB shapes (`board.columns`, `backlog.group_by`, `calendar.default_view`) snake_case to match `folders.dto.ts`. Calendar uses `tasks_by_date`.
- **Pages module.** [`pagesApi.ts`](../../src/lib/pagesApi.ts) `Page = ApiPage` direct re-export. New fields surfaced (`version`, `position`, `pinned`, `archived`, `in_trash`, `is_personal`, `owner_id`).
- **File system.** [`fileSystemApi.ts`](../../src/lib/fileSystemApi.ts) — `FileNode` UI type uses snake_case fields (`parent_id`, `content_type`, `created_at`, `updated_at`). Mapping functions read snake_case wire from `Folder` / `Page` directly. Request bodies snake_case.
- **Work-items / iterations shim removal.** `projectWorkItem` / `projectIteration` / `projectIterationMetrics` deleted. `WorkItem = ApiWorkItem`, `Iteration = ApiIteration`, `IterationMetrics = ApiIterationMetrics`. Components read `wi.state.key` (not `wi.status` — that field doesn't exist on the wire), `wi.due_date`, `wi.assignee_id`, `wi.project_id`, `wi.iteration_id`, `wi.created_at`, etc.
- **Visibility enum** on `WorkItem` is `"private" | "internal" | "public"` (not `"hidden"` — that never existed).
- **TreeFileItem.content_type** UI prop renamed (was `contentType`) — every consumer swept.

Two cliffs that are **deliberately not shims** but worth noting:

- `useFolderBoardQuery` / `useFolderBacklogQuery` / `useFolderCalendarQuery` cache `FolderViewWorkItem[]` (the narrow projection backend folder-view endpoints return — `id, title, status, priority, position, assignee_id, due_date, created_at, updated_at`). `useProjectBoardQuery` caches full `WorkItem[]` (because it calls `/v1/work_items`, not the folder-view endpoint). Two genuinely different wire shapes; type distinction is intentional. Folder-view points/burndown stub to `0` because the wire doesn't include `estimate` (per `FolderViewWorkItemPayload` on backend).
- `useFolderTimelineQuery.epics` is `unknown[]` — backend timeline view returns `epics: any[]` as a placeholder pending the epic-rollup service. Don't type it more strictly until the backend ships shape.

---

## What's still drifted from current backend (will break runtime when exercised)

Priority order. Each is its own focused session.

### 1. Chat schemas — rip `.transform()` shims
[`src/lib/chat/schemas.ts`](../../src/lib/chat/schemas.ts) still uses `.transform()` to convert snake_case wire → camelCase consumer. Per the standing rule, delete the transforms; `z.infer` produces snake_case; sweep ~30 chat consumer sites (most in `queries/chat/*`, `lib/chat/*`, components reading `.chatId`/`.pageId`/`.findingsCount`/`.parentChatId`/`.branchedFromMessageId`/`.branchName`/`.createdAt`/`.updatedAt`/`.messageCount`/`.branchedAtMessageIndex`).

### 2. Activities — controller cut over to `ActivityResponseDto`
Backend now ships flat `{ id, type, entity_type, entity_id, entity_identifier, project_id, actor_id, actor_type, actor_name, changes, metadata, created_at, actor_account?, entity? }`. Our `tasksApi.ts:Activity` and `ActivityWithActor` are still locally typed (`{activity, actor}` envelope) — outdated shape. Replace with generated types and rewire `TaskDetailPanel` / `MobileTaskDetail` consumers.

### 3. Cursor pagination — wire shape change
Backend list endpoints now ship `{ data, has_more, next_page_url, previous_page_url }`. Our consumers expect `{ data, meta: { total, page, limit, hasMore } }`. List hooks (`useWorkItemsQuery`, `useFoldersQuery`, etc.) need rewiring. `next_page_url` is a URL-shaped relative path: `fetch(new URL(next_page_url, currentRequestUrl))`.

### 4. Prefixed IDs (`wi_<base58>`) — verify Zod accepts them
Wire IDs are now `wi_<base58>`, `fld_<base58>`, `acc_<base58>`, etc. Generated types still declare `format: uuid` patterns. Likely the parser silently allows the new prefix (validators are typically permissive on string format), but verify by hitting a real endpoint. If validation fails, regen with prefix-aware patterns.

### 5. Stripe-shape error envelope — preserve `request_id`
[`api-client.ts:ApiError`](../../src/lib/api-client.ts) reads `code`, `message`, `details` but doesn't pull `request_id`. Add it to the class + surface in user-facing error UI ("Contact support — request id req_xyz").

### 6. `include` vs `expand` rename
Cross-cutting: every `expand[]=author` callsite becomes `include[]=author`. Mechanical sed sweep across `src/`.

### 7. Idempotency-Key on writes
Discipline doc § B3: `Idempotency-Key` header on every POST/PATCH/DELETE, 30-day TTL, retry-aware (key generated **outside** the react-query retry loop so retries dedupe). Architectural — not a blanket sed. Likely needs a wrapper around `useMutation` or a `useIdempotencyKey()` hook that persists per logical operation.

### 8. Label restructure
Backend `Label` is now `{ id, project_id, key, name, color, description, template_id, created_at, updated_at }` — project-scoped with a stable per-project `key`. Our `tasksApi.ts:Label` is still account-scoped (old shape). Replace with generated `Label`, sweep consumers.

### 9. Epic dead-code cleanup
Backend has no `/v1/epics` controller. Frontend has `Epic`, `EpicProgress`, `useEpicsQuery`, `EpicWithTaskCount` (already removed in folder-views), timeline UI rendering epics. Delete all of it. (`useFolderTimelineQuery.epics: unknown[]` placeholder stays until backend ships epic rollup.)

### 10. `account_id` → `organization_id` tenant audit
~18 files use `user.account_id` as a tenant scope when calling endpoints. Many should be `organization_id` now (per the platform tenancy model: `account` = human/payer, `organization` = tenant). Audit each call site:
- `/accounts/:id/folders` — likely org-scoped now? Check backend.
- `/accounts/:id/subscription` — stays account-scoped (subscription belongs to payer)?
- `/accounts/:id/usage/summary` — ?
- `/v1/payments/create-portal-session` body `{account_id}` — ?
- Team membership endpoints — reframed as organization members?

Need a per-endpoint table from backend before sweeping.

### 11. Multi-org switcher UI
API client functions exist (`listMyOrganizations`, `switchOrganization`). UX not designed. After switch, replace stored tokens with returned pair, invalidate all queries (cache is org-scoped server-side via JWT), re-bootstrap auth state. Persist last-used org per device for bootstrap.

### 12. Vocabulary lens migration — `WorkItem` → `Task` etc.
The public spec uses agile-team vocabulary (`Task`/`Sprint`/`Tag`/`Note`); we're on internal vocabulary. For tenant-0 positioning we should consume the public lens — but `/v1/tasks`, `/v1/sprints`, `/v1/notes` controllers don't exist yet (only `/v1/tags` is mounted on the public-lens path). Wait for backend rollout; then rename everywhere.

---

## Where to start (concrete)

If you have one session: **do #1** (chat schemas shim removal). Same playbook as the work-items sweep that just landed. Smallest cohesive scope. Kills the last `.transform()` shim in the codebase.

```bash
# Step 1: rip the transforms
# Edit src/lib/chat/schemas.ts — remove every `.transform(...)` chain.
# z.infer<typeof FooSchema> will then produce snake_case.

# Step 2: sed sweep the consumers
# Likely fields: pageId, projectId, findingsCount, parentChatId,
#   branchedFromMessageId, branchName, chatId, messageCount,
#   branchedAtMessageIndex, createdAt, updatedAt
# Use the same `find ... | xargs sed -i ...` pattern as Session 18.

# Step 3: DoD
npx tsc --noEmit
npm test -- --silent
npm run build
npm run lint
```

If something looks weird in the backend before you start: **read the backend repo directly** at `D:\Jurisimus\platform` — `git log --oneline -20` then look at `*.openapi.ts` / `*.response.dto.ts` for any module you're touching. The user has explicitly OK'd reading the platform repo.

---

## Smoke-test gap

I never started a dev server or verified end-to-end against a live backend. The DoD chain (tsc/jest/build/lint) confirms shape correctness, not runtime correctness. Worth a manual smoke test of: login → org auto-loads from exchange → create work item → drag on board → open page editor → load activity feed.

---

## Memory entries that auto-load (don't repeat)

- `project_tenant_zero.md` — this app is tenant 0; build like an external customer
- `feedback_no_shims.md` — wire IS the shape; no transforms / wrappers
- `project_codegen_pipeline.md` — `npm run openapi` regen workflow
- `project_platform_shift.md` — backend = platform, app = tenant 0
- `project_vocabulary_rename.md` — 13 canonical primitives; account=payer, org=tenant
- `project_dev_infra.md` — Fargate Spot 503s on dev, retry-on-503 wired
- `project_dto_pattern.md` — Zod mirrors `*ResponseDto`, never raw rows

That's it. Trust the memory + this doc + the openapi.yaml in `openapi/`. Don't ask the user to re-explain context they've already given.
