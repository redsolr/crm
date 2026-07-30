"use client";

/**
 * Client checklists — per-matter "what we need from you" lists
 * (engagement letter / KYC / retainer), managed from the matter panel and
 * surfaced read-only in the public client chat. CRUD over
 * `/api/matter_checklists` (platform `src/modules/matter-checklists/`;
 * spec `docs/platform/client-checklists-spec-2026-07-06.md`).
 */

import { z } from "zod";
import { BaseApiClient } from "@/lib/api-client";
import { freshIdempotencyKey } from "@/lib/idempotency";

export const MatterChecklistItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  position: z.number(),
  completed: z.boolean(),
  completed_at: z.string().nullable(),
});
export type MatterChecklistItem = z.infer<typeof MatterChecklistItemSchema>;

export const MatterChecklistSchema = z.object({
  id: z.string(),
  matter_id: z.string(),
  title: z.string(),
  items: z.array(MatterChecklistItemSchema),
  completed_count: z.number(),
  total_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type MatterChecklist = z.infer<typeof MatterChecklistSchema>;

export const ChecklistPresetSchema = z.object({
  key: z.string(),
  title: z.string(),
  items: z.array(z.string()),
});
export type ChecklistPreset = z.infer<typeof ChecklistPresetSchema>;

const ListSchema = z.object({ data: z.array(MatterChecklistSchema) });
const PresetListSchema = z.object({ data: z.array(ChecklistPresetSchema) });
const EnvelopeSchema = z.object({
  matter_checklist: MatterChecklistSchema,
  /** How many client threads were actually notified (honest count). */
  notified_thread_count: z.number(),
});
export type MatterChecklistEnvelope = z.infer<typeof EnvelopeSchema>;

class MatterChecklistsApiClient extends BaseApiClient {
  async listPresets(): Promise<ChecklistPreset[]> {
    const res = await this.request<unknown>(`/matter_checklists/presets`);
    return PresetListSchema.parse(res).data;
  }

  async list(matterId: string): Promise<MatterChecklist[]> {
    const res = await this.request<unknown>(
      `/matter_checklists?matter_id=${encodeURIComponent(matterId)}`,
    );
    return ListSchema.parse(res).data;
  }

  async create(input: {
    matter_id: string;
    title: string;
    items: { title: string }[];
    notify_client: boolean;
  }): Promise<MatterChecklistEnvelope> {
    const res = await this.request<unknown>(`/matter_checklists`, {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
    return EnvelopeSchema.parse(res);
  }

  async remove(id: string): Promise<void> {
    await this.request<unknown>(
      `/matter_checklists/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { "Idempotency-Key": freshIdempotencyKey() },
      },
    );
  }

  async addItem(
    checklistId: string,
    title: string,
  ): Promise<MatterChecklistEnvelope> {
    const res = await this.request<unknown>(
      `/matter_checklists/${encodeURIComponent(checklistId)}/items`,
      {
        method: "POST",
        body: JSON.stringify({ title }),
        headers: { "Idempotency-Key": freshIdempotencyKey() },
      },
    );
    return EnvelopeSchema.parse(res);
  }

  async setItemCompleted(
    checklistId: string,
    itemId: string,
    completed: boolean,
  ): Promise<MatterChecklistEnvelope> {
    const res = await this.request<unknown>(
      `/matter_checklists/${encodeURIComponent(checklistId)}/items/${encodeURIComponent(itemId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ completed }),
        headers: { "Idempotency-Key": freshIdempotencyKey() },
      },
    );
    return EnvelopeSchema.parse(res);
  }

  async removeItem(checklistId: string, itemId: string): Promise<void> {
    await this.request<unknown>(
      `/matter_checklists/${encodeURIComponent(checklistId)}/items/${encodeURIComponent(itemId)}`,
      {
        method: "DELETE",
        headers: { "Idempotency-Key": freshIdempotencyKey() },
      },
    );
  }
}

export const matterChecklistsApi = new MatterChecklistsApiClient();
