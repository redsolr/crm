"use client";

import { useCallback, useState } from "react";
import { teamApi } from "@/lib/teamApi";
import { useAuth } from "@/stores/use-auth";

/**
 * Shared org-invite-link behavior. Surfaces need either:
 *   - `copyInviteLink()` — generate (once, cached in `link`) + copy + flash
 *     "copied" (button-gesture surfaces: onboarding, hero cards, sidebar);
 *   - `ensureLink()` + `link` — generate and DISPLAY the url without writing
 *     to the clipboard (the invite modal, which shows the link + a Copy button).
 *
 * The active organization defaults to the authed user's; pass `organizationId`
 * to override (e.g. the org just created in onboarding, before the auth store
 * has caught up). Failures set `error` so callers can surface them.
 */
export function useInviteLink(organizationId?: string | null) {
  const { user } = useAuth();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Generate the invite url once (cached) and return it; null on failure. */
  const ensureLink = useCallback(async (): Promise<string | null> => {
    if (link) return link;
    const orgId = organizationId ?? user?.organization_id;
    if (!orgId) {
      console.warn("[useInviteLink] no active organization");
      setError(
        "Your workspace is still finishing setup — try again in a moment.",
      );
      return null;
    }
    setError(null);
    setGenerating(true);
    try {
      const res = await teamApi.createInviteLink(orgId, {
        role: "member",
        expires_in_hours: 168, // 7 days
      });
      const url = `${window.location.origin}/invite/${res.invite_link.code}`;
      setLink(url);
      return url;
    } catch (err) {
      console.error("[useInviteLink] failed to create invite link", err);
      setError(
        err instanceof Error ? err.message : "Couldn't create an invite link.",
      );
      return null;
    } finally {
      setGenerating(false);
    }
  }, [link, organizationId, user?.organization_id]);

  const copyInviteLink = useCallback(async () => {
    const url = await ensureLink();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error("[useInviteLink] clipboard write failed", err);
      setError("Couldn't copy — select and copy the link manually.");
    }
  }, [ensureLink]);

  return { copyInviteLink, ensureLink, link, copied, generating, error };
}
