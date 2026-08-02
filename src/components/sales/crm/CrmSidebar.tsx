"use client";

/**
 * CRM sidebar — workspace/product selector, quick-actions row, an
 * inline Slack-style filter (see `SidebarSearch` — it narrows the rail
 * IN PLACE: matching views + records replace the nav while a query is
 * typed), the workflow/records/insights nav with live counts, and the
 * account footer. Split out of CrmShell in the 2026-07-18 round-2
 * SOLID pass.
 */

import { ReactNode, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/stores/use-auth";
import { useAppContext } from "@/stores/use-app-context";
import { CrmWorkspaceSelector } from "./CrmWorkspaceSelector";
import { isCrmWorkspace } from "./crm-workspaces";
import { useSalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import {
  useAccountsQuery,
  useContactsQuery,
  useOpportunitiesQuery,
} from "@/lib/sales/use-sales-queries";
import { useCommitmentsInbox } from "@/lib/sales/use-commitments-inbox";
import { SALES_TYPE_KEYS } from "@/lib/sales/constants";
import { useLayoutUI } from "@/stores/use-layout-ui";
import AccountMenu from "@/components/layout/AccountMenu";
import {
  SidebarSearch,
  type SidebarViewItem,
} from "@/components/sales/search/SidebarSearch";

interface NavItem {
  id: string;
  label: string;
  href: string;
  matches: (pathname: string) => boolean;
  count?: number;
  disabled?: boolean;
  icon: ReactNode;
}

export function CrmSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { isAccountMenuOpen, toggleAccountMenu } = useLayoutUI();
  const { workspaces, currentWorkspace, setCurrentWorkspace } =
    useAppContext();
  const { bundle } = useSalesWorkspaceBundle();
  const workspaceId = bundle?.workspace.id;
  const accounts = useAccountsQuery(workspaceId);
  const opportunities = useOpportunitiesQuery(workspaceId);
  const contacts = useContactsQuery(workspaceId);

  // Inbox count = open commitments across all opportunities — same
  // hook the inbox view consumes, so the badge updates the moment a
  // commitment is toggled anywhere in the app.
  const commitmentType = bundle?.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.commitment
  );
  const commitmentDefs = commitmentType
    ? bundle?.attributeDefinitionsByType[commitmentType.id] ?? []
    : [];
  const inbox = useCommitmentsInbox(workspaceId, commitmentDefs);
  const openInboxCount =
    inbox.buckets.overdue.length +
    inbox.buckets.due_today.length +
    inbox.buckets.upcoming.length;

  const activeOpportunityCount = (opportunities.data?.data ?? []).filter(
    (o) => o.state.category !== "done" && o.state.category !== "dead"
  ).length;

  const workflowItems = useMemo<NavItem[]>(
    () => [
      {
        id: "pipeline",
        label: "Pipeline",
        href: "/sales",
        matches: (p) => p === "/sales" || p.startsWith("/sales/opportunity/"),
        count: activeOpportunityCount > 0 ? activeOpportunityCount : undefined,
        icon: <PipelineIcon />,
      },
      {
        id: "inbox",
        label: "Inbox",
        href: "/sales/inbox",
        matches: (p) => p.startsWith("/sales/inbox"),
        count: openInboxCount > 0 ? openInboxCount : undefined,
        icon: <InboxIcon />,
      },
      {
        id: "interviews",
        label: "Interviews",
        href: "/sales/interviews",
        matches: (p) => p.startsWith("/sales/interviews"),
        icon: <InterviewsIcon />,
      },
      // The dedicated AI-chat surface (founder ask 2026-08-02): sales
      // work IS talking to the assistant ("what should I ask X today",
      // "log what Y said") — it earns a first-class tab, not only the
      // topbar pill/Ctrl+J drawer.
      {
        id: "chat",
        label: "Chat",
        href: "/sales/ask",
        matches: (p) => p.startsWith("/sales/ask"),
        icon: <ChatIcon />,
      },
    ],
    [activeOpportunityCount, openInboxCount]
  );

  const recordItems = useMemo<NavItem[]>(
    () => [
      {
        id: "companies",
        label: "Companies",
        href: "/sales/companies",
        matches: (p) =>
          p.startsWith("/sales/companies") || p.startsWith("/sales/account/"),
        count: (accounts.data?.data ?? []).length || undefined,
        icon: <CompaniesIcon />,
      },
      {
        id: "contacts",
        label: "Contacts",
        href: "/sales/contacts",
        matches: (p) => p.startsWith("/sales/contacts"),
        count: (contacts.data?.data ?? []).length || undefined,
        icon: <ContactsIcon />,
      },
    ],
    [accounts.data?.data, contacts.data?.data]
  );

  const insightItems = useMemo<NavItem[]>(
    () => [
      {
        id: "reports",
        label: "Reports",
        href: "/sales/reports",
        matches: (p) => p.startsWith("/sales/reports"),
        icon: <ReportsIcon />,
      },
    ],
    []
  );

  // Inline filter (Slack-style): while a query is typed the nav below
  // is swapped for SidebarSearch's in-place matches. Every nav
  // destination doubles as a filterable "view" row.
  const [searchQuery, setSearchQuery] = useState("");
  const searching = searchQuery.trim() !== "";
  const searchViews = useMemo<SidebarViewItem[]>(
    () => [
      ...[...workflowItems, ...recordItems, ...insightItems].map((item) => ({
        id: item.id,
        label: item.label,
        href: item.href,
        icon: item.icon,
      })),
      {
        id: "settings",
        label: "Settings",
        href: "/account",
        icon: <SettingsIcon />,
      },
    ],
    [workflowItems, recordItems, insightItems]
  );

  return (
    <aside
      className="crm-sidebar"
      data-testid="sales-explorer"
      aria-label="CRM navigation"
    >
      {/* Product context selector (ADR-001: one CRM workspace per
          product's GTM motion) — OpenAI-project-picker shaped: it sits
          at the top of the rail, not among nav destinations, and lists
          CRM workspaces only. Switching re-points every workspace-
          scoped query and resets to the pipeline so stale detail
          routes never render cross-workspace. */}
      <CrmWorkspaceSelector
        workspaces={workspaces.filter(isCrmWorkspace)}
        currentWorkspace={currentWorkspace}
        onSelect={(w) => {
          setCurrentWorkspace(w);
          router.push("/sales");
        }}
      />

      {/* ONE find box (user decision 2026-07-19): normal typing filters
          the rail in place; a leading `/` engages command mode — the
          ⌘K quick-actions palette. */}
      <SidebarSearch
        query={searchQuery}
        onQueryChange={setSearchQuery}
        views={searchViews}
      />

      {!searching && (
        <nav className="crm-nav">
          <div className="crm-nav-section">Workflow</div>
          {workflowItems.map((item) => (
            <CrmNavButton key={item.id} item={item} pathname={pathname} />
          ))}
          <div className="crm-nav-section">Records</div>
          {recordItems.map((item) => (
            <CrmNavButton key={item.id} item={item} pathname={pathname} />
          ))}
          <div className="crm-nav-section">Insights</div>
          {insightItems.map((item) => (
            <CrmNavButton key={item.id} item={item} pathname={pathname} />
          ))}
          {/* The Ask DRAWER additionally lives in the global topbar
            ("Ask AI" pill) and on Ctrl/Cmd+J via the always-mounted
            <AskPanel />; the Chat tab above is the full-page surface. */}

          <div className="crm-nav-section">Account</div>
          <button
            type="button"
            className="crm-nav-item"
            data-testid="crm-nav-settings"
            onClick={() => router.push("/account")}
          >
            <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
              <SettingsIcon />
            </span>
            <span className="flex-1 truncate">Settings</span>
          </button>
        </nav>
      )}

      {/* Footer doubles as the account-menu trigger (web-app parity:
          the sidebar's user slot opens the AccountMenu popover). The
          menu is a SIBLING of the trigger, not a child — it portals to
          document.body but stays in this React subtree, and nesting it
          inside the button would re-toggle the menu on every item
          click via synthetic-event bubbling. */}
      <div className="crm-sidebar-footer">
        <button
          type="button"
          className="crm-sidebar-footer-button"
          onClick={toggleAccountMenu}
          data-testid="crm-sidebar-footer"
          aria-haspopup="menu"
          aria-expanded={isAccountMenuOpen}
        >
          <span className="crm-sidebar-org">
            {currentWorkspace?.name ?? ""}
          </span>
          <span className="crm-sidebar-user" data-testid="crm-sidebar-user">
            {user?.email ?? ""}
          </span>
        </button>
        <AccountMenu />
      </div>
    </aside>
  );
}

