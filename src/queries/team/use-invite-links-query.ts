"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { teamApi, type InvitableRole } from "@/lib/teamApi";
import { queryKeys } from "../query-keys";

/**
 * Invite links live on the organization
 * (`/api/organizations/:id/invite_links`) — the production-true invite
 * mechanism. There is no email-based invite endpoint; joining is
 * link-accept (`POST /api/invite/:code/accept`).
 */

export function useInviteLinksQuery() {
  const organization_id = useAuthStore((s) => s.user?.organization_id);

  return useQuery({
    queryKey: queryKeys.inviteLinks.list(organization_id ?? ""),
    queryFn: async () => {
      const res = await teamApi.listInviteLinks(organization_id!);
      return res.data;
    },
    enabled: !!organization_id,
  });
}

export function useCreateInviteLinkMutation() {
  const queryClient = useQueryClient();
  const organization_id = useAuthStore((s) => s.user?.organization_id);

  return useMutation({
    mutationFn: async (data: {
      role: InvitableRole;
      expires_in_hours?: number;
      max_uses?: number;
    }) => {
      const res = await teamApi.createInviteLink(organization_id!, data);
      return res.invite_link;
    },
    onSuccess: () => {
      if (organization_id) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.inviteLinks.list(organization_id),
        });
      }
    },
    onError: (err) => {
      console.error("[team/use-invite-links] create failed", err);
    },
  });
}

export function useRevokeInviteLinkMutation() {
  const queryClient = useQueryClient();
  const organization_id = useAuthStore((s) => s.user?.organization_id);

  return useMutation({
    mutationFn: async (linkId: string) => {
      await teamApi.revokeInviteLink(organization_id!, linkId);
    },
    onSuccess: () => {
      if (organization_id) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.inviteLinks.list(organization_id),
        });
      }
    },
    onError: (err) => {
      console.error("[team/use-invite-links] revoke failed", err);
    },
  });
}
