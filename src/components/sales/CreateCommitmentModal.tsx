"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, FORM_INPUT_CLASS as INPUT } from "./form";
import { SALES_TYPE_KEYS } from "@/lib/sales/constants";
import { useCreateCommitment } from "@/lib/sales/use-sales-mutations";
import { fireActivation } from "@/lib/sales/activation";
import type { WorkItem } from "@/lib/workItemsApi";
import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";

interface Props {
  bundle: SalesWorkspaceBundle;
  parentId: string;
  onClose: () => void;
  onCreated?: (commitment: WorkItem) => void;
}

export function CreateCommitmentModal({
  bundle,
  parentId,
  onClose,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [promisedTo, setPromisedTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCommitment = useCreateCommitment();

  const type = bundle.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.commitment,
  );
  const defs = type ? bundle.attributeDefinitionsByType[type.id] ?? [] : [];

  const canSubmit =
    title.trim().length > 0 && dueDate.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) {
      setError("Promise and due date are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const commitment = await createCommitment.mutateAsync({
        title: title.trim(),
        workspace_id: bundle.workspace.id,
        parent_id: parentId,
        definitions: defs,
        attributes: {
          due_date: dueDate,
          promised_to: promisedTo.trim() || undefined,
        },
      });
      fireActivation("first_commitment_created", {
        commitment_id: commitment.id,
      });
      onCreated?.(commitment);
      onClose();
    } catch (err) {
      console.error("[CreateCommitmentModal] create failed:", err);
      setError("Could not record the commitment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <Modal.Title>Record a commitment</Modal.Title>
      <Modal.Description>
        No promise gets dropped — every follow-up lives in the
        commitment ledger.
      </Modal.Description>
      <Modal.Body>
        <div className="space-y-4">
          <Field label="Promise" required>
            <input
              type="text"
              data-testid="sales-commitment-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Send proposal Friday"
              className={INPUT}
              autoFocus
            />
          </Field>
          <Field label="Due date" required>
            <input
              type="date"
              data-testid="sales-commitment-due-date-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label="Promised to">
            <input
              type="text"
              value={promisedTo}
              onChange={(e) => setPromisedTo(e.target.value)}
              placeholder="Contact name, or 'internal'"
              className={INPUT}
            />
          </Field>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </Modal.Body>
      <Modal.Actions>
        <Modal.Button cta onClick={handleSubmit} disabled={!canSubmit} loading={submitting}>
          Record commitment
        </Modal.Button>
        <Modal.ButtonMuted onClick={onClose}>Cancel</Modal.ButtonMuted>
      </Modal.Actions>
    </Modal>
  );
}
