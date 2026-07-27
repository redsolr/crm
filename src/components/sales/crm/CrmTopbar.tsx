"use client";

/**
 * Global topbar — Attio-shape: section crumb left · global search
 * center · "Ask AI" right. One stable home for the cross-view chrome
 * (the per-view header rows keep their view-local actions). Split out
 * of CrmShell in the 2026-07-18 round-2 SOLID pass.
 */

import { usePathname } from "next/navigation";
import { AskHeaderButton } from "@/components/sales/ask/AskHeaderButton";
import { GlobalSearchBar } from "@/components/sales/search/GlobalSearchBar";

const TOPBAR_SECTIONS: ReadonlyArray<{ prefix: string; label: string }> = [
  { prefix: "/sales/inbox", label: "Inbox" },
  { prefix: "/sales/companies", label: "Companies" },
  { prefix: "/sales/account/", label: "Companies" },
  { prefix: "/sales/contacts", label: "Contacts" },
  { prefix: "/sales/reports", label: "Reports" },
  { prefix: "/sales/opportunity/", label: "Pipeline" },
  { prefix: "/sales/ask", label: "Ask" },
  { prefix: "/sales", label: "Pipeline" },
];

export function CrmTopbar() {
  const pathname = usePathname();
  const section =
    TOPBAR_SECTIONS.find((s) => pathname.startsWith(s.prefix))?.label ?? "CRM";

  return (
    <header className="crm-topbar" data-testid="crm-topbar">
      <span className="crm-topbar-crumb" data-testid="crm-topbar-crumb">
        {section}
      </span>
      <div className="crm-topbar-center">
        <GlobalSearchBar />
      </div>
      <AskHeaderButton />
    </header>
  );
}
