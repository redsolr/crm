/**
 * Agent-memory API client (ChatGPT-memory arc, 2026-08-12).
 *
 * Hits `/api/memories` — the admin surface (session-gated): list,
 * add, delete. The agent's own writes go through the
 * remember_fact/forget_fact Ask tools, not this client.
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";

export interface AgentMemory {
  id: string;
  content: string;
  created_by_name: string | null;
  created_at: string;
}

class MemoriesApiClient extends BaseApiClient {
  async listMemories(): Promise<AgentMemory[]> {
    const raw = await this.request<{ data: AgentMemory[] }>("/memories", {
      method: "GET",
    });
    return raw.data;
  }

  async createMemory(
    content: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<AgentMemory> {
    const raw = await this.request<{ memory: AgentMemory }>("/memories", {
      method: "POST",
      body: JSON.stringify({ content }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return raw.memory;
  }

  async deleteMemory(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    await this.request<{ deleted: boolean }>(`/memories/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }
}

export const memoriesApi = new MemoriesApiClient();
