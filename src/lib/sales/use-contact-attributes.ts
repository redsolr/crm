"use client";

/**
 * Contact attribute fan-out — sibling of `use-account-attributes`.
 * Projects each contact's attribute values (role / email / linkedin /
 * decision_role, plus the split name fields) into a typed snapshot keyed
 * by contact id, riding the shared per-item fan-out cache.
 */

import { useMemo } from "react";
import type { AttributeDefinition } from "@/lib/generated/api/models";
import { useAttributeValuesByItem } from "./use-item-attribute-values";
import { defKeyIndex, stringValuesByKey } from "./attribute-projection";
import type { WorkItem } from "@/lib/workItemsApi";

export interface ContactAttributeSnapshot {
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  email: string | null;
  linkedinUrl: string | null;
  decisionRole: string | null;
}

const EMPTY_SNAPSHOT: ContactAttributeSnapshot = {
  firstName: null,
  lastName: null,
  role: null,
  email: null,
  linkedinUrl: null,
  decisionRole: null,
};

export interface ContactAttributes {
  snapshots: Record<string, ContactAttributeSnapshot>;
  /** Aggregate first-load flag from the fan-out — see
   *  `AttributeValuesByItem.isLoading`. */
  isLoading: boolean;
}

/** Returns `{ snapshots: { [contactId]: snapshot }, isLoading }` for
 *  every contact passed in. */
export function useContactAttributes(
  contacts: WorkItem[],
  contactDefinitions: AttributeDefinition[],
  enabled = true,
): ContactAttributes {
  const { valuesById: valuesByItem, isLoading } = useAttributeValuesByItem(
    contacts,
    enabled,
  );

  const snapshots = useMemo(() => {
    const index = defKeyIndex(contactDefinitions);

    const map: Record<string, ContactAttributeSnapshot> = {};
    for (const contact of contacts) {
      const byKey = stringValuesByKey(valuesByItem[contact.id] ?? [], index);
      map[contact.id] = {
        ...EMPTY_SNAPSHOT,
        firstName: byKey.first_name ?? null,
        lastName: byKey.last_name ?? null,
        role: byKey.role ?? null,
        email: byKey.email ?? null,
        linkedinUrl: byKey.linkedin_url ?? null,
        decisionRole: byKey.decision_role ?? null,
      };
    }
    return map;
  }, [contacts, contactDefinitions, valuesByItem]);

  return { snapshots, isLoading };
}
