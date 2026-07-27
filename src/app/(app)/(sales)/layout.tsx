"use client";

/**
 * (sales) route group — the CRM face. Renders the dedicated CrmShell
 * instead of AppLayout: same repo, same platform primitives, its own
 * app chrome (see CrmShell for the doctrine note). Auth comes from the
 * parent (app) layout's ProtectedRoute.
 */

import { ReactNode } from "react";
import { CrmShell } from "@/components/sales/crm/CrmShell";

export default function SalesLayout({ children }: { children: ReactNode }) {
  // Global overlays (CommandPalette, AskPanel) live inside CrmShell —
  // single mount each; global search is inline topbar/sidebar chrome.
  return <CrmShell>{children}</CrmShell>;
}
