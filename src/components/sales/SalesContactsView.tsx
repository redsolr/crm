"use client";

/**
 * Contacts view — flat record list of every person in the Sales
 * workspace (Attio "People" class). Columns: Name / Company / Role /
 * Email / Decision role / LinkedIn. Rows open the right-snap peek
 * panel; `+ Contact` creates one (optionally parented to an account).
 *
 * Contacts are `contact`-type work items; the person's display name is
 * the work-item title, with `first_name` / `last_name` attributes as
 * the structured split.
 */

import { useMemo, useState } from "react";
import { useSalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import {
  useAccountsQuery,
  useContactsQuery,
} from "@/lib/sales/use-sales-queries";
import { useContactAttributes } from "@/lib/sales/use-contact-attributes";
import { useAccountAttributes } from "@/lib/sales/use-account-attributes";
import { SALES_TYPE_KEYS } from "@/lib/sales/constants";
import { CompanyLogo } from "./CompanyLogo";
import { PersonAvatar } from "./PersonAvatar";
import { CreateContactModal } from "./CreateContactModal";
import { SalesPeekPanel } from "./peek/SalesPeekPanel";

export function SalesContactsView() {
  const { bundle, isLoading: bundleLoading } = useSalesWorkspaceBundle();
  const [peekId, setPeekId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const workspaceId = bundle?.workspace.id;
  const contacts = useContactsQuery(workspaceId);
  const accounts = useAccountsQuery(workspaceId);

  const contactType = bundle?.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.contact,
  );
  const contactDefs = contactType
    ? bundle?.attributeDefinitionsByType[contactType.id] ?? []
    : [];
  const accountType = bundle?.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.account,
  );
  const accountDefs = accountType
    ? bundle?.attributeDefinitionsByType[accountType.id] ?? []
    : [];

  const rows = useMemo(
    () => contacts.data?.data ?? [],
    [contacts.data?.data],
  );
  const allAccounts = useMemo(
    () => accounts.data?.data ?? [],
    [accounts.data?.data],
  );
  const accountsById = useMemo(
    () => Object.fromEntries(allAccounts.map((a) => [a.id, a])),
    [allAccounts],
  );

  const attrsByContactId = useContactAttributes(rows, contactDefs);
  const accountAttrsById = useAccountAttributes(allAccounts, accountDefs);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      ),
    [rows],
  );

  if (bundleLoading || contacts.isLoading) {
    return (
      <div className="sales-contacts-view flex-1 min-w-0 flex items-center justify-center">
        <span className="text-sm text-[var(--theme-text-muted)]">
          Loading contacts…
        </span>
      </div>
    );
  }

  return (
    <div
      className="sales-contacts-view crm-mobile-page-scroll flex-1 min-w-0 flex flex-col min-h-0"
      data-testid="sales-contacts-view"
    >
      <div className="crm-view-header">
        <h1 className="crm-view-title">Contacts</h1>
        <span className="crm-view-meta">
          {rows.length} contact{rows.length === 1 ? "" : "s"}
        </span>
        <div className="flex-1" />
        <button
          data-testid="sales-add-contact-button"
          onClick={() => setShowCreateModal(true)}
          className="crm-btn-primary"
        >
          + Contact
        </button>
      </div>

      {rows.length === 0 ? (
        <div
          className="py-16 text-center text-sm text-[var(--theme-text-muted)]"
          data-testid="sales-contacts-empty"
        >
          No contacts yet. Add the people you actually talk to at each
          firm — champion, decision-maker, blockers.
        </div>
      ) : (
        <div className="crm-record-table-scroll flex-1 min-h-0 overflow-y-auto">
          <table
            className="sales-contacts-table crm-table"
            data-testid="sales-contacts-table"
          >
            <thead>
              <tr>
                <th className="text-left pl-5">Name</th>
                <th className="text-left">Company</th>
                <th className="text-left">Role</th>
                <th className="text-left">Email</th>
                <th className="text-left">Decision role</th>
                <th className="text-left">LinkedIn</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((contact) => {
                const attrs = attrsByContactId[contact.id];
                const account = contact.parent_id
                  ? accountsById[contact.parent_id]
                  : undefined;
                return (
                  <tr
                    key={contact.id}
                    className="sales-contacts-row"
                    data-testid="sales-contacts-row"
                    data-contact-id={contact.id}
                    onClick={() => setPeekId(contact.id)}
                  >
                    <td className="pl-5 font-medium text-[var(--theme-text-primary)]">
                      <span className="flex items-center gap-2 min-w-0">
                        <PersonAvatar name={contact.title} size={18} />
                        <span className="truncate">{contact.title}</span>
                      </span>
                    </td>
                    <td>
                      {account ? (
                        <span className="flex items-center gap-1.5 min-w-0">
                          <CompanyLogo
                            name={account.title}
                            domain={
                              accountAttrsById[account.id]?.domain ?? null
                            }
                            size={14}
                          />
                          <span className="truncate text-[var(--theme-text-secondary)]">
                            {account.title}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-[var(--theme-text-secondary)]">
                      {attrs?.role ?? "—"}
                    </td>
                    <td className="text-[var(--theme-text-secondary)]">
                      {attrs?.email ? (
                        <a
                          href={`mailto:${attrs.email}`}
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {attrs.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {attrs?.decisionRole ? (
                        <span className="crm-tag">
                          {attrs.decisionRole.replace(/_/g, " ")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-[var(--theme-text-muted)]">
                      {attrs?.linkedinUrl ? (
                        <a
                          href={attrs.linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Profile ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile card list — same rows, CSS-switched (<768px). */}
      {rows.length > 0 && (
        <div className="crm-card-list" data-testid="sales-contacts-cards">
          {sortedRows.map((contact) => {
            const attrs = attrsByContactId[contact.id];
            const account = contact.parent_id
              ? accountsById[contact.parent_id]
              : undefined;
            return (
              <div
                key={contact.id}
                className="crm-card"
                data-testid="sales-contacts-card"
                data-row-id={contact.id}
                role="button"
                tabIndex={0}
                onClick={() => setPeekId(contact.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPeekId(contact.id);
                  }
                }}
              >
                <div className="crm-card-title flex items-center gap-2">
                  <PersonAvatar name={contact.title} size={18} />
                  <span className="truncate">{contact.title}</span>
                </div>
                <dl className="crm-card-fields">
                  {account && (
                    <div className="crm-card-field">
                      <dt className="crm-card-field-label">Company</dt>
                      <dd className="crm-card-field-value">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <CompanyLogo
                            name={account.title}
                            domain={
                              accountAttrsById[account.id]?.domain ?? null
                            }
                            size={14}
                          />
                          <span className="truncate">{account.title}</span>
                        </span>
                      </dd>
                    </div>
                  )}
                  {attrs?.role && (
                    <div className="crm-card-field">
                      <dt className="crm-card-field-label">Role</dt>
                      <dd className="crm-card-field-value">{attrs.role}</dd>
                    </div>
                  )}
                  {attrs?.email && (
                    <div className="crm-card-field">
                      <dt className="crm-card-field-label">Email</dt>
                      <dd className="crm-card-field-value">
                        <a
                          href={`mailto:${attrs.email}`}
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {attrs.email}
                        </a>
                      </dd>
                    </div>
                  )}
                  {attrs?.decisionRole && (
                    <div className="crm-card-field">
                      <dt className="crm-card-field-label">Decision role</dt>
                      <dd className="crm-card-field-value">
                        <span className="crm-tag">
                          {attrs.decisionRole.replace(/_/g, " ")}
                        </span>
                      </dd>
                    </div>
                  )}
                  {attrs?.linkedinUrl && (
                    <div className="crm-card-field">
                      <dt className="crm-card-field-label">LinkedIn</dt>
                      <dd className="crm-card-field-value">
                        <a
                          href={attrs.linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Profile ↗
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            );
          })}
        </div>
      )}

      {peekId && bundle && (
        <SalesPeekPanel
          bundle={bundle}
          workItemId={peekId}
          onClose={() => setPeekId(null)}
        />
      )}

      {showCreateModal && bundle && (
        <CreateContactModal
          bundle={bundle}
          accounts={allAccounts}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