function CrmNavButton({ item, pathname }: { item: NavItem; pathname: string }) {
  const router = useRouter();
  const active = item.matches(pathname);
  return (
    <button
      type="button"
      disabled={item.disabled}
      data-testid={`sales-nav-${item.id}`}
      data-active={active ? "true" : undefined}
      className="crm-nav-item"
      onClick={() => {
        if (item.disabled) return;
        router.push(item.href);
      }}
    >
      <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
        {item.icon}
      </span>
      <span className="flex-1 truncate text-left">{item.label}</span>
      {item.disabled ? (
        <span className="crm-nav-item-soon">Soon</span>
      ) : item.count != null ? (
        <span
          className="crm-nav-item-count"
          data-testid={`sales-nav-${item.id}-count`}
        >
          {item.count}
        </span>
      ) : null}
    </button>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────

function PipelineIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <rect x="1" y="2" width="3.2" height="12" rx="0.8" />
      <rect x="6.4" y="2" width="3.2" height="8.5" rx="0.8" opacity="0.65" />
      <rect x="11.8" y="2" width="3.2" height="5.5" rx="0.8" opacity="0.35" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function CompaniesIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
      <path d="M9 9h.01M9 13h.01M9 17h.01" />
    </svg>
  );
}

function ContactsIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function InterviewsIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <path d="M12 18v4" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 5-5" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
