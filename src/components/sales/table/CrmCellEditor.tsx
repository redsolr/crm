"use client";

/**
 * Inline cell editor — one input per attribute `data_type`, rendered
 * in place of a table cell's read view. Mirrors the per-type branching
 * of the detail-view AttributeEditor (SalesOpportunityDetailView) in
 * dense table form; the string ⇄ value bridge is the shared
 * `attribute-editing` helpers so both surfaces parse identically.
 *
 * Commit semantics (Attio/Linear convention):
 *   - text / number / date / url: Enter or blur commits, Escape cancels.
 *   - select: choosing an option commits immediately (blur/Escape close).
 *   - boolean: toggling the checkbox commits immediately.
 */

import { useRef, useState } from "react";
import type { AttributeDefinition } from "@/lib/generated/api/models";
import { SelectMenu, keyOptions } from "@/components/ui/select";

interface Props {
  dataType: AttributeDefinition["data_type"];
  /** Select options (select data_type only). */
  options?: readonly string[];
  initialValue: string;
  testId: string;
  /** Called with the raw editor string. Owner parses + mutates. */
  onCommit: (raw: string) => void;
  onClose: () => void;
}

export function CrmCellEditor({
  dataType,
  options,
  initialValue,
  testId,
  onCommit,
  onClose,
}: Props) {
  const [local, setLocal] = useState(initialValue);
  // Guards the blur-after-Escape / blur-after-Enter double fire: once
  // the edit session is settled (committed or cancelled), the trailing
  // blur must be a no-op.
  const settledRef = useRef(false);

  function commit(raw: string) {
    if (settledRef.current) return;
    settledRef.current = true;
    if (raw !== initialValue) onCommit(raw);
    onClose();
  }

  function cancel() {
    if (settledRef.current) return;
    settledRef.current = true;
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(local);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  if (dataType === "select" && Array.isArray(options)) {
    return (
      <SelectMenu
        testId={testId}
        className="crm-cell-editor"
        value={local}
        defaultOpen
        onChange={(next) => {
          setLocal(next);
          commit(next);
        }}
        // Menu dismissed without a pick (outside click / Escape) ends
        // the edit session — same contract as the old blur-cancel.
        onOpenChange={(open) => {
          if (!open) cancel();
        }}
        options={keyOptions(options)}
        placeholder="—"
        emptyOptionLabel="—"
        ariaLabel="Cell value"
      />
    );
  }

  if (dataType === "boolean") {
    return (
      <input
        data-testid={testId}
        className="crm-cell-editor-checkbox"
        type="checkbox"
        checked={local === "true"}
        autoFocus
        onChange={(e) => {
          const next = e.target.checked ? "true" : "false";
          setLocal(next);
          commit(next);
        }}
        onBlur={() => cancel()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  const inputType =
    dataType === "number"
      ? "number"
      : dataType === "date"
        ? "date"
        : dataType === "url"
          ? "url"
          : "text";

  return (
    <input
      data-testid={testId}
      className="crm-cell-editor"
      type={inputType}
      value={local}
      autoFocus
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => commit(local)}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
