/**
 * Team Chat API client — internal lawyer↔lawyer chat (`/api/team_channels`
 * + `/api/team_messages`). Mirrors the platform response DTOs
 * (`src/modules/team-chat/team-chat.response.dto.ts`). Internal-only;
 * never touches the client-facing communications surface.
 */

import { BaseApiClient } from "../api-client";
import { freshIdempotencyKey } from "../idempotency";

// ============================================================================
// Types (mirror the platform response DTOs)
// ============================================================================

/** One DM member with their resolved display name (peer rendering). */
export interface TeamChannelMember {
  account_id: string;
  display_name: string | null;
}

export interface TeamChannel {
  id: string;
  kind: "channel" | "dm";
  name: string | null;
  topic: string | null;
  is_private: boolean;
  work_item_id: string | null;
  created_by: string;
  archived_at: string | null;
  last_message_at: string | null;
  unread_count: number;
  member_count: number;
  member_account_ids: string[];
  /** DM members WITH display names — render these, never uuid fragments. */
  members: TeamChannelMember[];
  muted: boolean;
  /** Whether the caller starred (pinned) this channel to their Starred section. */
  is_starred: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamReaction {
  emoji: string;
  count: number;
  reacted_by_me: boolean;
}

export interface TeamMessage {
  id: string;
  channel_id: string;
  parent_message_id: string | null;
  author_id: string;
  author_name: string | null;
  body_text: string;
  mentions: string[];
  content_kind: string;
  reactions: TeamReaction[];
  reply_count: number;
  edited_at: string | null;
  pinned_at: string | null;
  pinned_by: string | null;
  decision_at: string | null;
  decided_by: string | null;
  created_at: string;
}

export interface TeamPinnedMessagesResponse {
  data: TeamMessage[];
}

export interface TeamChannelListResponse {
  data: TeamChannel[];
}

export interface TeamMessageListResponse {
  data: TeamMessage[];
  has_more: boolean;
  next_page_url: string | null;
  previous_page_url: string | null;
}

export interface CreateTeamChannelRequest {
  name: string;
  topic?: string;
  is_private?: boolean;
  work_item_id?: string;
}

export interface UpdateTeamChannelRequest {
  name?: string;
  topic?: string | null;
  archived?: boolean;
}

export interface PostTeamMessageRequest {
  body_text: string;
  parent_message_id?: string;
  mentions?: string[];
}

/** A file/image attached to a team message (with a short-lived view URL). */
export interface TeamMessageAttachment {
  id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  view_url: string | null;
}

export interface TeamMessageAttachmentsResponse {
  data: TeamMessageAttachment[];
}

/** Finalized upload ref (post-presign+PUT) to attach to a team message. */
export interface AttachMessageInput {
  s3_key: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
}

// ============================================================================
// API Client
// ============================================================================

class TeamChatApiClient extends BaseApiClient {
  // ── Channels ──────────────────────────────────────────────────────────
  async listChannels(includeArchived = false): Promise<TeamChannelListResponse> {
    const qs = includeArchived ? "?include_archived=true" : "";
    return this.request<TeamChannelListResponse>(`/team_channels${qs}`);
  }

