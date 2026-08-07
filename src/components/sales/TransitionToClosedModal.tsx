"use client";

/**
 * Modal that intercepts the user transitioning an opportunity to
 * a closed stage (`lost` or `not_now`).
 *
 * The pipeline workflow lets these stages exist without `lost_reason`
 * / `not_now_until` set, but the founder-led-sales discipline says
 * every lost deal carries a reason and every snoozed deal carries a
 * resume date. FE enforces it at transition time so we never end up
 * with reasonless closures.
 *
 * On confirm:
 *   1) PUT the captured attribute(s) onto the opportunity.
 *   2) PATCH `work_items/:id` with the new `state_key`.
 * Both happen sequentially so the attribute is on the row before the
 * stage change fires.
 */

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { SelectMenu } from "@/components/ui/select";
import { FORM_INPUT_CLASS as INPUT } from "./form";
import { LOST_REASON_SELECT_OPTIONS } from "./select-options";
import { useUpsertAttributeValue, useTransitionWorkItem } from "@/lib/sales/use-sales-mutations";
import type { AttributeDefinition } from "@/lib/generated/api/models";

interface Props {
  opportunityId: string;
  opportunityVersion: number;
  nextStateKey: "lost" | "not_now";
  /** Attribute definitions for the opportunity work-item-type — we
   *  pick `lost_reason` / `not_now_until` by `def.key` and submit
   *  the value against `def.id`. */
  definitions: AttributeDefinition[];
  onClose: () => void;
  onCommitted?: () => void;
}

export function TransitionToClosedModal({
  opportunityId,
  opportunityVersion,
  nextStateKey,
  definitions,
  onClose,
  onCommitted,
}: Props) {
  const [lostReason, setLostReason] = useState("");
  const [notNowUntil, setNotNowUntil] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upsert = useUpsertAttributeValue();
  const transition = useTransitionWorkItem();

  const isLost = nextStateKey === "lost";
  const requiredFilled = isLost ? lostReason !== "" : notNowUntil !== "";
  const canSubmit = requiredFilled && !submitting;

  async function handleSubmit() {
    if (!canSubmit) {
      setError(
        isLost
          ? "Pick a lost reason — every closed deal carries why."
          : "Pick a resume date — snoozes need a recheck.",
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const key = isLost ? "lost_reason" : "not_now_until";
      const def = definitions.find((d) => d.key === key);
      if (!def) {
        throw new Error(
          `Attribute definition for ${key} missing on opportunity type`,
        );
      }
      const value = isLost ? lostReason : notNowUntil;
      await upsert.mutateAsync({
        workItemId: opportunityId,
        definitionId: def.id,
        value,
      });
      await transition.mutateAsync({
        id: opportunityId,
        version: opportunityVersion,
        state_key: nextStateKey,
      });
      onCommitted?.();
      onClose();
    } catch (err) {
      console.error("[TransitionToClosedModal] commit failed:", err);
      setError(
        "Could not save the transition. Try again or refresh the page.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <Modal.Title>
        {isLost ? "Mark this deal lost" : "Snooze this deal"}
      </Modal.Title>
      <Modal.Description>
        {isLost
          ? "Every lost deal carries a reason. The why is what drives positioning + pricing learnings later."
          : "A snoozed deal needs a date to come back. The pipeline filters surface it again automatically when the date arrives."}
      </Modal.Description>
      <Modal.Body>
        {isLost ? (
          <label className="block">
            <span className="block text-xs font-medium text-[var(--theme-text-secondary)] uppercase tracking-wider mb-1.5">
              Lost reason <span className="text-red-400 ml-1">*</span>
            </span>
            <SelectMenu
              testId="sales-transition-lost-reason-select"
              value={lostReason}
              onChange={setLostReason}
              options={LOST_REASON_SELECT_OPTIONS}
              placeholder="Pick a reason…"
              className={INPUT}
              ariaLabel="Lost reason"
              autoFocus
            />
          </label>
        ) : (
          <label className="block">
            <span className="block text-xs font-medium text-[var(--theme-text-secondary)] uppercase tracking-wider mb-1.5">
              Resume on <span className="text-red-400 ml-1">*</span>
            </span>
            <input
              data-testid="sales-transition-not-now-until-input"
              type="date"
              value={notNowUntil}
              onChange={(e) => setNotNowUntil(e.target.value)}
              className={INPUT}
              autoFocus
            />
          </label>
        )}
        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      </Modal.Body>
      <Modal.Actions>
        <Modal.Button cta onClick={handleSubmit} disabled={!canSubmit} loading={submitting}>
          {isLost ? "Mark lost" : "Snooze"}
        </Modal.Button>
        <Modal.ButtonMuted onClick={onClose}>Cancel</Modal.ButtonMuted>
      </Modal.Actions>
    </Modal>
  );
}
