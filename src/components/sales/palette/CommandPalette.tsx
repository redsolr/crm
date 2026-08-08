"use client";

/**
 * CRM command palette — ⌘K / Ctrl+K everywhere inside the CRM shell.
 * Attio/Linear-class: navigation, create verbs, record jump, and
 * per-opportunity actions (open / log call / move stage) behind a
 * two-level drill-down. Self-contained: mounts once in `CrmShell`,
 * owns its hotkey, overlay, and the create modals it can launch.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useSalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import {
  useAccountsQuery,
  useContactsQuery,
  useOpportunitiesQuery,
} from "@/lib/sales/use-sales-queries";
import { useTransitionWorkItem } from "@/lib/sales/use-sales-mutations";
import { PIPELINE_STAGE_ORDER } from "@/lib/sales/constants";
import type { WorkItem } from "@/lib/workItemsApi";
import { useLayoutUI } from "@/stores/use-layout-ui";
import { CreateAccountModal } from "../CreateAccountModal";
import { CreateOpportunityModal } from "../CreateOpportunityModal";
import { CreateContactModal } from "../CreateContactModal";
import { CreateCallNoteModal } from "../CreateCallNoteModal";
import { TransitionToClosedModal } from "../TransitionToClosedModal";
import { SALES_TYPE_KEYS } from "@/lib/sales/constants";
import { setPipelineViewMode } from "../pipeline-view-mode";

type PaletteLevel =
  | { kind: "root" }
  | { kind: "opportunity"; opportunity: WorkItem }
  | { kind: "stage"; opportunity: WorkItem };

type PaletteModal =
  | { kind: "account" }
  | { kind: "opportunity" }
  | { kind: "contact" }
  | { kind: "call_note"; parentId: string; parentTitle: string }
  | { kind: "closed"; opportunity: WorkItem; nextStateKey: "lost" | "not_now" };

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette() {
  const router = useRouter();
  const { bundle } = useSalesWorkspaceBundle();
  const workspaceId = bundle?.workspace.id;
  const accounts = useAccountsQuery(workspaceId);
  const opportunities = useOpportunitiesQuery(workspaceId);
  const contacts = useContactsQuery(workspaceId);
  const transition = useTransitionWorkItem();

  // Open state lives in the layout store so the mobile topbar's
  // search icon can open the palette (on phones it IS the search).
  const open = useLayoutUI((s) => s.isCommandPaletteOpen);
  const toggleCommandPalette = useLayoutUI((s) => s.toggleCommandPalette);
  const closeCommandPalette = useLayoutUI((s) => s.closeCommandPalette);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<PaletteLevel>({ kind: "root" });
  const [selected, setSelected] = useState(0);
  const [modal, setModal] = useState<PaletteModal | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    closeCommandPalette();
    setQuery("");
    setLevel({ kind: "root" });
    setSelected(0);
  }, [closeCommandPalette]);

  // Global hotkey — ⌘K / Ctrl+K toggles; ignore when a modal is up.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleCommandPalette();
        setQuery("");
        setLevel({ kind: "root" });
        setSelected(0);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCommandPalette]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, level]);

  const allAccounts = useMemo(
    () => accounts.data?.data ?? [],
    [accounts.data?.data],
  );
  const allOpportunities = useMemo(
    () => opportunities.data?.data ?? [],
    [opportunities.data?.data],
  );
  const allContacts = useMemo(
    () => contacts.data?.data ?? [],
    [contacts.data?.data],
  );

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = (label: string) => q === "" || label.toLowerCase().includes(q);

    if (level.kind === "opportunity") {
      const opp = level.opportunity;
      return [
        {
          id: "opp-open",
          label: "Open opportunity",
          run: () => {
            router.push(`/sales/opportunity/${opp.id}`);
            close();
          },
        },
        {
          id: "opp-log-call",
          label: "Log call",
          run: () => {
            setModal({ kind: "call_note", parentId: opp.id, parentTitle: opp.title });
            close();
          },
        },
        {
          id: "opp-move",
          label: "Move to stage…",
          hint: opp.state.name,
          run: () => {
            setLevel({ kind: "stage", opportunity: opp });
            setQuery("");
            setSelected(0);
          },
        },
      ].filter((i) => matches(i.label));
    }

    if (level.kind === "stage") {
      const opp = level.opportunity;
      return PIPELINE_STAGE_ORDER.filter(
        (s) => s !== opp.state.key && matches(s),
      ).map((s) => ({
        id: `stage-${s}`,
        label: s.replace(/_/g, " "),
        hint: s === "lost" || s === "not_now" ? "asks for a reason" : undefined,
        run: () => {
          if (s === "lost" || s === "not_now") {
            setModal({ kind: "closed", opportunity: opp, nextStateKey: s });
          } else {
            transition.mutate({
              id: opp.id,
              version: opp.version,
              state_key: s,
            });
          }
          close();
        },
      }));
    }

    // Root level: navigation + create verbs + record jump.
    const nav: PaletteItem[] = [
      { id: "nav-pipeline", label: "Go to Pipeline", run: () => { router.push("/sales"); close(); } },
      // The Inbox is the Pipeline's first tab — select it, then land.
      { id: "nav-inbox", label: "Go to Inbox", run: () => { setPipelineViewMode("inbox"); router.push("/sales"); close(); } },
      { id: "nav-interviews", label: "Go to Interviews", run: () => { router.push("/sales/interviews"); close(); } },
      { id: "nav-companies", label: "Go to Companies", run: () => { router.push("/sales/companies"); close(); } },
      { id: "nav-contacts", label: "Go to Contacts", run: () => { router.push("/sales/contacts"); close(); } },
      { id: "nav-reports", label: "Go to Reports", run: () => { router.push("/sales/reports"); close(); } },
    ].filter((i) => matches(i.label));

    const creates: PaletteItem[] = bundle
      ? [
          { id: "new-company", label: "New company", run: () => { setModal({ kind: "account" }); close(); } },
          { id: "new-opportunity", label: "New opportunity", run: () => { setModal({ kind: "opportunity" }); close(); } },
          { id: "new-contact", label: "New contact", run: () => { setModal({ kind: "contact" }); close(); } },
          { id: "start-interview", label: "Start interview", hint: "quick-create → live script", run: () => { router.push("/sales/interviews?new=1"); close(); } },
        ].filter((i) => matches(i.label))
      : [];

    const records: PaletteItem[] = [];
    if (q !== "") {
      for (const opp of allOpportunities.filter((o) => matches(o.title)).slice(0, 5)) {
        records.push({
          id: `opp-${opp.id}`,
          label: opp.title,
          hint: `opportunity · ${opp.state.name}`,
          run: () => {
            setLevel({ kind: "opportunity", opportunity: opp });
            setQuery("");
            setSelected(0);
          },
        });
      }
      for (const account of allAccounts.filter((a) => matches(a.title)).slice(0, 4)) {
        records.push({
          id: `account-${account.id}`,
          label: account.title,
          hint: "company",
          run: () => {
            router.push(`/sales/account/${account.id}`);
            close();
          },
        });
      }
      for (const contact of allContacts.filter((c) => matches(c.title)).slice(0, 3)) {
        records.push({
          id: `contact-${contact.id}`,
          label: contact.title,
          hint: "contact",
          run: () => {
            router.push("/sales/contacts");
            close();
          },
        });
      }
    }

    return [...records, ...creates, ...nav];
  }, [
    query,
    level,
    bundle,
    allAccounts,
    allOpportunities,
    allContacts,
    router,
    close,
    transition,
  ]);

  // Derived clamp (no state-sync effect): when the list shrinks under
  // the cursor, the highlight just lands on the last item.
  const activeIndex = Math.min(selected, Math.max(0, items.length - 1));

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(Math.min(activeIndex + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[activeIndex]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (level.kind !== "root") {
        setLevel(
          level.kind === "stage"
            ? { kind: "opportunity", opportunity: level.opportunity }
            : { kind: "root" },
        );
        setQuery("");
        setSelected(0);
      } else {
        close();
      }
    }
  }

  const contactType = bundle?.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.contact,
  );

  return (
    <>
      {open && (
        <div
          className="crm-command-palette-overlay fixed inset-0 z-[9000] bg-black/50 flex items-start justify-center pt-[18vh]"
          data-testid="crm-command-palette"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="crm-command-palette w-[560px] max-w-[90vw] rounded-xl border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] shadow-2xl overflow-hidden">
            {level.kind !== "root" && (
              <div className="crm-command-palette-crumb px-4 pt-3 text-xs text-[var(--theme-text-muted)]">
                {level.opportunity.title}
                {level.kind === "stage" ? " · move to stage" : ""}
              </div>
            )}
            <input
              ref={inputRef}
              data-testid="crm-command-palette-input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder={
                level.kind === "root"
                  ? "Search records, or type a command…"
                  : level.kind === "stage"
                    ? "Pick a stage…"
                    : "Action…"
              }
              className="crm-command-palette-input w-full px-4 py-3 bg-transparent text-sm text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-muted)] focus:outline-none border-b border-[var(--theme-border-primary)]"
            />
            <ul className="crm-command-palette-list max-h-[320px] overflow-y-auto py-1.5">
              {items.length === 0 ? (
                <li className="px-4 py-3 text-sm text-[var(--theme-text-muted)]">
                  Nothing matches.
                </li>
              ) : (
                items.map((item, i) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-testid={`crm-command-palette-item-${item.id}`}
                      className={`crm-command-palette-item w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
                        i === activeIndex
                          ? "bg-[var(--theme-bg-active)] text-[var(--theme-text-primary)]"
                          : "text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-hover)]"
                      }`}
                      onMouseEnter={() => setSelected(i)}
                      onClick={item.run}
                    >
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.hint && (
                        <span className="text-xs text-[var(--theme-text-muted)] flex-shrink-0">
                          {item.hint}
                        </span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {modal?.kind === "account" && bundle && (
        <CreateAccountModal bundle={bundle} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "opportunity" && bundle && (
        <CreateOpportunityModal
          bundle={bundle}
          accounts={allAccounts}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "contact" && bundle && contactType && (
        <CreateContactModal
          bundle={bundle}
          accounts={allAccounts}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "call_note" && bundle && (
        <CreateCallNoteModal
          bundle={bundle}
          parentId={modal.parentId}
          parentTitle={modal.parentTitle}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "closed" && bundle && (
        <TransitionToClosedModal
          opportunityId={modal.opportunity.id}
          opportunityVersion={modal.opportunity.version}
          nextStateKey={modal.nextStateKey}
          definitions={(() => {
            const oppType = bundle.workItemTypes.find(
              (t) => t.key === SALES_TYPE_KEYS.opportunity,
            );
            return oppType
              ? bundle.attributeDefinitionsByType[oppType.id] ?? []
              : [];
          })()}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
