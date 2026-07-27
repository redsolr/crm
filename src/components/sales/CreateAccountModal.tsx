"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, FORM_INPUT_CLASS as INPUT } from "./form";
import {
  ACCOUNT_SOURCE_OPTIONS,
  ACCOUNT_SEGMENT_OPTIONS,
  ACCOUNT_PRACTICE_AREA_OPTIONS,
  SALES_TYPE_KEYS,
} from "@/lib/sales/constants";
import { useCreateAccount } from "@/lib/sales/use-sales-mutations";
import { fireActivation } from "@/lib/sales/activation";
import type { WorkItem } from "@/lib/workItemsApi";
import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";

interface Props {
  bundle: SalesWorkspaceBundle;
  onClose: () => void;
  onCreated?: (account: WorkItem) => void;
}

export function CreateAccountModal({ bundle, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [source, setSource] = useState<string>("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [segment, setSegment] = useState<string>("");
  const [practiceArea, setPracticeArea] = useState<string>("");
  const [currentTools, setCurrentTools] = useState("");
  const [painSummary, setPainSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAccount = useCreateAccount();

  const type = bundle.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.account,
  );
  const defs = type ? bundle.attributeDefinitionsByType[type.id] ?? [] : [];

  const canSubmit = name.trim().length > 0 && source.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) {
      setError("Company name and source are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const account = await createAccount.mutateAsync({
        title: name.trim(),
        workspace_id: bundle.workspace.id,
        definitions: defs,
        attributes: {
          source,
          company_url: companyUrl.trim() || undefined,
          segment: segment || undefined,
          practice_area: practiceArea || undefined,
          current_tools: currentTools.trim() || undefined,
          pain_summary: painSummary.trim() || undefined,
        },
      });
      fireActivation("first_lead_added", {
        account_id: account.id,
        source,
      });
      onCreated?.(account);
      onClose();
    } catch (err) {
      console.error("[CreateAccountModal] create failed:", err);
      setError("Could not create the account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <Modal.Title>Add a company</Modal.Title>
      <Modal.Description>
        Companies anchor every conversation. Sources lock the where —
        future deals against the same company keep the memory intact.
      </Modal.Description>
      <Modal.Body>
        <div className="space-y-4">
          <Field label="Company name" required>
            <input
              type="text"
              data-testid="sales-account-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme, Inc."
              className={INPUT}
              autoFocus
            />
          </Field>
          <Field label="Source" required>
            <select
              data-testid="sales-account-source-select"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className={INPUT}
            >
              <option value="">Select a source…</option>
              {ACCOUNT_SOURCE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Company URL">
            <input
              type="url"
              value={companyUrl}
              onChange={(e) => setCompanyUrl(e.target.value)}
              placeholder="https://example.com"
              className={INPUT}
            />
          </Field>
          <Field label="Segment">
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className={INPUT}
            >
              <option value="">—</option>
              {ACCOUNT_SEGMENT_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Practice area">
            <select
              value={practiceArea}
              onChange={(e) => setPracticeArea(e.target.value)}
              className={INPUT}
            >
              <option value="">—</option>
              {ACCOUNT_PRACTICE_AREA_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Current tools">
            <input
              type="text"
              value={currentTools}
              onChange={(e) => setCurrentTools(e.target.value)}
              placeholder="Linear, Notion, Slack…"
              className={INPUT}
            />
          </Field>
          <Field label="Pain summary">
            <textarea
              value={painSummary}
              onChange={(e) => setPainSummary(e.target.value)}
              rows={3}
              placeholder="One paragraph on what they're trying to solve."
              className={INPUT}
            />
          </Field>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </Modal.Body>
      <Modal.Actions>
        <Modal.Button cta onClick={handleSubmit} disabled={!canSubmit} loading={submitting}>
          Add company
        </Modal.Button>
        <Modal.ButtonMuted onClick={onClose}>Cancel</Modal.ButtonMuted>
      </Modal.Actions>
    </Modal>
  );
}
