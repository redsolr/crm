"use client";

/**
 * CrmCard — the mobile (<768px) record card primitive shared by every
 * card-list surface (CrmRecordTable's generic list, Contacts'
 * bespoke list). One home for the card markup AND the
 * interactive-row a11y contract (role="button" + Enter/Space) so a
 * surface can't ship a tappable card without keyboard support.
 *
 * Fields render through CrmCardField (label/value rows in the card's
 * two-column grid). Styling lives in globals.css under
 * "Mobile record cards".
 */

import type { ReactNode } from "react";

interface CrmCardProps {
  /** data-testid on the card element. */
  testId: string;
  rowId: string;
  title: ReactNode;
  /** Present ⇒ the card is tappable (opens the row's peek). */
  onOpen?: () => void;
  /** CrmCardField rows. */
  children: ReactNode;
}

export function CrmCard({ testId, rowId, title, onOpen, children }: CrmCardProps) {
  const body = (
    <>
      <div className="crm-card-title">{title}</div>
      <dl className="crm-card-fields">{children}</dl>
    </>
  );
  return onOpen ? (
    <div
      className="crm-card"
      data-testid={testId}
      data-row-id={rowId}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {body}
    </div>
  ) : (
    <div className="crm-card" data-testid={testId} data-row-id={rowId}>
      {body}
    </div>
  );
}

export function CrmCardField({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="crm-card-field">
      <dt className="crm-card-field-label">{label}</dt>
      <dd className="crm-card-field-value">{children}</dd>
    </div>
  );
}