  async createChannel(
    request: CreateTeamChannelRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ team_channel: TeamChannel }> {
    return this.request<{ team_channel: TeamChannel }>("/team_channels", {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async getChannel(id: string): Promise<{ team_channel: TeamChannel }> {
    return this.request<{ team_channel: TeamChannel }>(`/team_channels/${id}`);
  }

  async updateChannel(
    id: string,
    request: UpdateTeamChannelRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ team_channel: TeamChannel }> {
    return this.request<{ team_channel: TeamChannel }>(`/team_channels/${id}`, {
      method: "PATCH",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async createDm(
    accountId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ team_channel: TeamChannel }> {
    return this.request<{ team_channel: TeamChannel }>("/team_channels/dm", {
      method: "POST",
      body: JSON.stringify({ account_id: accountId }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /** Get-or-create a group DM with 2–7 other accounts (3–8 total). */
  async createGroupDm(
    accountIds: string[],
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ team_channel: TeamChannel }> {
    return this.request<{ team_channel: TeamChannel }>(
      "/team_channels/group_dm",
      {
        method: "POST",
        body: JSON.stringify({ account_ids: accountIds }),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }

  async markRead(id: string): Promise<void> {
    return this.request<void>(`/team_channels/${id}/read`, {
      method: "POST",
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
  }

  async setMute(id: string, muted: boolean): Promise<void> {
    return this.request<void>(`/team_channels/${id}/mute`, {
      method: "POST",
      body: JSON.stringify({ muted }),
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
  }

  async setStar(id: string, starred: boolean): Promise<void> {
    return this.request<void>(`/team_channels/${id}/star`, {
      method: "POST",
      body: JSON.stringify({ starred }),
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
  }

  async listPins(id: string): Promise<TeamPinnedMessagesResponse> {
    return this.request<TeamPinnedMessagesResponse>(`/team_channels/${id}/pins`);
  }

  /** AI "catch me up" summary of the channel's recent discussion (metered). */
  async summarizeChannel(id: string): Promise<{ summary: string }> {
    return this.request<{ summary: string }>(`/team_channels/${id}/summary`, {
      method: "POST",
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
  }

  // ── Messages ──────────────────────────────────────────────────────────
  async listMessages(
    channelId: string,
    opts: { parentMessageId?: string; pageToken?: string; pageSize?: number } = {},
  ): Promise<TeamMessageListResponse> {
    const params = new URLSearchParams();
    if (opts.parentMessageId) params.set("parent_message_id", opts.parentMessageId);
    if (opts.pageToken) params.set("page_token", opts.pageToken);
    if (opts.pageSize) params.set("page_size", String(opts.pageSize));
    const qs = params.toString();
    return this.request<TeamMessageListResponse>(
      `/team_channels/${channelId}/messages${qs ? `?${qs}` : ""}`,
    );
  }

  async postMessage(
    channelId: string,
    request: PostTeamMessageRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ team_message: TeamMessage }> {
    return this.request<{ team_message: TeamMessage }>(
      `/team_channels/${channelId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(request),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }

  async editMessage(
    id: string,
    bodyText: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ team_message: TeamMessage }> {
    return this.request<{ team_message: TeamMessage }>(`/team_messages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ body_text: bodyText }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async deleteMessage(id: string): Promise<void> {
    return this.request<void>(`/team_messages/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
  }

  async addReaction(id: string, emoji: string): Promise<void> {
    return this.request<void>(`/team_messages/${id}/reactions`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
  }

  async removeReaction(id: string, emoji: string): Promise<void> {
    return this.request<void>(`/team_messages/${id}/reactions`, {
      method: "DELETE",
      body: JSON.stringify({ emoji }),
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
  }

  /** Finalize an uploaded file as an attachment on a team message. */
  async attachToMessage(
    messageId: string,
    input: AttachMessageInput,
  ): Promise<void> {
    await this.request<unknown>("/attachments", {
      method: "POST",
      body: JSON.stringify({
        parent_type: "team_message",
        parent_id: messageId,
        s3_key: input.s3_key,
        file_name: input.file_name,
        content_type: input.content_type,
        size_bytes: input.size_bytes,
      }),
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
  }

  /** A message's attachments, each with a short-lived presigned view URL. */
  async listMessageAttachments(
    messageId: string,
  ): Promise<TeamMessageAttachmentsResponse> {
    return this.request<TeamMessageAttachmentsResponse>(
      `/team_messages/${messageId}/attachments`,
    );
  }

  async createWorkItemFromMessage(
    id: string,
  ): Promise<{ work_item: { id: string; title: string } }> {
    return this.request<{ work_item: { id: string; title: string } }>(
      `/team_messages/${id}/work_item`,
      {
        method: "POST",
        headers: { "Idempotency-Key": freshIdempotencyKey() },
      },
    );
  }

  async pinMessage(id: string): Promise<void> {
    return this.request<void>(`/team_messages/${id}/pin`, {
      method: "POST",
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
  }

  async unpinMessage(id: string): Promise<void> {
    return this.request<void>(`/team_messages/${id}/pin`, {
      method: "DELETE",
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
  }

  async markDecision(id: string): Promise<void> {
    return this.request<void>(`/team_messages/${id}/decision`, {
      method: "POST",
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
  }

  async unmarkDecision(id: string): Promise<void> {
    return this.request<void>(`/team_messages/${id}/decision`, {
      method: "DELETE",
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
  }

  async listDecisions(id: string): Promise<TeamPinnedMessagesResponse> {
    return this.request<TeamPinnedMessagesResponse>(
      `/team_channels/${id}/decisions`,
    );
  }

  async saveMessage(id: string): Promise<void> {
    return this.request<void>(`/team_messages/${id}/save`, {
      method: "POST",
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
  }

  async unsaveMessage(id: string): Promise<void> {
    return this.request<void>(`/team_messages/${id}/save`, {
      method: "DELETE",
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
  }

  async listSaved(): Promise<TeamPinnedMessagesResponse> {
    return this.request<TeamPinnedMessagesResponse>(`/team_messages/saved`);
  }
}

export const teamChatApi = new TeamChatApiClient();
