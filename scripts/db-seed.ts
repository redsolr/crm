/**
 * Seeds the CRM's own Postgres with the sales-pipeline template
 * skeleton — workflows, stages, record types, attribute definitions —
 * mirroring the platform's `SALES_PIPELINE_TEMPLATE`
 * (`platform/src/modules/workspaces/workspace-templates.ts`) so the
 * untouched frontend sees identical keys/names/options on the wire.
 *
 * Idempotent: rows are matched by key and updated in place; safe to
 * re-run after template retunes. Run: `npm run db:seed` (postgres up +
 * migrations applied first).
 */

import { eq, and } from "drizzle-orm";
import {
  db,
  workflows,
  workflowStages,
  recordTypes,
  attributeDefinitions,
} from "../src/db";
import { mintId } from "../src/db/ids";

interface StageSpec {
  key: string;
  name: string;
  category: "not_started" | "active" | "done" | "dead";
  position: number;
}

interface AttributeSpec {
  key: string;
  name: string;
  dataType: string;
  required?: boolean;
  config?: unknown;
  enrichment?: unknown;
  position: number;
}

interface WorkflowSpec {
  key: string;
  name: string;
  isDefault: boolean;
  states: StageSpec[];
}

interface TypeSpec {
  key: string;
  name: string;
  workflowKey: string;
  attributes: AttributeSpec[];
}

const WORKFLOWS: WorkflowSpec[] = [
  {
    key: "pipeline",
    name: "Pipeline",
    isDefault: true,
    states: [
      { key: "identified", name: "Identified", category: "not_started", position: 0 },
      { key: "contacted", name: "Contacted", category: "not_started", position: 1 },
      { key: "replied", name: "Replied", category: "active", position: 2 },
      { key: "call_booked", name: "Call Booked", category: "active", position: 3 },
      { key: "call_done", name: "Call Done", category: "active", position: 4 },
      { key: "trial", name: "Trial", category: "active", position: 5 },
      { key: "won", name: "Won", category: "done", position: 6 },
      { key: "lost", name: "Lost", category: "dead", position: 7 },
      { key: "not_now", name: "Not Now", category: "dead", position: 8 },
    ],
  },
  {
    key: "commitment",
    name: "Commitment",
    isDefault: false,
    states: [
      { key: "open", name: "Open", category: "active", position: 0 },
      { key: "done", name: "Done", category: "done", position: 1 },
      { key: "dropped", name: "Dropped", category: "dead", position: 2 },
    ],
  },
  {
    key: "memory",
    name: "Memory",
    isDefault: false,
    states: [
      { key: "active", name: "Active", category: "active", position: 0 },
      { key: "archived", name: "Archived", category: "dead", position: 1 },
    ],
  },
  {
    key: "task",
    name: "Task",
    isDefault: false,
    states: [
      { key: "todo", name: "To Do", category: "not_started", position: 0 },
      { key: "in_progress", name: "In Progress", category: "active", position: 1 },
      { key: "in_review", name: "In Review", category: "active", position: 2 },
      { key: "done", name: "Done", category: "done", position: 3 },
      { key: "canceled", name: "Canceled", category: "dead", position: 4 },
    ],
  },
];

