"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, FORM_INPUT_CLASS as INPUT } from "./form";
import {
  CONTACT_DECISION_ROLE_OPTIONS,
  SALES_TYPE_KEYS,
} from "@/lib/sales/constants";
import { useCreateContact } from "@/lib/sales/use-sales-mutations";
import type { WorkItem } from "@/lib/workItemsApi";
import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";

interface Props {
  bundle: SalesWorkspaceBundle;
  accounts: WorkItem[];
  /** Pre-selected account — useful from an account detail page. */
  defaultAccountId?: string;
  onClose: () => void;
  onCreated?: (contact: WorkItem) => void;
}

export function CreateContactModal({
  bundle,
  accounts,
  defaultAccountId,
  onClose,
  onCreated,
}: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [accountId, setAccountId] = useState<string>(defaultAccountId ?? "");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [decisionRole, setDecisionRole] = useState<string>("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createContact = useCreateContact();

  const type = bundle.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.contact,
  );
  const defs = type ? bundle.attributeDefinitionsByType[type.id] ?? [] : [];

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const canSubmit = fullName.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) {
      setError("A name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const contact = await createContact.mutateAsync({
        title: fullName,
        workspace_id: bundle.workspace.id,
        parent_id: accountId || undefined,
        definitions: defs,
        attributes: {
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          role: role.trim() || undefined,
          email: email.trim() || undefined,
          decision_role: decisionRole || undefined,
          linkedin_url: linkedinUrl.trim() || undefined,
        },
      });
      onCreated?.(contact);
      onClose();
    } catch (err) {
      console.error("[CreateContactModal] create failed:", err);
      setError("Could not create the contact. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <Modal.Title>New contact</Modal.Title>
      <Modal.Description>
        The person you actually talk to. Link them to their firm so every
        call note lands in one place.
      </Modal.Description>
      <Modal.Body>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="First name" required>
              <input
                type="text"
                data-testid="sales-contact-first-name-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Somchai"
                className={INPUT}
                autoFocus
              />
            </Field>
            <Field label="Last name">
              <input
                type="text"
                data-testid="sales-contact-last-name-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Prasert"
                className={INPUT}
              />
            </Field>
          </div>
          <Field label="Company">
            <select
              data-testid="sales-contact-account-select"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={INPUT}
            >
              <option value="">No company</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Role">
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Managing Partner"
                className={INPUT}
              />
            </Field>
            <Field label="Decision role">
              <select
                data-testid="sales-contact-decision-role-select"
                value={decisionRole}
                onChange={(e) => setDecisionRole(e.target.value)}
                className={INPUT}
              >
                <option value="">Pick one…</option>
                {CONTACT_DECISION_ROLE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Email">
            <input
              type="email"
              data-testid="sales-contact-email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="somchai@firm.co.th"
              className={INPUT}
            />
          </Field>
          <Field label="LinkedIn URL">
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/…"
              className={INPUT}
            />
          </Field>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </Modal.Body>
      <Modal.Actions>
        <Modal.Button
          cta
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
        >
          Create contact
        </Modal.Button>
        <Modal.ButtonMuted onClick={onClose}>Cancel</Modal.ButtonMuted>
      </Modal.Actions>
    </Modal>
  );
}
