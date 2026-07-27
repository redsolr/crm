"use client";

/**
 * Presence avatar stack — colleagues live in this workspace right now,
 * with where-they-are on hover. Renders NOTHING when you're alone
 * (presence should never be chrome for one). Consumes
 * `useWorkspacePresence` (ephemeral awareness — see the hook doc).
 */

import { useWorkspacePresence } from "@/lib/collab/use-workspace-presence";
import { getInitials } from "@/lib/identity";

const MAX_VISIBLE = 4;

export function PresenceAvatarStack({
  compact = false,
}: {
  /** Slightly smaller circles for tight chrome (CRM sidebar footer). */
  compact?: boolean;
}) {
  const { peers } = useWorkspacePresence();
  if (peers.length === 0) return null;

  const size = compact ? 22 : 26;
  const visible = peers.slice(0, MAX_VISIBLE);
  const overflow = peers.length - visible.length;

  return (
    <div
      className="presence-avatar-stack flex items-center"
      data-testid="presence-avatar-stack"
      aria-label={`${peers.length} ${peers.length === 1 ? "colleague" : "colleagues"} online`}
    >
      {visible.map((peer, i) => (
        <span
          key={peer.clientId}
          className="presence-avatar inline-flex items-center justify-center rounded-full text-white font-semibold ring-2 ring-[var(--claude-sidebar)] select-none"
          data-testid="presence-avatar"
          data-account-id={peer.accountId}
          title={`${peer.name}${peer.location ? ` · in ${peer.location}` : ""}`}
          style={{
            width: size,
            height: size,
            fontSize: Math.round(size * 0.38),
            backgroundColor: peer.color,
            marginLeft: i === 0 ? 0 : -Math.round(size * 0.3),
            zIndex: MAX_VISIBLE - i,
          }}
        >
          {getInitials(peer.name, "")}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="presence-avatar-overflow inline-flex items-center justify-center rounded-full bg-[var(--theme-bg-active)] text-[var(--theme-text-secondary)] font-medium ring-2 ring-[var(--claude-sidebar)]"
          data-testid="presence-avatar-overflow"
          style={{
            width: size,
            height: size,
            fontSize: Math.round(size * 0.36),
            marginLeft: -Math.round(size * 0.3),
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
