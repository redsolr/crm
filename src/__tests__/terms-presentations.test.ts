/**
 * Cross-repo drift gate for the terms-gate presentation copy.
 *
 * The platform records a SHA-256 `presentation_hash` of the EXACT copy
 * the gate screen / ai_ack modal rendered
 * (`platform/src/modules/terms/terms-components.ts`
 * `presentationHashFor()`). The hashes below are pinned from that
 * registry (revision `1.0.0-draft`, 2026-07-12). This test recomputes
 * the joined presentation strings from the web-app's copy module — if
 * either repo edits the copy without the other, the hash comparison
 * fails here instead of the evidence ledger silently recording a hash
 * of text the user never saw.
 *
 * When the platform legitimately revs the copy (new registry revision),
 * re-pin these hashes from `presentationHashFor()` in the same change
 * that updates `src/lib/terms/presentations.ts`.
 */

import { createHash } from "crypto";
import {
  presentationText,
  type TermsLocale,
  type TermsPresentationVariant,
} from "@/lib/terms/presentations";

const PLATFORM_PRESENTATION_HASHES: Record<
  TermsPresentationVariant,
  Record<TermsLocale, string>
> = {
  gate_signatory: {
    en: "2f5bd60e9ebeff9c5cd3d324d830dd7fb75b2272af9d1baba820c8b7c72b2647",
    th: "303f75e36aa949365001ecbad2f16f3dd0fe9fb6a524b0c29d7958a6c10aa823",
  },
  gate_member: {
    en: "a86bfdd7ebe47d63a89ca0996cc5cfe88989080c50aedd13077d6c2ebd50aa1c",
    th: "2590cbf4d0a6c3306d918da0877452034d3b76dc18eea8ef1acc13596aa95a8c",
  },
  ai_ack_modal: {
    en: "6531303d53c887b7a474abc24a6eea6fa28b635ac2939e6ed539feb12f0cd41f",
    th: "a8b33b85e2d542ed3a5205cffaf097bdd3a916097deb61b157cf3a71d7cd9cc5",
  },
  privacy_update: {
    en: "c35c831c7fbc76740b3c9133107e98289a1098e27ca92a37c639051269ad78a7",
    th: "b2a8b4d8888887648a0d88291989ca8b678a56f4b90d388f6b71ef79820e51c2",
  },
};

function hashOf(variant: TermsPresentationVariant, locale: TermsLocale): string {
  return createHash("sha256")
    .update(presentationText(variant, locale).normalize("NFC"), "utf8")
    .digest("hex");
}

describe("terms presentation copy matches the platform registry verbatim", () => {
  const variants = Object.keys(
    PLATFORM_PRESENTATION_HASHES,
  ) as TermsPresentationVariant[];

  for (const variant of variants) {
    for (const locale of ["en", "th"] as const) {
      it(`${variant} (${locale}) hashes to the platform's presentation_hash`, () => {
        expect(hashOf(variant, locale)).toBe(
          PLATFORM_PRESENTATION_HASHES[variant][locale],
        );
      });
    }
  }
});
