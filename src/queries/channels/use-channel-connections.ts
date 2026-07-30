"use client";

/**
 * TanStack Query hooks for the connect API (`/api/channel_connections`) — the
 * settings "Channels" panel. Server state lives here; mutations invalidate
 * the list so the panel reflects connect / verify / disconnect immediately.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  channelConnectionsApi,
  type ConnectChannelPayload,
} from "@/lib/channels/channel-connections-api";
import type {
  ChannelConnection,
  ConnectChannelResponse,
} from "@/lib/channels/schemas";

const CHANNEL_CONNECTIONS_KEY = ["channel-connections"] as const;

export function useChannelConnectionsQuery(): UseQueryResult<
  ChannelConnection[]
> {
  return useQuery({
    queryKey: CHANNEL_CONNECTIONS_KEY,
    queryFn: () => channelConnectionsApi.list(),
    staleTime: 30 * 1000,
  });
}

export function useConnectChannelMutation() {
  const queryClient = useQueryClient();
  return useMutation<ConnectChannelResponse, Error, ConnectChannelPayload>({
    mutationFn: (payload) => channelConnectionsApi.connect(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CHANNEL_CONNECTIONS_KEY });
    },
    onError: (error) => {
      console.error("channels: connect failed", error);
    },
  });
}

export function useVerifyChannelMutation() {
  const queryClient = useQueryClient();
  return useMutation<ChannelConnection, Error, string>({
    mutationFn: (connectionId) => channelConnectionsApi.verify(connectionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CHANNEL_CONNECTIONS_KEY });
    },
    onError: (error) => {
      console.error("channels: verify failed", error);
    },
  });
}

export function useDisconnectChannelMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (connectionId) => channelConnectionsApi.disconnect(connectionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CHANNEL_CONNECTIONS_KEY });
    },
    onError: (error) => {
      console.error("channels: disconnect failed", error);
    },
  });
}
