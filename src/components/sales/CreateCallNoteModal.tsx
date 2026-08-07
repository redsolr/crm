"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { SelectMenu } from "@/components/ui/select";
import { Field, FORM_INPUT_CLASS as INPUT } from "./form";
import {
  OUTCOME_SELECT_OPTIONS,
  CALL_TYPE_SELECT_OPTIONS,
} from "./select-options";
import { SALES_TYPE_KEYS } from "@/lib/sales/constants";
import { useCreateCallNote } from "@/lib/sales/use-sales-mutations";
import { fireActivation } from "@/lib/sales/activation";
import { todayDateString } from "@/lib/sales/use-opportunity-attributes";
import type { WorkItem } from "@/lib/workItemsApi";
import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";

interface Props {
  bundle: SalesWorkspaceBundle;
  /** Opportunity or account this note belongs to. */
  parentId: string;
  /** Parent record title — when given, the note title prefills with the
   *  same `Call — {record} ({date})` convention the agent door uses, so
   *  logging a call is fill-summary-and-submit instead of naming work. */
  parentTitle?: string;
  /** Prefilled summary — the live-note freeze flow hands the co-edited
   *  text in here. */
  initialSummary?: string;
  onClose: () => void;
  onCreated?: (callNote: WorkItem) => void;
}

export function CreateCallNoteModal({
  bundle,
  parentId,
  parentTitle,
  initialSummary,
  onClose,
  onCreated,
}: Props) {
  // Local wall-clock date, not toISOString(): on UTC+7 the UTC date is
  // yesterday until 07:00, which stamped every early-morning call wrong.
  const [title, setTitle] = useState(() =>
    parentTitle ? `Call — ${parentTitle} (${todayDateString()})` : "",
  );
  const [callDate, setCallDate] = useState<string>(todayDateString());
  const [outcome, setOutcome] = useState<string>("");
  const [callType, setCallType] = useState<string>("");
  const [attendees, setAttendees] = useState("");
  const [summary, setSummary] = useState(initialSummary ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCallNote = useCreateCallNote();

  const type = bundle.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.call_note,
  );
  const defs = type ? bundle.attributeDefinitionsByType[type.id] ?? [] : [];

  const canSubmit =
    title.trim().length > 0 && callDate.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) {
      setError("Title and call date are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const callNote = await createCallNote.mutateAsync({
        title: title.trim(),
        workspace_id: bundle.workspace.id,
        parent_id: parentId,
        description: summary.trim() || undefined,
        definitions: defs,
        attributes: {
          call_date: callDate,
          outcome: outcome || undefined,
          call_type: callType || undefined,
          attendees: attendees.trim() || undefined,
          summary: summary.trim() || undefined,
        },
      });
      fireActivation("first_call_logged", {
        call_note_id: callNote.id,
        outcome: outcome || "unspecified",
      });
      onCreated?.(callNote);
      onClose();
    } catch (err) {
      console.error("[CreateCallNoteModal] create failed:", err);
      setError("Could not log the call. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <Modal.Title>Log a call</Modal.Title>
      <Modal.Description>
        Each call gets its own note — Pipeline view + opportunity timeline pull from here.
      </Modal.Description>
      <Modal.Body>
        <div className="space-y-4">
          <Field label="Title" required>
            <input
              type="text"
              data-testid="sales-call-note-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Discovery call — Acme"
              className={INPUT}
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Call date" required>
              <input
                type="date"
                data-testid="sales-call-note-date-input"
                value={callDate}
                onChange={(e) => setCallDate(e.target.value)}
                className={INPUT}
              />
            </Field>
            <Field label="Outcome">
              <SelectMenu
                testId="sales-call-note-outcome-select"
                value={outcome}
                onChange={setOutcome}
                options={OUTCOME_SELECT_OPTIONS}
                placeholder="—"
                emptyOptionLabel="—"
                className={INPUT}
                ariaLabel="Outcome"
              />
            </Field>
          </div>
          <Field label="Call type">
            <SelectMenu
              testId="sales-call-note-type-select"
              value={callType}
              onChange={setCallType}
              options={CALL_TYPE_SELECT_OPTIONS}
              placeholder="—"
              emptyOptionLabel="—"
              className={INPUT}
              ariaLabel="Call type"
            />
          </Field>
          <Field label="Attendees">
            <input
              type="text"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="Names of who joined"
              className={INPUT}
            />
          </Field>
          <Field label="Summary">
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="What they said in their words; commitments made."
              className={INPUT}
            />
          </Field>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </Modal.Body>
      <Modal.Actions>
        <Modal.Button cta onClick={handleSubmit} disabled={!canSubmit} loading={submitting}>
          Log call
        </Modal.Button>
        <Modal.ButtonMuted onClick={onClose}>Cancel</Modal.ButtonMuted>
      </Modal.Actions>
    </Modal>
  );
}
