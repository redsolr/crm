"use client";

import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { legalApi } from "@/lib/legal/client";
import type {
  LegalReviewDocument,
  LegalRiskProfile,
  LegalColumnFormat,
} from "@/lib/legal/client";

/** Codes in the corpus (Library nav). Reference data — cache long. */
export function useLegalCodesQuery() {
  return useQuery({
    queryKey: queryKeys.legal.codes(),
    queryFn: () => legalApi.codes(),
    staleTime: 60 * 60 * 1000,
  });
}

/** Browse / filter sections in a code (the Library list). */
export function useLegalSectionsQuery(code: string, q: string) {
  return useQuery({
    queryKey: queryKeys.legal.sections(code, q),
    queryFn: () => legalApi.sections({ code, q: q || undefined, limit: 60 }),
    enabled: !!code,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
}

/** One section's full detail (Thai + EN gloss + cases + cross-refs). */
export function useLegalSectionQuery(code: string, no: string | null) {
  return useQuery({
    queryKey: queryKeys.legal.section(code, no ?? ""),
    queryFn: () => legalApi.section(code, no!),
    enabled: !!code && !!no,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Intelligent search (the autocomplete behind the top bar + the Library
 * filter). Debounce at the call site; this hook just caches per query.
 */
export function useLegalSearchQuery(q: string, opts: { enabled?: boolean } = {}) {
  const query = q.trim();
  return useQuery({
    queryKey: queryKeys.legal.search(query),
    queryFn: () => legalApi.search(query, { limit: 8 }),
    enabled: (opts.enabled ?? true) && query.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });
}

/**
 * Tabular Review — run the matter's documents through the extractor. A
 * mutation (an action, not a cache read): each run re-analyzes the current
 * document set and returns the grid rows.
 */
export function useLegalReviewMutation() {
  return useMutation({
    mutationFn: (vars: {
      documents: LegalReviewDocument[];
      riskProfile?: LegalRiskProfile;
    }) => legalApi.review(vars.documents, vars.riskProfile),
  });
}

/** Custom Tabular-Review column: extract a user-defined field per document. */
export function useLegalExtractColumnMutation() {
  return useMutation({
    mutationFn: (vars: {
      documents: LegalReviewDocument[];
      column: { label: string; prompt: string; format: LegalColumnFormat };
    }) => legalApi.extractColumn(vars.documents, vars.column),
  });
}

/** Matter chat: ask a cross-document question over the review's documents. */
export function useLegalAskMutation() {
  return useMutation({
    mutationFn: (vars: { question: string; documents: LegalReviewDocument[] }) =>
      legalApi.ask(vars.question, vars.documents),
  });
}
