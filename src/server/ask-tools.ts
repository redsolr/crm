import { and, eq, ilike, inArray } from "drizzle-orm";
import { db, records, recordTypes, workflowStages } from "@/db";
import { logActivity } from "./activities";
import { AGENT_ACTOR_ID, AGENT_ACTOR_NAME } from "./constants";
import { broadcastInvalidate } from "./realtime";
import {
  listDefinitionsForType,
  upsertValue,
  validateBareValue,
} from "./attributes";
import {
  findTypeByKey,
  insertWorkItem,
  resolveStage,
  type JoinedWorkItem,
} from "./work-items";

/**
 * The 5 sales agent tools, rewired from the platform's workspace loop
 * to the CRM's own Postgres (backend-swap: Ask chat). Definitions,
 * required/optional splits, self-correction error messages, and the
 * CONTINUE-THROUGH attribute-write semantics mirror
 * `platform/src/modules/sales/tools/` — the strangler keeps the agent
 * behavior the founder already knows. Module-key gating is dropped:
 * standalone, the sales module is unconditionally on.
 */

export const SALES_RECORD_TYPE_KEYS = [
  "account",
  "contact",
  "opportunity",
  "call_note",
  "commitment",
] as const;

type SalesRecordTypeKey = (typeof SALES_RECORD_TYPE_KEYS)[number];

export interface AskToolResult {
  content: string;
  isError?: boolean;
}

/** JSON-schema tool definition in the Messages API wire shape. */
export interface AskToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface AskTool {
  definition: AskToolDefinition;
  execute(input: Record<string, unknown>): Promise<AskToolResult>;
}

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------

interface SalesRecordRow {
  id: string;
  identifier: string;
  title: string;
  typeKey: string;
  stateKey: string;
}

/** Escape LIKE wildcards so a user-typed query matches literally. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Find sales records by title substring (or exact `wi_…` id) and type.
 * Local IDs are already in the prefixed wire form, so an id ref matches
 * `records.id` directly.
 */
async function findSalesRecords(
  query: string,
  typeKeys: readonly SalesRecordTypeKey[],
  limit = 10,
): Promise<SalesRecordRow[]> {
  const trimmed = query.trim();
  const isIdRef = trimmed.startsWith("wi_") && !/\s/.test(trimmed);
  return db
    .select({
      id: records.id,
      identifier: records.identifier,
      title: records.title,
      typeKey: recordTypes.key,
      stateKey: workflowStages.key,
    })
    .from(records)
    .innerJoin(recordTypes, eq(records.typeId, recordTypes.id))
    .innerJoin(workflowStages, eq(records.stateId, workflowStages.id))
    .where(
      and(
        inArray(recordTypes.key, [...typeKeys]),
        isIdRef
          ? eq(records.id, trimmed)
          : ilike(records.title, `%${escapeLikePattern(trimmed)}%`),
      ),
    )
    .limit(limit);
}

async function loadWorkflowStateKeys(workflowId: string): Promise<string[]> {
  const rows = await db
    .select({ key: workflowStages.key, position: workflowStages.position })
    .from(workflowStages)
    .where(eq(workflowStages.workflowId, workflowId))
    .orderBy(workflowStages.position);
  return rows.map((r) => r.key);
}

/**
 * Write attribute values through the same validation the human PUT
 * uses. CONTINUE-THROUGH: every valid value lands even when another is
 * rejected; the errors are returned so the model can relay honestly.
 */
async function applyAttributeValues(
  workItemId: string,
  workItemTypeId: string,
  attrs: Record<string, unknown>,
): Promise<string[]> {
  const provided = Object.entries(attrs).filter(([, v]) => v !== undefined);
  if (provided.length === 0) return [];
  const definitions = await listDefinitionsForType(workItemTypeId);
  const byKey = new Map(definitions.map((d) => [d.key, d]));
  const errors: string[] = [];
  for (const [key, value] of provided) {
    const definition = byKey.get(key);
    if (!definition) {
      errors.push(`Unknown attribute "${key}" for this record type.`);
      continue;
    }
    const validationError = validateBareValue(definition, value);
    if (validationError !== null) {
      errors.push(`Could not set ${key}: ${validationError}`);
      continue;
    }
    await upsertValue(workItemId, definition.id, value);
  }
  return errors;
}

