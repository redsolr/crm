"use client";

/**
 * `legalPlaybooksApi` — the firm's codified standards (Legora "Playbooks").
 * Workspace-level CRUD plus the check
 * (`POST /api/legal/matters/:id/check_playbook`) that runs a matter document
 * against a playbook: each rule comes back compliant / deviation / missing /
 * not_applicable / unclear, every deviation anchored to a VERBATIM document
 * excerpt. The sibling of cite-check with the grounding source swapped — law
 * corpus → the firm's own rules. Workspace context as `Jurisimus-Workspace-Id`.
 *
 * Platform module: `platform/src/modules/legal/` (`LegalPlaybooksService` +
 * `LegalPlaybookCheckService`).
 */
import { z } from "zod";
import { BaseApiClient } from "../api-client";
import { freshIdempotencyKey } from "../idempotency";

export const PLAYBOOK_RULE_KINDS = [
  "required_clause",
  "forbidden_clause",
  "standard_clause",
] as const;
export const PLAYBOOK_RULE_SEVERITIES = [
  "critical",
  "warning",
  "info",
] as const;

const PlaybookSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  doc_type: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Playbook = z.infer<typeof PlaybookSchema>;

const PlaybookRuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  rule_kind: z.enum(PLAYBOOK_RULE_KINDS),
  instruction: z.string(),
  standard_text: z.string(),
  severity: z.enum(PLAYBOOK_RULE_SEVERITIES),
  position: z.number(),
});
export type PlaybookRule = z.infer<typeof PlaybookRuleSchema>;

const PlaybookListSchema = z.object({ playbooks: z.array(PlaybookSchema) });
const PlaybookEnvelopeSchema = z.object({ playbook: PlaybookSchema });
const PlaybookRuleEnvelopeSchema = z.object({ rule: PlaybookRuleSchema });
const PlaybookDetailSchema = z.object({
  playbook: PlaybookSchema,
  rules: z.array(PlaybookRuleSchema),
});
export type PlaybookDetail = z.infer<typeof PlaybookDetailSchema>;

const PLAYBOOK_RULE_STATUSES = [
  "compliant",
  "deviation",
  "missing",
  "not_applicable",
  "unclear",
] as const;

const CheckedRuleSchema = z.object({
  rule_id: z.string(),
  rule_title: z.string(),
  rule_kind: z.enum(PLAYBOOK_RULE_KINDS),
  severity: z.enum(PLAYBOOK_RULE_SEVERITIES),
  standard_text: z.string(),
  status: z.enum(PLAYBOOK_RULE_STATUSES),
  excerpt: z.string().nullable(),
  explanation: z.string(),
});
export type CheckedRule = z.infer<typeof CheckedRuleSchema>;

const PlaybookCheckResultSchema = z.object({
  playbook: PlaybookSchema,
  results: z.array(CheckedRuleSchema),
  summary: z.object({
    total: z.number(),
    compliant: z.number(),
    deviations: z.number(),
    missing: z.number(),
    not_applicable: z.number(),
    unclear: z.number(),
  }),
});
export type PlaybookCheckResult = z.infer<typeof PlaybookCheckResultSchema>;

export interface CreateRuleInput {
  title: string;
  rule_kind?: (typeof PLAYBOOK_RULE_KINDS)[number];
  instruction: string;
  standard_text?: string;
  severity?: (typeof PLAYBOOK_RULE_SEVERITIES)[number];
}

class LegalPlaybooksApiClient extends BaseApiClient {
  async list(workspaceId: string): Promise<Playbook[]> {
    const res = await this.request<unknown>(`/legal/playbooks`, {
      method: "GET",
      headers: { "Jurisimus-Workspace-Id": workspaceId },
    });
    return PlaybookListSchema.parse(res).playbooks;
  }

  async get(playbookId: string, workspaceId: string): Promise<PlaybookDetail> {
    const res = await this.request<unknown>(
      `/legal/playbooks/${encodeURIComponent(playbookId)}`,
      { method: "GET", headers: { "Jurisimus-Workspace-Id": workspaceId } },
    );
    return PlaybookDetailSchema.parse(res);
  }

  async create(
    name: string,
    workspaceId: string,
    opts?: { description?: string; doc_type?: string },
  ): Promise<Playbook> {
    const res = await this.request<unknown>(`/legal/playbooks`, {
      method: "POST",
      body: JSON.stringify({ name, ...opts }),
      headers: {
        "Jurisimus-Workspace-Id": workspaceId,
        "Idempotency-Key": freshIdempotencyKey(),
      },
    });
    return PlaybookEnvelopeSchema.parse(res).playbook;
  }

  async remove(playbookId: string, workspaceId: string): Promise<void> {
    await this.request<unknown>(
      `/legal/playbooks/${encodeURIComponent(playbookId)}`,
      {
        method: "DELETE",
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
  }

  async addRule(
    playbookId: string,
    rule: CreateRuleInput,
    workspaceId: string,
  ): Promise<PlaybookRule> {
    const res = await this.request<unknown>(
      `/legal/playbooks/${encodeURIComponent(playbookId)}/rules`,
      {
        method: "POST",
        body: JSON.stringify(rule),
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return PlaybookRuleEnvelopeSchema.parse(res).rule;
  }

  async removeRule(
    playbookId: string,
    ruleId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.request<unknown>(
      `/legal/playbooks/${encodeURIComponent(playbookId)}/rules/${encodeURIComponent(ruleId)}`,
      {
        method: "DELETE",
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
  }

  /** Check an ingested document (page `pg_…`) against `playbookId`. */
  async check(
    matterId: string,
    pageId: string,
    playbookId: string,
    workspaceId: string,
  ): Promise<PlaybookCheckResult> {
    const res = await this.request<unknown>(
      `/legal/matters/${encodeURIComponent(matterId)}/check_playbook`,
      {
        method: "POST",
        body: JSON.stringify({ page_id: pageId, playbook_id: playbookId }),
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return PlaybookCheckResultSchema.parse(res);
  }
}

export const legalPlaybooksApi = new LegalPlaybooksApiClient();
