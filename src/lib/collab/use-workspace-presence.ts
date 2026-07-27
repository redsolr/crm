"use client";

/**
 * Workspace presence — the first web-app consumer of the platform's
 * realtime collaboration substrate (ws://.../collaboration, channel
 * `presence:workspace:{id}`; see platform docs/modules/collaboration.md).
 *
 * One HocuspocusProvider per active workspace carrying Yjs AWARENESS
 * only (the channel is ephemeral server-side — nothing persists). Each
 * client publishes `{ accountId, name, color, location }`; the hook
 * returns everyone else's state for avatar stacks / who-is-where UI.
 *
 * Fail-soft by design: presence is an enhancement, never a blocker.
 * If the ticket mint fails (mocked e2e tier, offline, revoked session)
 * the hook goes DORMANT for that workspace — one console.info, no
 * retry storm. Tickets are single-use, so the provider gets an async
 * token FACTORY that mints per connection attempt; three consecutive
 * mint failures also force dormancy (covers revocation mid-session).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useAuth } from "@/stores/use-auth";
import { useAppContextStore } from "@/stores/app-context.store";
import { collaborationUrl, mintWsTicket } from "@/lib/collab/ws-ticket";
import { stringToHue } from "@/lib/identity";

export interface PresencePeer {
  clientId: number;
  accountId: string;
  name: string;
  color: string;
  /** First URL segment the peer is on ("chat", "matters", "sales"…). */
  location: string;
}

export function useWorkspacePresence(): {
  peers: PresencePeer[];
  connected: boolean;
} {
  const user = useAuth().user;
  const workspaceId = useAppContextStore((s) => s.currentWorkspace?.id);
  const pathname = usePathname();
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [connected, setConnected] = useState(false);
  const providerRef = useRef<HocuspocusProvider | null>(null);

  const accountId = user?.account_id;
  const displayName = user?.full_name || user?.email || "Someone";
  const location = pathname?.split("/")[1] || "home";

  useEffect(() => {
    if (!workspaceId || !accountId) return;

    let disposed = false;
    let mintFailures = 0;
    const ydoc = new Y.Doc();

    const provider = new HocuspocusProvider({
      url: collaborationUrl(),
      name: `presence:workspace:${workspaceId}`,
      document: ydoc,
      token: async () => {
        try {
          const ticket = await mintWsTicket();
          mintFailures = 0;
          return ticket;
        } catch (err) {
          mintFailures += 1;
          if (mintFailures === 1) {
            console.info(
              "[presence] ticket mint failed — presence dormant for this workspace",
              err,
            );
          }
          if (mintFailures >= 3 && !disposed) {
            // Revoked session / dead backend: stop the reconnect loop.
            queueMicrotask(() => provider.destroy());
          }
          throw err;
        }
      },
      onSynced: () => setConnected(true),
      onClose: () => setConnected(false),
      onAwarenessChange: ({ states }) => {
        const next: PresencePeer[] = [];
        for (const raw of states) {
          const state = raw as {
            clientId: number;
            presence?: {
              accountId?: string;
              name?: string;
              location?: string;
            };
          };
          const presence = state.presence;
          if (!presence?.accountId) continue;
          if (presence.accountId === accountId) continue; // self excluded
          next.push({
            clientId: state.clientId,
            accountId: presence.accountId,
            name: presence.name ?? "Someone",
            color: `hsl(${stringToHue(presence.accountId)}, 55%, 48%)`,
            location: presence.location ?? "",
          });
        }
        setPeers(next);
      },
    });
    providerRef.current = provider;

    return () => {
      disposed = true;
      providerRef.current = null;
      setPeers([]);
      setConnected(false);
      try {
        provider.destroy();
      } catch (err) {
        console.warn("[presence] provider teardown", err);
      }
      ydoc.destroy();
    };
  }, [workspaceId, accountId]);

  // Publish/refresh our own awareness whenever location (or identity
  // fields) change — cheap awareness update, no reconnect.
  useEffect(() => {
    const provider = providerRef.current;
    if (!provider || !accountId) return;
    provider.setAwarenessField("presence", {
      accountId,
      name: displayName,
      location,
    });
  }, [accountId, displayName, location, connected]);

  return useMemo(() => ({ peers, connected }), [peers, connected]);
}
