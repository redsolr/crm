"use client";

/**
 * Global topbar — Attio-shape: section crumb left · global search
 * center · "Ask AI" right. One stable home for the cross-view chrome
 * (the per-view header rows keep their view-local actions). Split out
 * of CrmShell in the 2026-07-18 round-2 SOLID pass.
 */

import { usePathname } from "next/navigation";
import { useLayoutUI } from "@/stores/use-layout-ui";
import { AskHeaderButton } from "@/components/sales/ask/AskHeaderButton";
import { GlobalSearchBar } from "@/components/sales/search/GlobalSearchBar";
import { PresenceAvatarStack } from "@/components/presence/PresenceAvatarStack";

const TOPBAR_SECTIONS: ReadonlyArray<{ prefix: string; label: string }> = [
  { prefix: "/sales/companies", label: "Companies" },
  { prefix: "/sales/account/", label: "Companies" },
  { prefix: "/sales/contacts", label: "Contacts" },
  { prefix: "/sales/reports", label: "Reports" },
  { prefix: "/sales/opportunity/", label: "Pipeline" },
  { prefix: "/sales/ask", label: "Chat" },
  { prefix: "/sales", label: "Pipeline" },
];

export function CrmTopbar() {
  const pathname = usePathname();
  const { toggleMobileSidebar, openCommandPalette } = useLayoutUI();
  const section =
    TOPBAR_SECTIONS.find((s) => pathname.startsWith(s.prefix))?.label ?? "CRM";

  return (
    <header className="crm-topbar" data-testid="crm-topbar">
      {/* Mobile-only (CSS-hidden ≥768px): opens the sidebar drawer. */}
      <button
        type="button"
        className="crm-topbar-menu-btn"
        aria-label="Open navigation"
        data-testid="crm-topbar-menu"
        onClick={toggleMobileSidebar}
      >
        <MenuIcon />
      </button>
      <span className="crm-topbar-crumb" data-testid="crm-topbar-crumb">
        {section}
      </span>
      <div className="crm-topbar-center">
        <GlobalSearchBar />
      </div>
      {/* Mobile-only (CSS-hidden ≥768px): the search box above is too
          wide for a phone topbar — this icon opens the ⌘K palette,
          which carries record search + create verbs. */}
      <button
        type="button"
        className="crm-topbar-search-btn"
        aria-label="Search"
        data-testid="crm-topbar-search-btn"
        onClick={openCommandPalette}
      >
        <SearchIcon />
      </button>
      {/* Presence is ambient chrome — cut first when width is scarce. */}
      <span className="crm-topbar-presence">
        <PresenceAvatarStack compact />
      </span>
      <AskHeaderButton />
    </header>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
