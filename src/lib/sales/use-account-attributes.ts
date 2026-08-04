"use client";

/**
 * Account attribute fan-out — the account-side sibling of
 * `use-opportunity-attributes`. Projects each account's attribute values
 * into a typed snapshot (source / segment / company_url / pain / icp_fit)
 * plus the derived logo `domain`, keyed by account id. Rides the shared
 * `useAttributeValuesByItem` fan-out so rows are cached once per item
 * across Pipeline / Companies / detail views.
 */

import { useMemo } from "react";
import type { AttributeDefinition } from "@/lib/generated/api/models";
import { useAttributeValuesByItem } from "./use-item-attribute-values";
import { defKeyIndex, stringValuesByKey } from "./attribute-projection";
import { domainFromUrl } from "./company-domain";
import type { WorkItem } from "@/lib/workItemsApi";

export interface AccountAttributeSnapshot {
  companyUrl: string | null;
  /** Bare hostname derived from `companyUrl` — the logo seed. */
  domain: string | null;
  source: string | null;
  segment: string | null;
  practiceArea: string | null;
  currentTools: string | null;
  painSummary: string | null;
  /** AI-computed column (attribute-enrichment primitive). */
  icpFit: string | null;
}

const EMPTY_SNAPSHOT: AccountAttributeSnapshot = {
  companyUrl: null,
  domain: null,
  source: null,
  segment: null,
  practiceArea: null,
  currentTools: null,
  painSummary: null,
  icpFit: null,
};

export interface AccountAttributes {
  snapshots: Record<string, AccountAttributeSnapshot>;
  /** Aggregate first-load flag from the fan-out — see
   *  `AttributeValuesByItem.isLoading`. */
  isLoading: boolean;
}

/** Returns `{ snapshots: { [accountId]: snapshot }, isLoading }` for
 *  every account passed in. */
export function useAccountAttributes(
  accounts: WorkItem[],
  accountDefinitions: AttributeDefinition[],
  enabled = true,
): AccountAttributes {
  const { valuesById: valuesByItem, isLoading } = useAttributeValuesByItem(
    accounts,
    enabled,
  );

  const snapshots = useMemo(() => {
    const index = defKeyIndex(accountDefinitions);

    const map: Record<string, AccountAttributeSnapshot> = {};
    for (const account of accounts) {
      const byKey = stringValuesByKey(valuesByItem[account.id] ?? [], index);
      const companyUrl = byKey.company_url ?? null;
      map[account.id] = {
        ...EMPTY_SNAPSHOT,
        companyUrl,
        domain: domainFromUrl(companyUrl),
        source: byKey.source ?? null,
        segment: byKey.segment ?? null,
        practiceArea: byKey.practice_area ?? null,
        currentTools: byKey.current_tools ?? null,
        painSummary: byKey.pain_summary ?? null,
        icpFit: byKey.icp_fit ?? null,
      };
    }
    return map;
  }, [accounts, accountDefinitions, valuesByItem]);

  return { snapshots, isLoading };
}
