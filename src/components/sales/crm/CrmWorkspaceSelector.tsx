"use client";

/**
 * Product context selector (ADR-001: one CRM workspace per product's
 * GTM motion) — OpenAI-project-picker shaped: sits at the top of the
 * rail, not among nav destinations, and lists CRM workspaces only.
 * Extracted from CrmShell (SRP: the shell composes chrome; the
 * selector owns its open/close + option semantics).
 */

import { useEffect, useRef, useState } from "react";
import type { Workspace } from "@/lib/workspacesApi";

export function CrmWorkspaceSelector({
  workspaces,
  currentWorkspace,
  onSelect,
}: {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  onSelect: (w: Workspace) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeName = currentWorkspace?.name ?? "Select workspace";

  return (
    <div className="crm-workspace-selector" ref={rootRef}>
      <button
        type="button"
        className="crm-workspace-trigger"
        data-testid="crm-workspace-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="crm-workspace-trigger-name">{activeName}</span>
        <span className="crm-brand-badge">CRM</span>
        <span className="crm-workspace-trigger-chevron">
          <ChevronsUpDownIcon />
        </span>
      </button>

      {open && (
        <div className="crm-workspace-menu" role="listbox">
          <div className="crm-workspace-menu-label">Workspaces</div>
          {workspaces.map((w) => {
            const active = currentWorkspace?.id === w.id;
            return (
              <button
                key={w.id}
                type="button"
                role="option"
                aria-selected={active}
                className="crm-workspace-option"
                data-active={active ? "true" : undefined}
                data-testid={`crm-workspace-${w.id}`}
                onClick={() => {
                  setOpen(false);
                  if (!active) onSelect(w);
                }}
              >
                <span className="crm-workspace-option-check">
                  {active ? <CheckIcon /> : null}
                </span>
                <span className="flex-1 truncate text-left">{w.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChevronsUpDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 15l5 5 5-5" />
      <path d="M7 9l5-5 5 5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
