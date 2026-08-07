import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { db, records, recordTypes, workflowStages } from "@/db";
import { logActivity } from "./activities";
import { broadcastInvalidate } from "./realtime";
import {
  listDefinitionsForType,
  listValuesForItem,
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
 * The sales agent tools, rewired from the platform's workspace loop
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

/** Which agent is writing — threaded from the door (Ask loop passes
 *  the GPT assistant, /mcp passes Claude) so attribution names the
 *  actual actor. */
export interface AgentActor {
  id: string;
  name: string;
}

export interface AskTool {
  definition: AskToolDefinition;
  execute(
    input: Record<string, unknown>,
    agent: AgentActor,
  ): Promise<AskToolResult>;
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

async function createSalesRecord(
  input: {
    title: string;
    typeKey: SalesRecordTypeKey;
    stateKey: string;
    parentId?: string;
  },
  agent: AgentActor,
): Promise<{ created: JoinedWorkItem; typeId: string } | { error: string }> {
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
    createdBy: { id: agent.id, name: agent.name },
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
    actor: { id: agent.id, type: "agent", name: agent.name },
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
export const APP_TIME_ZONE = "Asia/Bangkok";

export function todayInAppTimeZone(): string {
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
  async execute(input, agent) {
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
  async execute(input, agent) {
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
      }, agent);
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
  async execute(input, agent) {
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
      }, agent);
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
  async execute(input, agent) {
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
          actor: { id: agent.id, type: "agent", name: agent.name },
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
  async execute(input, agent) {
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
      }, agent);
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
  async execute(input, agent) {
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
      }, agent);
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

const COMMITMENT_STATUSES = ["open", "done", "dropped"] as const;
type CommitmentStatus = (typeof COMMITMENT_STATUSES)[number];

const listCommitments: AskTool = {
  definition: {
    name: "list_commitments",
    description:
      "List commitments (promises tracked in the Inbox) with status, due date, and the record they belong to. Use it to review what's open ('what's on my plate'), find overdue promises, or poll for delegated work by title prefix. Returns id, title, status, due_date, promised_to, and parent for each row, soonest due first.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [...COMMITMENT_STATUSES, "all"],
          description: "Filter by commitment status. Defaults to open.",
        },
        query: {
          type: "string",
          description:
            "Optional title substring filter (e.g. a delegation prefix like 'Claude:').",
        },
        due_before: {
          type: "string",
          description:
            "Optional YYYY-MM-DD — only commitments due on or before this date (rows without a due date are excluded).",
        },
        limit: {
          type: "number",
          description: "Maximum rows to return. Default 20, max 50.",
        },
      },
      required: [],
    },
  },
  async execute(input) {
    const status: CommitmentStatus | "all" =
      typeof input.status === "string" &&
      ([...COMMITMENT_STATUSES, "all"] as readonly string[]).includes(
        input.status,
      )
        ? (input.status as CommitmentStatus | "all")
        : "open";
    const query = typeof input.query === "string" ? input.query.trim() : "";
    const dueBefore =
      typeof input.due_before === "string" ? input.due_before.trim() : "";
    const limit =
      typeof input.limit === "number" && Number.isFinite(input.limit)
        ? Math.min(Math.max(Math.trunc(input.limit), 1), 50)
        : 20;
    try {
      const commitmentType = await findTypeByKey("commitment");
      if (commitmentType === null) {
        return {
          content:
            "This CRM has no commitment record type — the pipeline template is not seeded.",
          isError: true,
        };
      }
      const filters = [eq(recordTypes.key, "commitment")];
      if (status !== "all") filters.push(eq(workflowStages.key, status));
      if (query !== "") {
        filters.push(ilike(records.title, `%${escapeLikePattern(query)}%`));
      }
      const rows = await db
        .select({
          id: records.id,
          identifier: records.identifier,
          title: records.title,
          parentId: records.parentId,
          stateKey: workflowStages.key,
        })
        .from(records)
        .innerJoin(recordTypes, eq(records.typeId, recordTypes.id))
        .innerJoin(workflowStages, eq(records.stateId, workflowStages.id))
        .where(and(...filters))
        .orderBy(desc(records.updatedAt))
        .limit(limit);
      if (rows.length === 0) {
        return { content: "No commitments match those filters." };
      }

      const definitions = await listDefinitionsForType(commitmentType.id);
      const keyByDefinitionId = new Map(definitions.map((d) => [d.id, d.key]));
      const parentIds = [
        ...new Set(rows.map((r) => r.parentId).filter((p): p is string => p !== null)),
      ];
      const parents =
        parentIds.length > 0
          ? await db
              .select({ id: records.id, title: records.title })
              .from(records)
              .where(inArray(records.id, parentIds))
          : [];
      const parentById = new Map(parents.map((p) => [p.id, p.title]));

      const out = [];
      for (const row of rows) {
        const values = await listValuesForItem(row.id);
        const attrs: Record<string, unknown> = {};
        for (const v of values) {
          const key = keyByDefinitionId.get(v.definitionId);
          if (key !== undefined) attrs[key] = v.value;
        }
        const dueDate = typeof attrs.due_date === "string" ? attrs.due_date : null;
        if (dueBefore !== "" && (dueDate === null || dueDate > dueBefore)) {
          continue;
        }
        out.push({
          id: row.id,
          identifier: row.identifier,
          title: row.title,
          status: row.stateKey,
          due_date: dueDate,
          promised_to:
            typeof attrs.promised_to === "string" ? attrs.promised_to : null,
          parent:
            row.parentId !== null
              ? { id: row.parentId, title: parentById.get(row.parentId) ?? null }
              : null,
        });
      }
      if (out.length === 0) {
        return { content: "No commitments match those filters." };
      }
      out.sort((a, b) => {
        if (a.due_date === null) return b.due_date === null ? 0 : 1;
        if (b.due_date === null) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
      return { content: JSON.stringify(out) };
    } catch (err) {
      console.error("[ask-tools] list_commitments failed:", err);
      return { content: "Could not list commitments — try again.", isError: true };
    }
  },
};

const completeCommitment: AskTool = {
  definition: {
    name: "complete_commitment",
    description:
      "Mark a commitment done (default) or dropped — the promise leaves the open Inbox. Resolve the commitment id with list_commitments or find_crm_record first. Optionally record a short completion note on the activity timeline.",
    input_schema: {
      type: "object",
      properties: {
        commitment_id: {
          type: "string",
          description: "The commitment record id from list_commitments or find_crm_record.",
        },
        status: {
          type: "string",
          enum: ["done", "dropped"],
          description: "Target status. Defaults to done.",
        },
        note: {
          type: "string",
          description:
            "Optional short note on how it was completed (or why dropped), recorded in the activity timeline.",
        },
      },
      required: ["commitment_id"],
    },
  },
  async execute(input, agent) {
    const commitmentRef =
      typeof input.commitment_id === "string" ? input.commitment_id.trim() : "";
    if (commitmentRef === "") {
      return {
        content:
          "commitment_id is required — resolve it with list_commitments or find_crm_record first.",
        isError: true,
      };
    }
    const target: CommitmentStatus =
      input.status === "dropped" ? "dropped" : "done";
    try {
      const commitment = (
        await findSalesRecords(commitmentRef, ["commitment"], 1)
      ).at(0);
      if (commitment === undefined) {
        return {
          content: `No commitment matches "${commitmentRef}". Call list_commitments or find_crm_record to resolve it first.`,
          isError: true,
        };
      }
      if (commitment.stateKey === target) {
        return {
          content: `Commitment "${commitment.title}" is already ${target}.`,
        };
      }
      const commitmentType = await findTypeByKey("commitment");
      if (commitmentType === null) {
        return {
          content:
            "This CRM has no commitment record type — the pipeline template is not seeded.",
          isError: true,
        };
      }
      const stageRow = await resolveStage(commitmentType, target);
      if (stageRow === null) {
        return {
          content: `The commitment workflow has no "${target}" state — check the pipeline template.`,
          isError: true,
        };
      }
      await db
        .update(records)
        .set({ stateId: stageRow.id, updatedAt: new Date() })
        .where(eq(records.id, commitment.id));
      broadcastInvalidate("records");
      const note = typeof input.note === "string" ? input.note.trim() : "";
      await logActivity({
        type: "work_item_status_changed",
        entityId: commitment.id,
        entityIdentifier: commitment.identifier,
        changes: { state_key: { from: commitment.stateKey, to: target } },
        metadata: { via: "ask_agent", ...(note !== "" ? { note } : {}) },
        actor: { id: agent.id, type: "agent", name: agent.name },
      });
      return {
        content: `Marked commitment "${commitment.title}" ${target}.${note !== "" ? ` Note recorded: ${note}` : ""}`,
      };
    } catch (err) {
      console.error(
        `[ask-tools] complete_commitment failed ("${commitmentRef}"):`,
        err,
      );
      return {
        content: `Could not update the commitment: ${errMessage(err)}`,
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
  listCommitments,
  completeCommitment,
];

export const ASK_TOOLS_BY_NAME = new Map(
  ASK_TOOLS.map((t) => [t.definition.name, t]),
);