function attrNote(errors: string[]): string {
  return errors.length > 0
    ? ` Some attributes were NOT set — tell the user: ${errors.join(" ")}`
    : "";
}

async function createSalesRecord(input: {
  title: string;
  typeKey: SalesRecordTypeKey;
  stateKey: string;
  parentId?: string;
}): Promise<{ created: JoinedWorkItem; typeId: string } | { error: string }> {
  const type = await findTypeByKey(input.typeKey);
  if (type === null) {
    return {
      error: `This CRM has no "${input.typeKey}" record type — the pipeline template is not seeded.`,
    };
  }
  const stage = await resolveStage(type, input.stateKey);
  if (stage === null) {
    const stageKeys = await loadWorkflowStateKeys(type.workflowId);
    return {
      error: `Invalid stage "${input.stateKey}" — this pipeline's stages: ${stageKeys.join(", ")}.`,
    };
  }
  const created = await insertWorkItem({
    createdBy: { id: AGENT_ACTOR_ID, name: AGENT_ACTOR_NAME },
    body: {
      title: input.title,
      type_key: input.typeKey,
      state_key: input.stateKey,
      parent_id: input.parentId,
    },
    type,
    stage,
  });
  await logActivity({
    type: "work_item_created",
    entityId: created.record.id,
    entityIdentifier: created.record.identifier,
    metadata: { title: created.record.title, via: "ask_agent" },
    actor: { id: AGENT_ACTOR_ID, type: "agent", name: AGENT_ACTOR_NAME },
  });
  return { created, typeId: type.id };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "unknown error";
}

/**
 * Server-side "today" runs on UTC hosts (Vercel), but the team logging
 * calls works on Bangkok wall clocks — `toISOString()` would stamp
 * yesterday's date for the first seven hours of every day. Defaults
 * derive from the app timezone instead.
 */
const APP_TIME_ZONE = "Asia/Bangkok";

function todayInAppTimeZone(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
  }).format(new Date());
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const findCrmRecord: AskTool = {
  definition: {
    name: "find_crm_record",
    description:
      "Find CRM records (accounts, contacts, opportunities, call notes, commitments) by name or id. Call this FIRST to resolve a company or deal the user mentioned into a record id before creating or updating anything. Returns id, title, type, and pipeline stage for each match.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Name (or part of it) to search for, or an exact record id from a previous result.",
        },
        record_type: {
          type: "string",
          enum: [...SALES_RECORD_TYPE_KEYS],
          description:
            "Optional: restrict to one record type. Omit to search all types.",
        },
      },
      required: ["query"],
    },
  },
  async execute(input) {
    const query = typeof input.query === "string" ? input.query.trim() : "";
    if (query === "") {
      return { content: "A non-empty query is required.", isError: true };
    }
    const requestedType =
      typeof input.record_type === "string" &&
      (SALES_RECORD_TYPE_KEYS as readonly string[]).includes(input.record_type)
        ? (input.record_type as SalesRecordTypeKey)
        : null;
    try {
      const rows = await findSalesRecords(
        query,
        requestedType !== null ? [requestedType] : SALES_RECORD_TYPE_KEYS,
      );
      if (rows.length === 0) {
        return {
          content: `No CRM records match "${query}"${requestedType !== null ? ` (type ${requestedType})` : ""}. The record may not exist yet — ask the user, or create it if they asked for that.`,
        };
      }
      const compact = rows.map((r) => ({
        id: r.id,
        identifier: r.identifier,
        title: r.title,
        type: r.typeKey,
        stage: r.stateKey,
      }));
      return { content: JSON.stringify(compact) };
    } catch (err) {
      console.error(`[ask-tools] find_crm_record failed for "${query}":`, err);
      return { content: "Could not search CRM records — try again.", isError: true };
    }
  },
};

