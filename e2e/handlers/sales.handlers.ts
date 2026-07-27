/**
 * Mock handlers for the Sales pipeline (Phase 2A).
 *
 * Mirrors the `sales-pipeline` project template in
 * `platform/src/modules/projects/project-templates.ts`. Stateful — the
 * handler closes over arrays that the create/transition routes mutate
 * so the journey spec can verify pipeline progression without hitting
 * a real backend.
 *
 * URL contract: every endpoint sits under `/v1/` (`API_V1`). Wire
 * shapes use snake_case. List envelopes use the cursor shape
 * `{ data, has_more, next_page_url, previous_page_url }` for
 * `/v1/work_items`; nested-resource lists return `{ data }` (no
 * pagination markers).
 */

import { Page } from "@playwright/test";
import { toStorageEnvelope } from "../../src/lib/attribute-value-envelope";
import { API_V1, TEST_USER } from "./shared";

// ── Wire types ──────────────────────────────────────────────────────────────

interface WireWorkflow {
  id: string;
  workspace_id: string;
  key: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
interface WireState {
  id: string;
  workflow_id: string;
  key: string;
  name: string;
  category: "not_started" | "active" | "done" | "dead";
  position: number;
  created_at: string;
  updated_at: string;
}
interface WireWorkItemType {
  id: string;
  workspace_id: string;
  key: string;
  name: string;
  description: string | null;
  workflow_id: string;
  template_id: string | null;
  created_at: string;
  updated_at: string;
}
interface WireAttributeDefinition {
  id: string;
  work_item_type_id: string;
  key: string;
  name: string;
  data_type: "text" | "number" | "date" | "select" | "url" | "boolean";
  required: boolean;
  config: { options?: string[]; maxLength?: number } | null;
  /** LLM-enrichment config when this is an AI-computed column. */
  enrichment: Record<string, unknown> | null;
  position: number;
  template_id: string | null;
  created_at: string;
  updated_at: string;
}
interface WireWorkItem {
  id: string;
  identifier: string;
  title: string;
  subject: string | null;
  description: string | null;
  workspace_id: string;
  folder_id: string | null;
  state: { id: string; key: string; name: string; category: WireState["category"] };
  type: { id: string; key: string; name: string };
  priority: "none" | "low" | "medium" | "high" | "urgent";
  position: number;
  iteration_id: string | null;
  parent_id: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  dri_id: string | null;
  dri_name: string | null;
  created_by_id: string;
  created_by_name: string | null;
  due_date: string | null;
  estimate: number | null;
  visibility: "private" | "internal" | "public";
  vote_count: number;
  version: number;
  shipped_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
interface WireAttributeValue {
  id: string;
  work_item_id: string;
  definition_id: string;
  /** Canonical storage envelope, exactly as the platform serves it:
   *  `{ value: <typed> }` — the app client unwraps at its boundary
   *  (shared shape logic: `src/lib/attribute-value-envelope.ts`). */
  value: { value: unknown };
  source: "manual" | "computed";
  computed_at: string | null;
  computed_model: string | null;
  created_at: string;
  updated_at: string;
}
interface WireSavedView {
  id: string;
  name: string;
  kind: string;
  visibility: "private" | "shared";
  workspace_id: string;
  owner_account_id: string;
  owner_name: string | null;
  query: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const NOW = () => new Date().toISOString();
// The sales FE resolves the active workspace from
// `useAppContextStore.currentWorkspace` — which the auth fixture seeds
// as `ws-e2e-default`. All sales work_items live in that workspace; the
// `/v1/workspaces/:id/{workflows,work_item_types}` mocks below match any
// id, so this constant just stamps the wire `workspace_id` field.
const SALES_WORKSPACE_ID = "ws-e2e-default";

const PIPELINE_STATES_DEF: Array<{
  key: string;
  name: string;
  category: WireState["category"];
}> = [
  { key: "identified", name: "Identified", category: "not_started" },
  { key: "contacted", name: "Contacted", category: "not_started" },
  { key: "replied", name: "Replied", category: "active" },
  { key: "call_booked", name: "Call Booked", category: "active" },
  { key: "call_done", name: "Call Done", category: "active" },
  { key: "trial", name: "Trial", category: "active" },
  { key: "won", name: "Won", category: "done" },
  { key: "lost", name: "Lost", category: "dead" },
  { key: "not_now", name: "Not Now", category: "dead" },
];

const COMMITMENT_STATES_DEF: Array<{
  key: string;
  name: string;
  category: WireState["category"];
}> = [
  { key: "open", name: "Open", category: "active" },
  { key: "done", name: "Done", category: "done" },
  { key: "dropped", name: "Dropped", category: "dead" },
];

const MEMORY_STATES_DEF: Array<{
  key: string;
  name: string;
  category: WireState["category"];
}> = [
  { key: "active", name: "Active", category: "active" },
  { key: "archived", name: "Archived", category: "dead" },
];

function makeState(
  workflowId: string,
  def: (typeof PIPELINE_STATES_DEF)[number],
  position: number,
): WireState {
  return {
    id: `wfs-${workflowId}-${def.key}`,
    workflow_id: workflowId,
    key: def.key,
    name: def.name,
    category: def.category,
    position,
    created_at: NOW(),
    updated_at: NOW(),
  };
}

// ── Mock route handler ─────────────────────────────────────────────────────

export async function setupSalesHandlers(page: Page) {
  // ── Per-handler-call mutable state ────────────────────────────────────
  const workflows: WireWorkflow[] = [
    {
      id: "wf-pipeline",
      workspace_id: SALES_WORKSPACE_ID,
      key: "pipeline",
      name: "Pipeline",
      description: null,
      is_default: true,
      created_at: NOW(),
      updated_at: NOW(),
    },
    {
      id: "wf-commitment",
      workspace_id: SALES_WORKSPACE_ID,
      key: "commitment",
      name: "Commitment",
      description: null,
      is_default: false,
      created_at: NOW(),
      updated_at: NOW(),
    },
    {
      id: "wf-memory",
      workspace_id: SALES_WORKSPACE_ID,
      key: "memory",
      name: "Memory",
      description: null,
      is_default: false,
      created_at: NOW(),
      updated_at: NOW(),
    },
  ];

  const statesByWorkflow: Record<string, WireState[]> = {
    "wf-pipeline": PIPELINE_STATES_DEF.map((d, i) =>
      makeState("wf-pipeline", d, i),
    ),
    "wf-commitment": COMMITMENT_STATES_DEF.map((d, i) =>
      makeState("wf-commitment", d, i),
    ),
    "wf-memory": MEMORY_STATES_DEF.map((d, i) =>
      makeState("wf-memory", d, i),
    ),
  };

  const types: WireWorkItemType[] = [
    {
      id: "wit-account",
      workspace_id: SALES_WORKSPACE_ID,
      key: "account",
      name: "Account",
      description: null,
      workflow_id: "wf-memory",
      template_id: null,
      created_at: NOW(),
      updated_at: NOW(),
    },
    {
      id: "wit-contact",
      workspace_id: SALES_WORKSPACE_ID,
      key: "contact",
      name: "Contact",
      description: null,
      workflow_id: "wf-memory",
      template_id: null,
      created_at: NOW(),
      updated_at: NOW(),
    },
    {
      id: "wit-opportunity",
      workspace_id: SALES_WORKSPACE_ID,
      key: "opportunity",
      name: "Opportunity",
      description: null,
      workflow_id: "wf-pipeline",
      template_id: null,
      created_at: NOW(),
      updated_at: NOW(),
    },
    {
      id: "wit-call_note",
      workspace_id: SALES_WORKSPACE_ID,
      key: "call_note",
      name: "Call Note",
      description: null,
      workflow_id: "wf-memory",
      template_id: null,
      created_at: NOW(),
      updated_at: NOW(),
    },
    {
      id: "wit-commitment",
      workspace_id: SALES_WORKSPACE_ID,
      key: "commitment",
      name: "Commitment",
      description: null,
      workflow_id: "wf-commitment",
      template_id: null,
      created_at: NOW(),
      updated_at: NOW(),
    },
  ];

  const attributeDefinitions: WireAttributeDefinition[] = [
    // Account
    defAttr("wit-account", "source", "Source", "select", true, {
      options: [
        "cold_outreach",
        "intro",
        "inbound",
        "event",
        "referral",
        "partner",
        "other",
      ],
    }),
    defAttr("wit-account", "company_url", "Company URL", "url", false, null),
    defAttr("wit-account", "segment", "Segment", "select", false, {
      options: [
        "solo",
        "firm_2_5",
        "firm_6_10",
        "firm_11_20",
        "firm_20_plus",
        "in_house",
        "other",
      ],
    }),
    defAttr("wit-account", "practice_area", "Practice Area", "select", false, {
      options: [
        "litigation",
        "corporate",
        "real_estate",
        "labor",
        "ip",
        "family",
        "criminal",
        "tax",
        "general_practice",
        "other",
      ],
    }),
    defAttr("wit-account", "current_tools", "Current Tools", "text", false, {
      maxLength: 500,
    }),
    defAttr("wit-account", "pain_summary", "Pain Summary", "text", false, {
      maxLength: 2000,
    }),
    defAttr(
      "wit-account",
      "icp_fit",
      "ICP Fit",
      "select",
      false,
      { options: ["strong", "moderate", "weak", "unclear"] },
      {
        prompt:
          "Rate how well this account fits our ideal-customer profile.",
        refreshPolicy: "manual",
      },
    ),
    defAttr(
      "wit-account",
      "summary",
      "Summary",
      "text",
      false,
      { maxLength: 700 },
      {
        prompt: "Write a 2-3 sentence brief on this account.",
        refreshPolicy: "manual",
      },
    ),
    // Contact
    defAttr("wit-contact", "first_name", "First Name", "text", false, {
      maxLength: 80,
    }),
    defAttr("wit-contact", "last_name", "Last Name", "text", false, {
      maxLength: 80,
    }),
    defAttr("wit-contact", "role", "Role", "text", false, { maxLength: 120 }),
    defAttr("wit-contact", "email", "Email", "text", false, {
      maxLength: 200,
    }),
    defAttr("wit-contact", "linkedin_url", "LinkedIn URL", "url", false, null),
    defAttr("wit-contact", "decision_role", "Decision Role", "select", false, {
      options: [
        "founder",
        "decision_maker",
        "champion",
        "evaluator",
        "influencer",
        "blocker",
        "user",
        "other",
      ],
    }),
    // Opportunity
    defAttr("wit-opportunity", "use_case", "Use Case", "select", true, {
      options: [
        "matter_chaos",
        "client_comms",
        "drafting",
        "research",
        "knowledge_management",
        "other",
      ],
    }),
    defAttr(
      "wit-opportunity",
      "value_estimate",
      "Value Estimate (THB/yr)",
      "number",
      false,
      null,
    ),
    defAttr("wit-opportunity", "next_action", "Next Action", "text", false, {
      maxLength: 500,
    }),
    defAttr(
      "wit-opportunity",
      "next_action_date",
      "Next Action Date",
      "date",
      false,
      null,
    ),
    defAttr(
      "wit-opportunity",
      "expected_close_date",
      "Expected Close Date",
      "date",
      false,
      null,
    ),
    defAttr("wit-opportunity", "lost_reason", "Lost Reason", "select", false, {
      options: [
        "too_expensive",
        "wrong_fit",
        "no_decision",
        "competitor",
        "timing",
        "no_response",
        "other",
      ],
    }),
    defAttr(
      "wit-opportunity",
      "not_now_until",
      "Not Now Until",
      "date",
      false,
      null,
    ),
    // Call note
    defAttr("wit-call_note", "call_date", "Call Date", "date", true, null),
    defAttr("wit-call_note", "outcome", "Outcome", "select", false, {
      options: [
        "positive",
        "neutral",
        "negative",
        "no_show",
        "rescheduled",
        "other",
      ],
    }),
    defAttr("wit-call_note", "attendees", "Attendees", "text", false, {
      maxLength: 500,
    }),
    defAttr("wit-call_note", "summary", "Summary", "text", false, {
      maxLength: 8000,
    }),
    defAttr("wit-call_note", "call_type", "Call Type", "select", false, {
      options: [
        "in_person_demo",
        "paid_feedback",
        "intro_call",
        "follow_up",
        "pilot_checkin",
        "other",
      ],
    }),
    // Commitment
    defAttr("wit-commitment", "due_date", "Due Date", "date", true, null),
    defAttr("wit-commitment", "promised_to", "Promised To", "text", false, {
      maxLength: 200,
    }),
  ];

  const workItems: WireWorkItem[] = [];
  const attributeValues: WireAttributeValue[] = [];
  let workItemCounter = 0;
  const savedViews: WireSavedView[] = [];
  let savedViewCounter = 0;

  // ── Routes ────────────────────────────────────────────────────────────
  //
  // Workspace rename arc (2026-05-27): the `project` primitive was
  // retired, so there is no `/v1/projects/organization/:orgId` mock
  // here. The sales FE (`useSalesWorkspaceBundle`) resolves the active
  // workspace from `useAppContextStore.currentWorkspace` — seeded by the
  // auth.fixture's `/v1/workspaces` mock as `ws-e2e-default` — and pulls
  // its workflows / types / attribute definitions from the
  // workspace-scoped routes below.

  // GET /v1/workspaces/:id/workflows
  await page.route(
    (url) => /^\/v1\/workspaces\/[^/]+\/workflows$/.test(url.pathname),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: workflows }),
      });
    },
  );

  // GET /v1/workflows/:workflowId/states
  await page.route(
    (url) => /^\/v1\/workflows\/[^/]+\/states$/.test(url.pathname),
    async (route, request) => {
      const id =
        request.url().split("/v1/workflows/")[1]?.split("/")[0] ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: statesByWorkflow[id] ?? [] }),
      });
    },
  );

  // GET /v1/workspaces/:id/work_item_types
  await page.route(
    (url) => /^\/v1\/workspaces\/[^/]+\/work_item_types$/.test(url.pathname),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: types }),
      });
    },
  );

  // GET /v1/work_item_types/:id/attribute_definitions
  await page.route(
    (url) =>
      /^\/v1\/work_item_types\/[^/]+\/attribute_definitions$/.test(
        url.pathname,
      ),
    async (route, request) => {
      const id =
        request.url().split("/v1/work_item_types/")[1]?.split("/")[0] ?? "";
      const defs = attributeDefinitions.filter(
        (d) => d.work_item_type_id === id,
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: defs }),
      });
    },
  );

  // GET / POST /v1/work_items
  await page.route(`${API_V1}/work_items*`, async (route, request) => {
    const u = new URL(request.url());

    if (request.method() === "GET" && u.pathname === "/v1/work_items") {
      const filtered = workItems.filter((w) => {
        const workspaceId = u.searchParams.get("workspace_id");
        if (workspaceId && w.workspace_id !== workspaceId) return false;
        const typeKey = u.searchParams.get("type_key");
        if (typeKey && w.type.key !== typeKey) return false;
        const parentId = u.searchParams.get("parent_id");
        if (parentId && w.parent_id !== parentId) return false;
        return true;
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: filtered,
          has_more: false,
          next_page_url: null,
          previous_page_url: null,
        }),
      });
      return;
    }

    if (request.method() === "POST" && u.pathname === "/v1/work_items") {
      const body = request.postDataJSON() as Record<string, unknown>;
      const typeKey = (body.type_key as string | undefined) ?? "task";
      const stateKey =
        (body.state_key as string | undefined) ?? "identified";
      const type = types.find((t) => t.key === typeKey);
      const workflowId = type?.workflow_id ?? "wf-pipeline";
      const stateDef = (statesByWorkflow[workflowId] ?? []).find(
        (s) => s.key === stateKey,
      );
      workItemCounter += 1;
      const newItem: WireWorkItem = {
        id: `wi-${workItemCounter}`,
        identifier: `SALES-${workItemCounter}`,
        title: (body.title as string) ?? "Untitled",
        subject: null,
        description: (body.description as string) ?? null,
        workspace_id:
          (body.workspace_id as string | undefined) ?? SALES_WORKSPACE_ID,
        folder_id: null,
        state: {
          id: stateDef?.id ?? "wfs-pipeline-identified",
          key: stateDef?.key ?? stateKey,
          name: stateDef?.name ?? stateKey,
          category: stateDef?.category ?? "not_started",
        },
        type: {
          id: type?.id ?? "wit-account",
          key: type?.key ?? typeKey,
          name: type?.name ?? typeKey,
        },
        priority: "none",
        position: workItemCounter,
        iteration_id: null,
        parent_id: (body.parent_id as string | null) ?? null,
        assignee_id: null,
        assignee_name: null,
        dri_id: null,
        dri_name: null,
        created_by_id: TEST_USER.user_id,
        created_by_name: TEST_USER.full_name ?? null,
        due_date: null,
        estimate: null,
        visibility: "private",
        vote_count: 0,
        version: 1,
        shipped_at: null,
        created_at: NOW(),
        updated_at: NOW(),
        completed_at: null,
      };
      workItems.push(newItem);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ workItem: newItem }),
      });
      return;
    }

    await route.fallback();
  });

  // GET / PATCH / DELETE /v1/work_items/:id
  await page.route(
    (url) => /^\/v1\/work_items\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      const id =
        request.url().split("/v1/work_items/")[1]?.split(/[?/]/)[0] ?? "";
      const idx = workItems.findIndex((w) => w.id === id);
      if (idx === -1) {
        await route.fulfill({ status: 404 });
        return;
      }
      const item = workItems[idx]!;

      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ workItem: item }),
        });
        return;
      }

      if (request.method() === "PATCH") {
        const body = request.postDataJSON() as Record<string, unknown>;
        const nextStateKey = body.state_key as string | undefined;
        let nextState = item.state;
        if (nextStateKey) {
          const type = types.find((t) => t.id === item.type.id);
          const workflowId = type?.workflow_id ?? "wf-pipeline";
          const def = (statesByWorkflow[workflowId] ?? []).find(
            (s) => s.key === nextStateKey,
          );
          if (def) {
            nextState = {
              id: def.id,
              key: def.key,
              name: def.name,
              category: def.category,
            };
          }
        }
        const updated: WireWorkItem = {
          ...item,
          state: nextState,
          version: item.version + 1,
          updated_at: NOW(),
        };
        workItems[idx] = updated;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ workItem: updated }),
        });
        return;
      }

      await route.fallback();
    },
  );

  // GET /v1/work_items/:id/attribute_values + PUT /v1/work_items/:wi/attribute_values/:def
  await page.route(
    (url) =>
      /^\/v1\/work_items\/[^/]+\/attribute_values(\/[^/]+)?$/.test(
        url.pathname,
      ),
    async (route, request) => {
      const segments = new URL(request.url()).pathname.split("/");
      const workItemId = segments[3] ?? "";
      const definitionId = segments[5];

      if (request.method() === "GET" && !definitionId) {
        const values = attributeValues.filter(
          (v) => v.work_item_id === workItemId,
        );
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: values }),
        });
        return;
      }

      if (request.method() === "PUT" && definitionId) {
        const body = request.postDataJSON() as { value: unknown };
        const existingIdx = attributeValues.findIndex(
          (v) =>
            v.work_item_id === workItemId && v.definition_id === definitionId,
        );
        const next: WireAttributeValue = {
          id:
            existingIdx >= 0
              ? attributeValues[existingIdx]!.id
              : `av-${workItemId}-${definitionId}`,
          work_item_id: workItemId,
          definition_id: definitionId,
          value: toStorageEnvelope(body.value),
          // A PUT is a human write — provenance resets to manual.
          source: "manual",
          computed_at: null,
          computed_model: null,
          created_at:
            existingIdx >= 0
              ? attributeValues[existingIdx]!.created_at
              : NOW(),
          updated_at: NOW(),
        };
        if (existingIdx >= 0) attributeValues[existingIdx] = next;
        else attributeValues.push(next);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ value: next }),
        });
        return;
      }

      await route.fallback();
    },
  );

  // POST /v1/work_items/:wi/attribute_values/:def/compute — the
  // attribute-enrichment primitive's sync single-item path. Mirrors the
  // platform's no-clobber contract: a manual row is skipped loudly.
  await page.route(
    (url) =>
      /^\/v1\/work_items\/[^/]+\/attribute_values\/[^/]+\/compute$/.test(
        url.pathname,
      ),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const segments = new URL(request.url()).pathname.split("/");
      const workItemId = segments[3] ?? "";
      const definitionId = segments[5] ?? "";
      const def = attributeDefinitions.find((d) => d.id === definitionId);
      const existingIdx = attributeValues.findIndex(
        (v) =>
          v.work_item_id === workItemId && v.definition_id === definitionId,
      );
      const existing =
        existingIdx >= 0 ? attributeValues[existingIdx]! : undefined;

      if (existing && existing.source === "manual") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            outcome: "skipped_manual_override",
            value: existing,
          }),
        });
        return;
      }

      const computedValue =
        def?.data_type === "select" && def.config?.options?.length
          ? def.config.options[0]
          : "AI computed";
      const next: WireAttributeValue = {
        id: existing?.id ?? `av-${workItemId}-${definitionId}`,
        work_item_id: workItemId,
        definition_id: definitionId,
        value: toStorageEnvelope(computedValue),
        source: "computed",
        computed_at: NOW(),
        computed_model: "mock-llm",
        created_at: existing?.created_at ?? NOW(),
        updated_at: NOW(),
      };
      if (existingIdx >= 0) attributeValues[existingIdx] = next;
      else attributeValues.push(next);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ outcome: "computed", value: next }),
      });
    },
  );

  // GET /v1/activities/entity/:type/:id — the record-page timeline's
  // platform-activity stream. Empty is a valid feed; call notes and
  // commitments still populate the merged timeline.
  await page.route(
    (url) => /^\/v1\/activities\/entity\/[^/]+\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ activities: [] }),
      });
    },
  );

  // GET / POST /v1/views + PATCH / DELETE /v1/views/:id — stateful
  // saved-view store for the CRM table surfaces. Overrides the auth
  // fixture's empty `{ data: [] }` default (this registration is later,
  // so it wins). Platform contract: `kind` is always `work_items`; the
  // CRM surface discriminator lives inside the opaque `query` blob.
  await page.route(
    (url) => /^\/v1\/views(\/[^/]+)?$/.test(url.pathname),
    async (route, request) => {
      const u = new URL(request.url());
      const viewId = u.pathname.split("/v1/views/")[1]?.split(/[?/]/)[0];

      if (request.method() === "GET" && !viewId) {
        const kind = u.searchParams.get("kind");
        const data = savedViews.filter((v) => !kind || v.kind === kind);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data }),
        });
        return;
      }

      if (request.method() === "POST" && !viewId) {
        const body = request.postDataJSON() as {
          name: string;
          kind: string;
          visibility?: "private" | "shared";
          query?: Record<string, unknown>;
        };
        savedViewCounter += 1;
        const view: WireSavedView = {
          id: `view-${savedViewCounter}`,
          name: body.name,
          kind: body.kind,
          visibility: body.visibility ?? "private",
          workspace_id: SALES_WORKSPACE_ID,
          owner_account_id: TEST_USER.account_id ?? TEST_USER.user_id,
          owner_name: TEST_USER.full_name ?? null,
          query: body.query ?? {},
          created_at: NOW(),
          updated_at: NOW(),
        };
        savedViews.push(view);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ view }),
        });
        return;
      }

      if (viewId) {
        const idx = savedViews.findIndex((v) => v.id === viewId);
        if (idx === -1) {
          await route.fulfill({ status: 404 });
          return;
        }

        if (request.method() === "PATCH") {
          const body = request.postDataJSON() as {
            name?: string;
            visibility?: "private" | "shared";
            query?: Record<string, unknown>;
          };
          const updated: WireSavedView = {
            ...savedViews[idx]!,
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.visibility !== undefined
              ? { visibility: body.visibility }
              : {}),
            ...(body.query !== undefined ? { query: body.query } : {}),
            updated_at: NOW(),
          };
          savedViews[idx] = updated;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ view: updated }),
          });
          return;
        }

        if (request.method() === "DELETE") {
          savedViews.splice(idx, 1);
          await route.fulfill({ status: 204 });
          return;
        }
      }

      await route.fallback();
    },
  );
}

function defAttr(
  workItemTypeId: string,
  key: string,
  name: string,
  data_type: WireAttributeDefinition["data_type"],
  required: boolean,
  config: WireAttributeDefinition["config"],
  enrichment: WireAttributeDefinition["enrichment"] = null,
): WireAttributeDefinition {
  return {
    id: `ad-${workItemTypeId}-${key}`,
    work_item_type_id: workItemTypeId,
    key,
    name,
    data_type,
    required,
    config,
    enrichment,
    position: 0,
    template_id: null,
    created_at: NOW(),
    updated_at: NOW(),
  };
}
