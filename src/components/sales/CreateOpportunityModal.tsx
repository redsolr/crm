"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { SelectMenu } from "@/components/ui/select";
import { Field, FORM_INPUT_CLASS as INPUT } from "./form";
import {
  USE_CASE_SELECT_OPTIONS,
  recordOptions,
} from "./select-options";
import { SALES_TYPE_KEYS } from "@/lib/sales/constants";
import { useCreateOpportunity } from "@/lib/sales/use-sales-mutations";
import { fireActivation } from "@/lib/sales/activation";
import type { WorkItem } from "@/lib/workItemsApi";
import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";

interface Props {
  bundle: SalesWorkspaceBundle;
  accounts: WorkItem[];
  /** Pre-selected account ID — useful when the user clicked
   *  "+ Opportunity" from an account card. */
  defaultAccountId?: string;
  onClose: () => void;
  onCreated?: (opportunity: WorkItem) => void;
}

export function CreateOpportunityModal({
  bundle,
  accounts,
  defaultAccountId,
  onClose,
  onCreated,
}: Props) {
  const [accountId, setAccountId] = useState<string>(defaultAccountId ?? "");
  const [title, setTitle] = useState("");
  const [useCase, setUseCase] = useState<string>("");
  const [valueEstimate, setValueEstimate] = useState<string>("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOpportunity = useCreateOpportunity();

  const type = bundle.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.opportunity,
  );
  const defs = type ? bundle.attributeDefinitionsByType[type.id] ?? [] : [];

  const canSubmit =
    title.trim().length > 0 &&
    accountId.length > 0 &&
    useCase.length > 0 &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) {
      setError("Title, account, and use case are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const opportunity = await createOpportunity.mutateAsync({
        title: title.trim(),
        workspace_id: bundle.workspace.id,
        parent_id: accountId,
        definitions: defs,
        attributes: {
          use_case: useCase,
          value_estimate: valueEstimate
            ? Number(valueEstimate)
            : undefined,
          next_action: nextAction.trim() || undefined,
          next_action_date: nextActionDate || undefined,
          expected_close_date: expectedCloseDate || undefined,
        },
      });
      fireActivation("first_opportunity_created", {
        opportunity_id: opportunity.id,
        use_case: useCase,
      });
      onCreated?.(opportunity);
      onClose();
    } catch (err) {
      console.error("[CreateOpportunityModal] create failed:", err);
      setError("Could not create the opportunity. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <Modal.Title>New opportunity</Modal.Title>
      <Modal.Description>
        An opportunity is one sales motion. One company can run many
        opportunities over time — keep them separate.
      </Modal.Description>
      <Modal.Body>
        <div className="space-y-4">
          <Field label="Title" required>
            <input
              type="text"
              data-testid="sales-opportunity-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Acme — Workflow pilot"
              className={INPUT}
              autoFocus
            />
          </Field>
          <Field label="Account" required>
            <SelectMenu
              testId="sales-opportunity-account-select"
              value={accountId}
              onChange={setAccountId}
              options={recordOptions(accounts)}
              placeholder="Pick an account…"
              searchPlaceholder="Search companies…"
              className={INPUT}
            />
          </Field>
          <Field label="Use case" required>
            <SelectMenu
              testId="sales-opportunity-use-case-select"
              value={useCase}
              onChange={setUseCase}
              options={USE_CASE_SELECT_OPTIONS}
              placeholder="Pick a use case…"
              className={INPUT}
            />
          </Field>
          <Field label="Value estimate (USD/yr)">
            <input
              type="number"
              min="0"
              value={valueEstimate}
              onChange={(e) => setValueEstimate(e.target.value)}
              placeholder="0"
              className={INPUT}
            />
          </Field>
          <Field label="Next action">
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="Reply to last thread, send proposal…"
              className={INPUT}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Next action date">
              <input
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                className={INPUT}
              />
            </Field>
            <Field label="Expected close">
              <input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                className={INPUT}
              />
            </Field>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </Modal.Body>
      <Modal.Actions>
        <Modal.Button cta onClick={handleSubmit} disabled={!canSubmit} loading={submitting}>
          Create opportunity
        </Modal.Button>
        <Modal.ButtonMuted onClick={onClose}>Cancel</Modal.ButtonMuted>
      </Modal.Actions>
    </Modal>
  );
}