const createAccount: AskTool = {
  definition: {
    name: "create_account",
    description:
      "Create a new account (company / firm record) in this CRM. Call find_crm_record first — if the account already exists, do NOT create a duplicate. `source` is required by the pipeline template (typical options: cold_outreach, intro, inbound, event, referral, partner, other — the template config is authoritative).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Company / firm name (the record title)." },
        source: { type: "string", description: "Where the account came from (template select)." },
        segment: { type: "string", description: "Optional firm-size segment (template select)." },
        practice_area: { type: "string", description: "Optional practice area (template select)." },
        company_url: { type: "string", description: "Optional company website URL (http/https)." },
        pain_summary: {
          type: "string",
          description: "Optional summary of the pain we can solve for them.",
        },
      },
      required: ["name", "source"],
    },
  },
  async execute(input) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (name === "") {
      return { content: "A non-empty account name is required.", isError: true };
    }
    try {
      const existing = await findSalesRecords(name, ["account"], 3);
      const exact = existing.find(
        (r) => r.title.toLowerCase() === name.toLowerCase(),
      );
      if (exact) {
        return {
          content: `An account named "${exact.title}" already exists (id ${exact.id}) — use it instead of creating a duplicate.`,
          isError: true,
        };
      }
      const result = await createSalesRecord({
        title: name,
        typeKey: "account",
        stateKey: "active",
      });
      if ("error" in result) return { content: result.error, isError: true };
      const attrErrors = await applyAttributeValues(
        result.created.record.id,
        result.typeId,
        {
          source: input.source,
          segment: input.segment,
          practice_area: input.practice_area,
          company_url: input.company_url,
          pain_summary: input.pain_summary,
        },
      );
      return {
        content:
          `Created account "${name}" (id ${result.created.record.id}).${attrNote(attrErrors)} ` +
          "Note: this is only the company record — if the user also asked for a deal, call create_opportunity with this account id; a deal is NOT created automatically.",
      };
    } catch (err) {
      console.error(`[ask-tools] create_account failed for "${name}":`, err);
      return {
        content: `Could not create the account: ${errMessage(err)}`,
        isError: true,
      };
    }
  },
};

const createOpportunity: AskTool = {
  definition: {
    name: "create_opportunity",
    description:
      "Create a new opportunity (pipeline deal) under an existing account. Resolve the account with find_crm_record first (create_account if the firm is new). Only account_id and use_case are required (`use_case` typical options: matter_chaos, client_comms, drafting, research, knowledge_management, other). Everything else is optional — do NOT ask the user for stage, value, or dates they did not mention; create the deal with what you have. Stage defaults to the first pipeline stage when omitted.",
    input_schema: {
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "The account (company) record id from find_crm_record or create_account.",
        },
        use_case: {
          type: "string",
          description: "Which wedge pain the deal hangs on (template select).",
        },
        title: {
          type: "string",
          description: "Optional deal title. Defaults to the account name + use case.",
        },
        stage: {
          type: "string",
          description:
            "Optional pipeline stage key (e.g. identified, contacted, replied, call_booked, call_done, trial, won, lost, not_now — the pipeline is authoritative).",
        },
        value_estimate: { type: "number", description: "Optional estimated value (THB/yr)." },
        next_action: { type: "string", description: "Optional next action to move the deal forward." },
        next_action_date: { type: "string", description: "Optional next action date, YYYY-MM-DD." },
        expected_close_date: { type: "string", description: "Optional expected close date, YYYY-MM-DD." },
      },
      required: ["account_id", "use_case"],
    },
  },
  async execute(input) {
    const accountRef =
      typeof input.account_id === "string" ? input.account_id.trim() : "";
    if (accountRef === "") {
      return {
        content: "account_id is required — resolve it with find_crm_record first.",
        isError: true,
      };
    }
    try {
      const account = (await findSalesRecords(accountRef, ["account"], 1)).at(0);
      if (account === undefined) {
        return {
          content: `No account matches "${accountRef}". Call find_crm_record to resolve the company, or create_account if it is new.`,
          isError: true,
        };
      }
      const opportunityType = await findTypeByKey("opportunity");
      if (opportunityType === null) {
        return {
          content: "This CRM has no opportunity record type — the pipeline template is not seeded.",
          isError: true,
        };
      }
      const stageKeys = await loadWorkflowStateKeys(opportunityType.workflowId);
      const stage =
        typeof input.stage === "string" && input.stage.trim() !== ""
          ? input.stage.trim()
          : stageKeys.at(0);
      if (stage === undefined || !stageKeys.includes(stage)) {
        return {
          content: `Invalid stage "${String(input.stage)}" — this pipeline's stages: ${stageKeys.join(", ")}.`,
          isError: true,
        };
      }
      const useCase =
        typeof input.use_case === "string" ? input.use_case.trim() : "";
      const title =
        typeof input.title === "string" && input.title.trim() !== ""
          ? input.title.trim()
          : `${account.title} — ${useCase}`;
      const result = await createSalesRecord({
        title,
        typeKey: "opportunity",
        stateKey: stage,
        parentId: account.id,
      });
      if ("error" in result) return { content: result.error, isError: true };
      const attrErrors = await applyAttributeValues(
        result.created.record.id,
        result.typeId,
        {
          use_case: useCase,
          value_estimate: input.value_estimate,
          next_action: input.next_action,
          next_action_date: input.next_action_date,
          expected_close_date: input.expected_close_date,
        },
      );
      return {
        content: `Created opportunity "${title}" (id ${result.created.record.id}) in stage ${stage} under account "${account.title}".${attrNote(attrErrors)}`,
      };
    } catch (err) {
      console.error(
        `[ask-tools] create_opportunity failed (account ref "${accountRef}"):`,
        err,
      );
      return {
        content: `Could not create the opportunity: ${errMessage(err)}`,
        isError: true,
      };
    }
  },
};

