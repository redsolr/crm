/**
 * Reminders API Client
 *
 * Simple personal todo/reminder system.
 * Reminders are user-level (personal), not tied to projects.
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type { CursorPage } from "./pagination";
import type { AccountId, ReminderId } from "./ids";

// ============================================================================
// Types
// ============================================================================

export interface Reminder {
  id: ReminderId;
  title: string;
  description: string | null;
  completed: boolean;
  position: number;
  due_date: string | null;
  userId: string;
  account_id: AccountId;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CreateReminderDto {
  title: string;
  description?: string;
  due_date?: string;
}

export interface UpdateReminderDto {
  title?: string;
  description?: string;
  completed?: boolean;
  due_date?: string | null;
  position?: number;
}

export interface RemindersQueryParams {
  completed?: boolean;
  page_size?: number;
  page_token?: string;
}

// ============================================================================
// API Response Types
//
// BE returns the Stripe v2 cursor envelope (`{ data, has_more,
// next_page_url, previous_page_url }`) — see `ReminderListEnvelope` in
// `platform/src/modules/reminders/reminders.openapi.ts`.
// ============================================================================

interface SingleResponse {
  reminder: Reminder;
}

// ============================================================================
// API Client
// ============================================================================

class RemindersApiClient extends BaseApiClient {
  async list(params?: RemindersQueryParams): Promise<CursorPage<Reminder>> {
    const searchParams = new URLSearchParams();
    if (params?.completed !== undefined) {
      searchParams.set("completed", String(params.completed));
    }
    if (params?.page_size)
      searchParams.set("page_size", String(params.page_size));
    if (params?.page_token) searchParams.set("page_token", params.page_token);

    const queryString = searchParams.toString();
    return this.request<CursorPage<Reminder>>(
      `/reminders${queryString ? `?${queryString}` : ""}`,
    );
  }

  async create(
    dto: CreateReminderDto,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<SingleResponse> {
    return this.request<SingleResponse>("/reminders", {
      method: "POST",
      body: JSON.stringify(dto),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async get(id: string): Promise<SingleResponse> {
    return this.request<SingleResponse>(`/reminders/${id}`);
  }

  async update(
    id: string,
    dto: UpdateReminderDto,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<SingleResponse> {
    return this.request<SingleResponse>(`/reminders/${id}`, {
      method: "PUT",
      body: JSON.stringify(dto),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async complete(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<SingleResponse> {
    return this.request<SingleResponse>(`/reminders/${id}/complete`, {
      method: "PUT",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async uncomplete(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<SingleResponse> {
    return this.request<SingleResponse>(`/reminders/${id}/uncomplete`, {
      method: "PUT",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async delete(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>(`/reminders/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }
}

export const remindersApi = new RemindersApiClient();
export default remindersApi;