const TYPES: TypeSpec[] = [
  {
    key: "account",
    name: "Account",
    workflowKey: "memory",
    attributes: [
      {
        key: "source",
        name: "Source",
        dataType: "select",
        required: true,
        config: {
          options: ["cold_outreach", "intro", "inbound", "event", "referral", "partner", "other"],
        },
        position: 0,
      },
      { key: "company_url", name: "Company URL", dataType: "url", position: 1 },
      {
        key: "segment",
        name: "Segment",
        dataType: "select",
        config: {
          options: ["solo", "firm_2_5", "firm_6_10", "firm_11_20", "firm_20_plus", "in_house", "other"],
        },
        position: 2,
      },
      {
        key: "practice_area",
        name: "Practice Area",
        dataType: "select",
        config: {
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
        },
        position: 3,
      },
      {
        key: "current_tools",
        name: "Current Tools",
        dataType: "text",
        config: { maxLength: 500 },
        position: 4,
      },
      {
        key: "pain_summary",
        name: "Pain Summary",
        dataType: "text",
        config: { maxLength: 2000 },
        position: 5,
      },
      {
        key: "icp_fit",
        name: "ICP Fit",
        dataType: "select",
        config: { options: ["strong", "moderate", "weak", "unclear"] },
        enrichment: {
          prompt:
            "Rate how well this account fits our ideal-customer profile " +
            "(a Thai law firm, 2-20 lawyers, actively evaluating or " +
            "buying legal-work tooling) based on its source, segment, " +
            "practice area, current tools, and pain summary. Reply " +
            '"strong", "moderate", "weak", or "unclear" if there is not ' +
            "enough information yet.",
          refreshPolicy: "manual",
        },
        position: 6,
      },
      {
        key: "summary",
        name: "Summary",
        dataType: "text",
        config: { maxLength: 700 },
        enrichment: {
          prompt:
            "Write a 2-3 sentence brief on this account for a colleague " +
            "seeing it for the first time: who they are (segment, " +
            "practice area), where the relationship came from (source), " +
            "what tools they use today, and the pain we can solve. Base " +
            "it ONLY on the fields provided; if too little is known, say " +
            "what is missing instead of guessing.",
          refreshPolicy: "manual",
        },
        position: 7,
      },
    ],
  },
  {
    key: "contact",
    name: "Contact",
    workflowKey: "memory",
    attributes: [
      { key: "first_name", name: "First Name", dataType: "text", config: { maxLength: 80 }, position: 0 },
      { key: "last_name", name: "Last Name", dataType: "text", config: { maxLength: 80 }, position: 1 },
      { key: "role", name: "Role", dataType: "text", config: { maxLength: 120 }, position: 2 },
      { key: "email", name: "Email", dataType: "text", config: { maxLength: 200 }, position: 3 },
      { key: "linkedin_url", name: "LinkedIn URL", dataType: "url", position: 4 },
      {
        key: "decision_role",
        name: "Decision Role",
        dataType: "select",
        config: {
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
        },
        position: 5,
      },
    ],
  },
  {
    key: "opportunity",
    name: "Opportunity",
    workflowKey: "pipeline",
    attributes: [
      {
        key: "use_case",
        name: "Use Case",
        dataType: "select",
        required: true,
        config: {
          options: ["matter_chaos", "client_comms", "drafting", "research", "knowledge_management", "other"],
        },
        position: 0,
      },
      { key: "value_estimate", name: "Value Estimate (THB/yr)", dataType: "number", position: 1 },
      { key: "next_action", name: "Next Action", dataType: "text", config: { maxLength: 500 }, position: 2 },
      { key: "next_action_date", name: "Next Action Date", dataType: "date", position: 3 },
      { key: "expected_close_date", name: "Expected Close Date", dataType: "date", position: 4 },
      {
        key: "lost_reason",
        name: "Lost Reason",
        dataType: "select",
        config: {
          options: ["too_expensive", "wrong_fit", "no_decision", "competitor", "timing", "no_response", "other"],
        },
        position: 5,
      },
      { key: "not_now_until", name: "Not Now Until", dataType: "date", position: 6 },
    ],
  },
  {
    key: "call_note",
    name: "Call Note",
    workflowKey: "memory",
    attributes: [
      { key: "call_date", name: "Call Date", dataType: "date", required: true, position: 0 },
      {
        key: "outcome",
        name: "Outcome",
        dataType: "select",
        config: { options: ["positive", "neutral", "negative", "no_show", "rescheduled", "other"] },
        position: 1,
      },
      { key: "attendees", name: "Attendees", dataType: "text", config: { maxLength: 500 }, position: 2 },
      { key: "summary", name: "Summary", dataType: "text", config: { maxLength: 8000 }, position: 3 },
      {
        key: "call_type",
        name: "Call Type",
        dataType: "select",
        config: {
          options: ["in_person_demo", "paid_feedback", "intro_call", "follow_up", "pilot_checkin", "other"],
        },
        position: 4,
      },
    ],
  },
  {
    key: "commitment",
    name: "Commitment",
    workflowKey: "commitment",
    attributes: [
      { key: "due_date", name: "Due Date", dataType: "date", required: true, position: 0 },
      { key: "promised_to", name: "Promised To", dataType: "text", config: { maxLength: 200 }, position: 1 },
    ],
  },
  // Work module (org-management v1, 2026-08-06): internal task tracking
  // in the same single-tenant universe — Jira-style "spaces" are the
  // `project` select options, boards are per-project filtered views.
  {
    key: "task",
    name: "Task",
    workflowKey: "task",
    attributes: [
      {
        key: "project",
        name: "Project",
        dataType: "select",
        required: true,
        config: {
          options: ["jurisimus", "crm", "class_room", "hq", "other"],
        },
        position: 0,
      },
      {
        key: "priority",
        name: "Priority",
        dataType: "select",
        config: { options: ["urgent", "high", "medium", "low"] },
        position: 1,
      },
      { key: "due_date", name: "Due Date", dataType: "date", position: 2 },
      {
        key: "assignee",
        name: "Assignee",
        dataType: "select",
        config: { options: ["founder", "claude"] },
        position: 3,
      },
    ],
  },
];

