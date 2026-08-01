"use client";

/**
 * Presence avatar stack — colleagues live in the CRM right now, with
 * where-they-are on hover. Renders NOTHING when you're alone (presence
 * should never be chrome for one). Consumes the realtime store
 * (`src/lib/realtime/` — Durable Object room; rebuilt 2026-08-01 off
 * the dead platform-era Hocuspocus presence).
 */

import { useRealtimeStore } from "@/lib/realtime/realtime-store";
import { getInitials } from "@/lib/identity";

const MAX_VISIBLE = 4;

/** Human label for where a peer is, from their view path. */
function locationLabel(path: string | undefined): string | null {
  if (path === undefined) return null;
  if (path.startsWith("/sales/inbox")) return "Inbox";
  if (path.startsWith("/sales/companies") || path.startsWith("/sales/account/"))
    return "Companies";
  if (path.startsWith("/sales/contacts")) return "Contacts";
  if (path.startsWith("/sales/reports")) return "Reports";
  if (path.startsWith("/sales/interviews")) return "Interviews";
  if (path.startsWith("/sales")) return "Pipeline";
  return null;
}

export function PresenceAvatarStack({
  compact = false,
}: {
  /** Slightly smaller circles for tight chrome. */
  compact?: boolean;
}) {
  // Select stable slices; derive in render (fresh-array selectors loop
  // React's getSnapshot).
  const allPeers = useRealtimeStore((s) => s.peers);
  const selfId = useRealtimeStore((s) => s.selfId);
  const peers =
    selfId === null ? allPeers : allPeers.filter((p) => p.id !== selfId);
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
      {visible.map((peer, i) => {
        const location = locationLabel(peer.view?.path);
        return (
          <span
            key={peer.id}
            className="presence-avatar inline-flex items-center justify-center rounded-full text-white font-semibold ring-2 ring-[var(--claude-sidebar)] select-none"
            data-testid="presence-avatar"
            data-account-id={peer.id}
            title={`${peer.name}${location ? ` · in ${location}` : ""}`}
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
        );
      })}
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
