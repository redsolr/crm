"use client";

/**
 * The ONE attribute editor for record pages — SOLID/DRY pass 2026-07-18.
 *
 * Previously the opportunity page had a controlled `AttributeField` and
 * the account page a separate UNCONTROLLED `AccountAttributeField`
 * (`defaultValue` + a remount-on-updated_at workaround so external
 * writes — e.g. the ✨ compute — showed up). One implementation now,
 * controlled, with render-time prop sync (the React-docs
 * "adjust state during render" pattern — no state-sync effect), so
 * server-side writes render without remount tricks on both pages.
 *
 * Commits on blur (text/number/date/url) or change (select) via the
 * optimistic `useUpsertAttributeValue`. The label row hosts
 * `AttributeEnrichmentControls` (✨ compute + AI provenance) for
 * definitions carrying an `enrichment` config.
 */

import { useMemo, useState } from "react";
import type {
  AttributeDefinition,
  AttributeValue,
} from "@/lib/generated/api/models";
import { useUpsertAttributeValue } from "@/lib/sales/use-sales-mutations";
import {
  parseAttributeValueForType,
  stringifyAttributeValue,
} from "@/lib/sales/attribute-editing";
import { AttributeEnrichmentControls } from "./AttributeEnrichmentControls";
import { FORM_INPUT_CLASS } from "./form";

export function AttributeFieldEditor({
  workItemId,
  definition,
  valueRow,
  testIdPrefix = "sales-attr",
}: {
  workItemId: string;
  definition: AttributeDefinition;
  /** Full row (value + provenance), when one exists. */
  valueRow: AttributeValue | undefined;
  /** Testid namespace: `${prefix}-${definition.key}`. */
  testIdPrefix?: string;
}) {
  const upsert = useUpsertAttributeValue();
  const value = valueRow?.value;

  const [local, setLocal] = useState<string>(() =>
    stringifyAttributeValue(value),
  );
  // Render-time prop sync: when the SERVER value changes under us
  // (refetch after a ✨ compute, another tab, optimistic rollback),
  // adopt it. Local keystrokes still win between syncs.
  const [prevValue, setPrevValue] = useState<unknown>(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(stringifyAttributeValue(value));
  }

  function commit(next: string) {
    upsert.mutate({
      workItemId,
      definitionId: definition.id,
      value: parseAttributeValueForType(next, definition.data_type),
    });
  }

  const label = (
    <span className="flex items-center text-xs font-medium text-[var(--theme-text-secondary)] uppercase tracking-wider mb-1.5">
      <span>
        {definition.name}
        {definition.required && <span className="text-red-400 ml-1">*</span>}
      </span>
      <AttributeEnrichmentControls
        workItemId={workItemId}
        definition={definition}
        valueRow={valueRow}
      />
    </span>
  );
  const testid = `${testIdPrefix}-${definition.key}`;
  const config = (definition.config ?? {}) as {
    options?: string[];
    maxLength?: number;
  };

  if (definition.data_type === "select" && Array.isArray(config.options)) {
    return (
      <label className="block">
        {label}
        <select
          data-testid={testid}
          value={local}
          onChange={(e) => {
            setLocal(e.target.value);
            commit(e.target.value);
          }}
          className={FORM_INPUT_CLASS}
        >
          <option value="">—</option>
          {config.options.map((o) => (
            <option key={o} value={o}>
              {o.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (
    definition.data_type === "date" ||
    definition.data_type === "number" ||
    definition.data_type === "url"
  ) {
    return (
      <label className="block">
        {label}
        <input
          data-testid={testid}
          type={definition.data_type}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => commit(local)}
          className={FORM_INPUT_CLASS}
        />
      </label>
    );
  }

  // Default: text. Textarea for any text field with maxLength > 200.
  const isLong = (config.maxLength ?? 200) > 200;
  return (
    <label className="block">
      {label}
      {isLong ? (
        <textarea
          data-testid={testid}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => commit(local)}
          rows={3}
          className={FORM_INPUT_CLASS}
        />
      ) : (
        <input
          data-testid={testid}
          type="text"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => commit(local)}
          className={FORM_INPUT_CLASS}
        />
      )}
    </label>
  );
}

/**
 * Panel wrapper — one panel for both record pages (previously
 * `AttributeEditor` on the opportunity page and `AccountAttributePanel`
 * on the account page, duplicated modulo title/testids).
 */
export function AttributeEditorPanel({
  workItemId,
  definitions,
  values,
  title,
  testid,
  fieldTestIdPrefix,
  className = "crm-panel space-y-3",
}: {
  workItemId: string;
  definitions: AttributeDefinition[];
  values: AttributeValue[];
  title: string;
  testid: string;
  fieldTestIdPrefix?: string;
  className?: string;
}) {
  const valuesByDefId = useMemo(() => {
    const map: Record<string, AttributeValue> = {};
    for (const v of values) map[v.definition_id] = v;
    return map;
  }, [values]);

  const ordered = useMemo(
    () => [...definitions].sort((a, b) => a.position - b.position),
    [definitions],
  );

  return (
    // The testid doubles as the semantic class — matches both original
    // panels (`sales-attribute-editor`, `sales-account-attributes`).
    <section className={`${testid} ${className}`} data-testid={testid}>
      <h2 className="crm-panel-title">{title}</h2>
      {ordered.length === 0 ? (
        <p className="text-sm text-[var(--theme-text-muted)]">
          No attributes defined for this type.
        </p>
      ) : (
        ordered.map((def) => (
          <AttributeFieldEditor
            key={def.id}
            workItemId={workItemId}
            definition={def}
            valueRow={valuesByDefId[def.id]}
            testIdPrefix={fieldTestIdPrefix}
          />
        ))
      )}
    </section>
  );
}
