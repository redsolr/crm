"use client";

/**
 * `channelConnectionsApi` — the self-serve "Connect a channel" surface
 * (`/v1/channel_connections`). A firm (or a Jurisimus operator setting it up
 * for them) connects its own LINE OA: paste the channel secret + access
 * token, the server validates the token against LINE, seals both in the
 * vault, and returns the webhook URL to paste back into LINE.
 *
 * Platform module: `platform/src/modules/channels` + the connect controller
 * in `platform/src/modules/integrations`.
 */

import { BaseApiClient } from "../api-client";
import { freshIdempotencyKey } from "../idempotency";
import { parseApiResponse } from "../chat/schemas";
import {
  ChannelConnectionEnvelopeSchema,
  ChannelConnectionListSchema,
  ConnectChannelResponseSchema,
  type ChannelConnection,
  type ConnectChannelResponse,
} from "./schemas";

/**
 * Connect payload, discriminated by channel. LINE carries a channel secret +
 * access token; Meta (Messenger / Instagram) carries ONLY a Page access token
 * — the signing secret is the app-level `META_APP_SECRET`, never pasted here.
 */
export type ConnectChannelPayload =
  | { channel_type: "line"; channel_secret: string; access_token: string }
  | {
      channel_type: "meta_messenger" | "meta_instagram";
      access_token: string;
    };

class ChannelConnectionsApiClient extends BaseApiClient {
  /** The caller workspace's connected channels (no secrets). */
  async list(): Promise<ChannelConnection[]> {
    const res = await this.request<unknown>("/channel_connections");
    return parseApiResponse(
      ChannelConnectionListSchema,
      "GET /channel_connections",
      res,
    ).data;
  }

  /** Connect a channel — validated server-side, returns the webhook path. */
  async connect(
    payload: ConnectChannelPayload,
  ): Promise<ConnectChannelResponse> {
    const res = await this.request<unknown>("/channel_connections", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
    return parseApiResponse(
      ConnectChannelResponseSchema,
      "POST /channel_connections",
      res,
    );
  }

  /** Re-validate the stored token against LINE; refreshes status. */
  async verify(connectionId: string): Promise<ChannelConnection> {
    const res = await this.request<unknown>(
      `/channel_connections/${encodeURIComponent(connectionId)}/verify`,
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Idempotency-Key": freshIdempotencyKey() },
      },
    );
    return parseApiResponse(
      ChannelConnectionEnvelopeSchema,
      "POST /channel_connections/:id/verify",
      res,
    ).channel_connection;
  }

  async disconnect(connectionId: string): Promise<void> {
    await this.request<unknown>(
      `/channel_connections/${encodeURIComponent(connectionId)}`,
      {
        method: "DELETE",
        headers: { "Idempotency-Key": freshIdempotencyKey() },
      },
    );
  }
}

export const channelConnectionsApi = new ChannelConnectionsApiClient();