async function upsertWorkflow(spec: WorkflowSpec): Promise<string> {
  const existing = await db.query.workflows.findFirst({
    where: eq(workflows.key, spec.key),
  });
  if (existing) {
    await db
      .update(workflows)
      .set({ name: spec.name, isDefault: spec.isDefault })
      .where(eq(workflows.id, existing.id));
    return existing.id;
  }
  const id = mintId("wf");
  await db
    .insert(workflows)
    .values({ id, key: spec.key, name: spec.name, isDefault: spec.isDefault });
  return id;
}

async function upsertStage(workflowId: string, spec: StageSpec): Promise<void> {
  const existing = await db.query.workflowStages.findFirst({
    where: and(
      eq(workflowStages.workflowId, workflowId),
      eq(workflowStages.key, spec.key),
    ),
  });
  if (existing) {
    await db
      .update(workflowStages)
      .set({ name: spec.name, category: spec.category, position: spec.position })
      .where(eq(workflowStages.id, existing.id));
    return;
  }
  await db.insert(workflowStages).values({
    id: mintId("wfs"),
    workflowId,
    key: spec.key,
    name: spec.name,
    category: spec.category,
    position: spec.position,
  });
}

async function upsertType(
  spec: TypeSpec,
  workflowIdsByKey: Map<string, string>,
): Promise<string> {
  const workflowId = workflowIdsByKey.get(spec.workflowKey);
  if (!workflowId) throw new Error(`Unknown workflow key: ${spec.workflowKey}`);
  const existing = await db.query.recordTypes.findFirst({
    where: eq(recordTypes.key, spec.key),
  });
  if (existing) {
    await db
      .update(recordTypes)
      .set({ name: spec.name, workflowId })
      .where(eq(recordTypes.id, existing.id));
    return existing.id;
  }
  const id = mintId("wit");
  await db
    .insert(recordTypes)
    .values({ id, key: spec.key, name: spec.name, workflowId });
  return id;
}

async function upsertAttribute(
  typeId: string,
  spec: AttributeSpec,
): Promise<void> {
  const existing = await db.query.attributeDefinitions.findFirst({
    where: and(
      eq(attributeDefinitions.workItemTypeId, typeId),
      eq(attributeDefinitions.key, spec.key),
    ),
  });
  const values = {
    name: spec.name,
    dataType: spec.dataType,
    required: spec.required ?? false,
    config: spec.config ?? null,
    enrichment: spec.enrichment ?? null,
    position: spec.position,
    updatedAt: new Date(),
  };
  if (existing) {
    await db
      .update(attributeDefinitions)
      .set(values)
      .where(eq(attributeDefinitions.id, existing.id));
    return;
  }
  await db.insert(attributeDefinitions).values({
    id: mintId("ad"),
    workItemTypeId: typeId,
    key: spec.key,
    ...values,
  });
}

async function main(): Promise<void> {
  const workflowIdsByKey = new Map<string, string>();
  for (const wf of WORKFLOWS) {
    const id = await upsertWorkflow(wf);
    workflowIdsByKey.set(wf.key, id);
    for (const stage of wf.states) await upsertStage(id, stage);
  }
  for (const type of TYPES) {
    const typeId = await upsertType(type, workflowIdsByKey);
    for (const attr of type.attributes) await upsertAttribute(typeId, attr);
  }
  console.log(
    `Seeded ${WORKFLOWS.length} workflows, ${TYPES.length} record types.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[db-seed] failed:", err);
    process.exit(1);
  });