const updateOpportunity: AskTool = {
  definition: {
    name: "update_opportunity",
    description:
      "Update an existing opportunity: move its pipeline stage and/or set attributes (value estimate, next action + date, expected close date, lost reason, not-now-until). Resolve the opportunity id with find_crm_record first. Only pass the fields being changed.",
    input_schema: {
      type: "object",
      properties: {
        opportunity_id: {
          type: "string",
          description: "The opportunity record id from find_crm_record.",
        },
        stage: {
          type: "string",
          description:
            "Optional new pipeline stage key (the pipeline is authoritative; typical keys: identified, contacted, replied, call_booked, call_done, trial, won, lost, not_now).",
        },
        value_estimate: { type: "number", description: "Optional new estimated value (THB/yr)." },
        next_action: { type: "string", description: "Optional new next action." },
        next_action_date: { type: "string", description: "Optional next action date, YYYY-MM-DD." },
        expected_close_date: { type: "string", description: "Optional expected close date, YYYY-MM-DD." },
        lost_reason: {
          type: "string",
          description: "Why the deal was lost (template select) — set when moving to the lost stage.",
        },
        not_now_until: {
          type: "string",
          description: "Optional revisit date (YYYY-MM-DD) — set when moving to not_now.",
        },
      },
      required: ["opportunity_id"],
    },
  },
  async execute(input) {
    const opportunityRef =
      typeof input.opportunity_id === "string" ? input.opportunity_id.trim() : "";
    if (opportunityRef === "") {
      return {
        content: "opportunity_id is required — resolve it with find_crm_record first.",
        isError: true,
      };
    }
    try {
      const opportunity = (
        await findSalesRecords(opportunityRef, ["opportunity"], 1)
      ).at(0);
      if (opportunity === undefined) {
        return {
          content: `No opportunity matches "${opportunityRef}". Call find_crm_record to resolve the deal first.`,
          isError: true,
        };
      }
      const opportunityType = await findTypeByKey("opportunity");
      if (opportunityType === null) {
        return {
          content: "This CRM has no opportunity record type — the pipeline template is not seeded.",
          isError: true,
        };
      }

      const changes: string[] = [];
      const stage =
        typeof input.stage === "string" && input.stage.trim() !== ""
          ? input.stage.trim()
          : null;
      if (stage !== null) {
        const stageKeys = await loadWorkflowStateKeys(opportunityType.workflowId);
        if (!stageKeys.includes(stage)) {
          return {
            content: `Invalid stage "${stage}" — this pipeline's stages: ${stageKeys.join(", ")}.`,
            isError: true,
          };
        }
        const stageRow = await resolveStage(opportunityType, stage);
        if (stageRow === null) {
          return { content: `Stage "${stage}" vanished mid-update — try again.`, isError: true };
        }
        await db
          .update(records)
          .set({ stateId: stageRow.id, updatedAt: new Date() })
          .where(eq(records.id, opportunity.id));
        broadcastInvalidate("records");
        await logActivity({
          type: "work_item_status_changed",
          entityId: opportunity.id,
          entityIdentifier: opportunity.identifier,
          changes: { state_key: { from: opportunity.stateKey, to: stage } },
          metadata: { via: "ask_agent" },
          actor: { id: AGENT_ACTOR_ID, type: "agent", name: AGENT_ACTOR_NAME },
        });
        changes.push(`stage → ${stage}`);
      }

      const attrs: Record<string, unknown> = {
        value_estimate: input.value_estimate,
        next_action: input.next_action,
        next_action_date: input.next_action_date,
        expected_close_date: input.expected_close_date,
        lost_reason: input.lost_reason,
        not_now_until: input.not_now_until,
      };
      const providedAttrKeys = Object.keys(attrs).filter(
        (k) => attrs[k] !== undefined,
      );
      const attrErrors = await applyAttributeValues(
        opportunity.id,
        opportunityType.id,
        attrs,
      );
      const landedCount = providedAttrKeys.length - attrErrors.length;
      if (landedCount > 0) changes.push(`${landedCount} attribute(s) set`);

      if (changes.length === 0) {
        return {
          content:
            attrErrors.length > 0
              ? `Nothing was updated on "${opportunity.title}": ${attrErrors.join(" ")}`
              : "Nothing to update — pass a stage and/or at least one attribute.",
          isError: true,
        };
      }
      return {
        content: `Updated opportunity "${opportunity.title}": ${changes.join(", ")}.${attrNote(attrErrors)}`,
      };
    } catch (err) {
      console.error(
        `[ask-tools] update_opportunity failed ("${opportunityRef}"):`,
        err,
      );
      return {
        content: `Could not update the opportunity: ${errMessage(err)}`,
        isError: true,
      };
    }
  },
};

