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
import { usePeekRoute } from "@/lib/sales/use-peek-route";
import { CrmCard, CrmCardField } from "./table/CrmCard";
import { CrmTableSkeleton } from "./table/CrmTableSkeleton";
import { CrmRefreshIndicator } from "./table/CrmRefreshIndicator";

/** Static header set — mirrors the bespoke <thead> below so the
 *  first-load skeleton renders the real column labels. */
const CONTACT_SKELETON_COLUMNS = [
  { id: "name", label: "Name" },
  { id: "company", label: "Company" },
  { id: "role", label: "Role" },
  { id: "email", label: "Email" },
  { id: "decision_role", label: "Decision role" },
  { id: "linkedin", label: "LinkedIn" },
] as const;

export function SalesContactsView() {
  const { bundle, isLoading: bundleLoading } = useSalesWorkspaceBundle();
  const { peekId, openPeek, closePeek } = usePeekRoute();
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

  // First load only (no cached data): real chrome + shimmer rows.
  if (bundleLoading || contacts.isLoading) {
    return (
      <div className="sales-contacts-view crm-mobile-page-scroll flex-1 min-w-0 flex flex-col min-h-0">
        <div className="crm-view-header">
          <h1 className="crm-view-title">Contacts</h1>
        </div>
        <CrmTableSkeleton
          columns={CONTACT_SKELETON_COLUMNS}
          testIdPrefix="sales-contacts"
        />
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
        <CrmRefreshIndicator
          active={contacts.isFetching && !contacts.isLoading}
          testId="sales-contacts-refreshing"
        />
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
        <div className="crm-record-table-scroll crm-table-contained flex-1 min-h-0 overflow-y-auto">
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
                    onClick={() => openPeek(contact.id)}
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
              <CrmCard
                key={contact.id}
                testId="sales-contacts-card"
                rowId={contact.id}
                onOpen={() => openPeek(contact.id)}
                title={
                  <span className="flex items-center gap-2 min-w-0">
                    <PersonAvatar name={contact.title} size={18} />
                    <span className="truncate">{contact.title}</span>
                  </span>
                }
              >
                {account && (
                  <CrmCardField label="Company">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <CompanyLogo
                        name={account.title}
                        domain={accountAttrsById[account.id]?.domain ?? null}
                        size={14}
                      />
                      <span className="truncate">{account.title}</span>
                    </span>
                  </CrmCardField>
                )}
                {attrs?.role && (
                  <CrmCardField label="Role">{attrs.role}</CrmCardField>
                )}
                {attrs?.email && (
                  <CrmCardField label="Email">
                    <a
                      href={`mailto:${attrs.email}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {attrs.email}
                    </a>
                  </CrmCardField>
                )}
                {attrs?.decisionRole && (
                  <CrmCardField label="Decision role">
                    <span className="crm-tag">
                      {attrs.decisionRole.replace(/_/g, " ")}
                    </span>
                  </CrmCardField>
                )}
                {attrs?.linkedinUrl && (
                  <CrmCardField label="LinkedIn">
                    <a
                      href={attrs.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Profile ↗
                    </a>
                  </CrmCardField>
                )}
              </CrmCard>
            );
          })}
        </div>
      )}

      {peekId && bundle && (
        <SalesPeekPanel
          bundle={bundle}
          workItemId={peekId}
          onClose={closePeek}
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
