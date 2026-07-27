"use client";

/**
 * Reply snippets — the firm's saved replies (Intercom "macros") for the
 * Communications composer's `/` menu. Workspace-shared CRUD over
 * `/v1/reply_snippets` (platform `src/modules/reply-snippets/`).
 */

import { z } from "zod";
import { BaseApiClient } from "@/lib/api-client";
import { freshIdempotencyKey } from "@/lib/idempotency";

export const ReplySnippetSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ReplySnippet = z.infer<typeof ReplySnippetSchema>;

const ListSchema = z.object({ data: z.array(ReplySnippetSchema) });
const EnvelopeSchema = z.object({ reply_snippet: ReplySnippetSchema });

class ReplySnippetsApiClient extends BaseApiClient {
  async list(): Promise<ReplySnippet[]> {
    const res = await this.request<unknown>(`/reply_snippets`);
    return ListSchema.parse(res).data;
  }

  async create(input: {
    title: string;
    body: string;
  }): Promise<ReplySnippet> {
    const res = await this.request<unknown>(`/reply_snippets`, {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
    return EnvelopeSchema.parse(res).reply_snippet;
  }

  async update(
    id: string,
    patch: { title?: string; body?: string },
  ): Promise<ReplySnippet> {
    const res = await this.request<unknown>(
      `/reply_snippets/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
        headers: { "Idempotency-Key": freshIdempotencyKey() },
      },
    );
    return EnvelopeSchema.parse(res).reply_snippet;
  }

  async remove(id: string): Promise<void> {
    await this.request<unknown>(
      `/reply_snippets/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { "Idempotency-Key": freshIdempotencyKey() },
      },
    );
  }
}

export const replySnippetsApi = new ReplySnippetsApiClient();
