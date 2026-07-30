import { z } from "zod";

/**
 * Zod schemas for the connect API (`/api/channel_connections`) — the
 * multi-tenant "Connect a channel" surface (platform channel-connections
 * design 2026-06-16). Mirrors the platform `ChannelConnectionResponseDto`;
 * secrets NEVER appear on the wire, so they're not modeled here.
 */

export const ChannelConnectionSchema = z.object({
  id: z.string(),
  channel_type: z.string(),
  /** The OA's routing id (LINE `destination`). Not a secret. */
  external_id: z.string(),
  display_name: z.string().nullable(),
  status: z.string(),
  last_verified_at: z.string().nullable(),
  created_at: z.string(),
});
export type ChannelConnection = z.infer<typeof ChannelConnectionSchema>;

export const ChannelConnectionEnvelopeSchema = z.object({
  channel_connection: ChannelConnectionSchema,
});

export const ChannelConnectionListSchema = z.object({
  data: z.array(ChannelConnectionSchema),
});
export type ChannelConnectionList = z.infer<typeof ChannelConnectionListSchema>;

/** `POST /api/channel_connections` — the connection + the webhook path to paste. */
export const ConnectChannelResponseSchema = z.object({
  channel_connection: ChannelConnectionSchema,
  webhook_path: z.string(),
});
export type ConnectChannelResponse = z.infer<
  typeof ConnectChannelResponseSchema
>;