const logCallNote: AskTool = {
  definition: {
    name: "log_call_note",
    description:
      "Log a call note under an opportunity (preferred) or account. Resolve the record with find_crm_record first. Include what was discussed in `summary`; call_date defaults to today. Typical outcome options: positive, neutral, negative, no_show, rescheduled, other; typical call_type options: in_person_demo, paid_feedback, intro_call, follow_up, pilot_checkin, other (template config is authoritative).",
    input_schema: {
      type: "object",
      properties: {
        record_id: {
          type: "string",
          description: "The opportunity or account record id the call was about.",
        },
        summary: { type: "string", description: "What was discussed / decided on the call." },
        call_date: { type: "string", description: "Call date, YYYY-MM-DD. Defaults to today." },
        outcome: { type: "string", description: "Optional call outcome (template select)." },
        call_type: { type: "string", description: "Optional call type (template select)." },
        attendees: { type: "string", description: "Optional attendee list, free text." },
      },
      required: ["record_id", "summary"],
    },
  },
  async execute(input) {
    const recordRef =
      typeof input.record_id === "string" ? input.record_id.trim() : "";
    const summary =
      typeof input.summary === "string" ? input.summary.trim() : "";
    if (recordRef === "" || summary === "") {
      return {
        content:
          "record_id and a non-empty summary are required — resolve the record with find_crm_record first.",
        isError: true,
      };
    }
    try {
      const parent = (
        await findSalesRecords(recordRef, ["opportunity", "account"], 1)
      ).at(0);
      if (parent === undefined) {
        return {
          content: `No opportunity or account matches "${recordRef}". Call find_crm_record to resolve it first.`,
          isError: true,
        };
      }
      const callDate =
        typeof input.call_date === "string" && input.call_date.trim() !== ""
          ? input.call_date.trim()
          : todayInAppTimeZone();
      const result = await createSalesRecord({
        title: `Call — ${parent.title} (${callDate})`,
        typeKey: "call_note",
        stateKey: "active",
        parentId: parent.id,
      });
      if ("error" in result) return { content: result.error, isError: true };
      const attrErrors = await applyAttributeValues(
        result.created.record.id,
        result.typeId,
        {
          call_date: callDate,
          summary,
          outcome: input.outcome,
          call_type: input.call_type,
          attendees: input.attendees,
        },
      );
      return {
        content: `Logged a call note under "${parent.title}" (${callDate}, id ${result.created.record.id}).${attrNote(attrErrors)}`,
      };
    } catch (err) {
      console.error(`[ask-tools] log_call_note failed ("${recordRef}"):`, err);
      return {
        content: `Could not log the call note: ${errMessage(err)}`,
        isError: true,
      };
    }
  },
};

