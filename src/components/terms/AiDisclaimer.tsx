"use client";

import { AI_DISCLAIMER } from "@/lib/terms/presentations";
import { useTermsLocale } from "@/lib/terms/locale";

/**
 * Persistent AI disclaimer (terms-gate spec § 6.3) — always visible
 * under every AI chat input, never dismissible. Locale follows the
 * marketing locale cookie / browser language (SSR renders EN; the
 * client snapshot corrects at hydration — same word count, no layout
 * shift).
 */
export function AiDisclaimer({ className }: { className?: string }) {
  const locale = useTermsLocale();

  return (
    <p
      className={`ai-disclaimer text-center text-[11px] leading-snug text-[var(--theme-text-secondary,#9b9b9b)] opacity-80 ${className ?? ""}`}
      data-testid="ai-disclaimer"
    >
      {AI_DISCLAIMER[locale]}
    </p>
  );
}
