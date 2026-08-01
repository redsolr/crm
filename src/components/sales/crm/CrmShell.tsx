"use client";

/**
 * CRM shell — the Sales face's own app chrome.
 *
 * crm-web is the company's internal CRM (ADR-001) — its own product on
 * the same `/api/*` platform primitives: dedicated sidebar (see
 * `CrmSidebar`), global topbar (see `CrmTopbar`), dark-dense token
 * scope (`.crm-app` in globals.css), zero customer-app chrome. This
 * file owns ONLY the module gate, the workspace re-point, the layout
 * skeleton, and the always-mounted overlays (palette / Ask) — global
 * search is inline chrome now (topbar `GlobalSearchBar` dropdown +
 * sidebar `SidebarSearch` filter), not an overlay. Sidebar and topbar
 * were split out in the 2026-07-18 round-2 SOLID pass.
 *
 * Module gate: an org whose workspaces don't carry the `sales` module
 * key can never render this surface — direct URLs bounce to
 * /unauthorized. Bare orgs (no module keys at all) stay ungated, same
 * as everywhere else.
 */

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Inter } from "next/font/google";
import { useAppContext } from "@/stores/use-app-context";
import { useEnabledModules } from "@/lib/modules/enabled-modules";
import { useRealtimeConnection } from "@/lib/realtime/use-realtime-connection";
import { LoadingDots } from "@/components/shared/LoadingDots";
import { CommandPalette } from "@/components/sales/palette/CommandPalette";
import { AskPanel } from "@/components/sales/ask/AskPanel";
import { CrmSidebar } from "./CrmSidebar";
import { CrmTopbar } from "./CrmTopbar";
import { isCrmWorkspace } from "./crm-workspaces";

const inter = Inter({ subsets: ["latin"] });

export function CrmShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  // Hydrates the app-context store (org + workspace fetch → setWorkspaces).
  // MUST run here, not just in the sidebar: `useEnabledModules` reads the
  // store, and the sidebar only mounts after the gate below passes — without
  // this call the store never fills and `ready` never turns true.
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useAppContext();
  const { modules, ready } = useEnabledModules();
  // Collaboration channel (presence / cursors / live invalidation) —
  // dormant no-op unless the realtime worker is configured.
  useRealtimeConnection();

  // Module gate, standalone-app shape: crm-web IS the CRM, so an org
  // without the sales module has nothing here — bounce to /unauthorized
  // instead of a customer-app view that no longer exists in this repo.
  const gated = ready && modules.size > 0 && !modules.has("sales");
  useEffect(() => {
    if (gated) router.replace("/unauthorized");
  }, [gated, router]);

  // The store's boot-time auto-select picks workspaces[0] — usually a
  // PRODUCT workspace (`Legal`, `Default`), whose queries would render
  // an empty pipeline. Re-point to the first CRM workspace as soon as
  // the list is in.
  useEffect(() => {
    if (!ready) return;
    if (currentWorkspace && isCrmWorkspace(currentWorkspace)) return;
    const firstCrm = workspaces.find(isCrmWorkspace);
    if (firstCrm) setCurrentWorkspace(firstCrm);
  }, [ready, workspaces, currentWorkspace, setCurrentWorkspace]);

  if (!ready || gated) {
    return (
      <div
        className={`crm-app flex h-screen w-screen items-center justify-center ${inter.className}`}
      >
        <LoadingDots label="Loading CRM" />
      </div>
    );
  }

  return (
    <div
      className={`crm-app flex h-screen w-screen overflow-hidden ${inter.className}`}
      data-testid="crm-shell"
    >
      <CrmSidebar />
      <div className="crm-content-col flex-1 min-w-0 flex flex-col">
        <CrmTopbar />
        <main className="crm-main">{children}</main>
      </div>
      <CommandPalette />
      <AskPanel />
    </div>
  );
}