const createCommitment: AskTool = {
  definition: {
    name: "create_commitment",
    description:
      "Record a commitment (a promise made to a firm — 'send the proposal by Friday') under an opportunity (preferred) or account. Resolve the record with find_crm_record first. Commitments land in the Inbox and are ranked by due date, so due_date is required — infer it from the conversation ('by Friday' → that date) rather than asking, and default to a week out only when nothing was said.",
    input_schema: {
      type: "object",
      properties: {
        record_id: {
          type: "string",
          description: "The opportunity or account record id the promise belongs to.",
        },
        title: {
          type: "string",
          description: "The promise itself, e.g. 'Send pilot proposal + pricing PDF'.",
        },
        due_date: { type: "string", description: "When it was promised for, YYYY-MM-DD." },
        promised_to: {
          type: "string",
          description: "Optional: who the promise was made to, free text.",
        },
      },
      required: ["record_id", "title", "due_date"],
    },
  },
  async execute(input) {
    const recordRef =
      typeof input.record_id === "string" ? input.record_id.trim() : "";
    const title = typeof input.title === "string" ? input.title.trim() : "";
    const dueDate =
      typeof input.due_date === "string" ? input.due_date.trim() : "";
    if (recordRef === "" || title === "" || dueDate === "") {
      return {
        content:
          "record_id, a non-empty title, and due_date are required — resolve the record with find_crm_record first.",
        isError: true,
      };
    }
    try {
      const parent = (
        await findSalesRecords(recordRef, ["opportunity", "account"], 1)
      ).at(0);
      if (parent === undefined) {
        return {
          content: `No opportunity or account matches "${recordRef}". Call find_crm_record to resolve it first.`,
          isError: true,
        };
      }
      const result = await createSalesRecord({
        title,
        typeKey: "commitment",
        stateKey: "open",
        parentId: parent.id,
      });
      if ("error" in result) return { content: result.error, isError: true };
      const attrErrors = await applyAttributeValues(
        result.created.record.id,
        result.typeId,
        {
          due_date: dueDate,
          promised_to: input.promised_to,
        },
      );
      return {
        content: `Recorded commitment "${title}" under "${parent.title}" (due ${dueDate}, id ${result.created.record.id}).${attrNote(attrErrors)}`,
      };
    } catch (err) {
      console.error(`[ask-tools] create_commitment failed ("${recordRef}"):`, err);
      return {
        content: `Could not record the commitment: ${errMessage(err)}`,
        isError: true,
      };
    }
  },
};

export const ASK_TOOLS: AskTool[] = [
  findCrmRecord,
  createAccount,
  createOpportunity,
  updateOpportunity,
  logCallNote,
  createCommitment,
];

export const ASK_TOOLS_BY_NAME = new Map(
  ASK_TOOLS.map((t) => [t.definition.name, t]),
);
