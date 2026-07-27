/**
 * Terms-gate presentation copy — the EXACT rendered strings for the
 * `/accept-terms` gate screen and the first-AI-use acknowledgment modal.
 *
 * **Verbatim-copy contract**: the platform records a SHA-256
 * `presentation_hash` of this copy on every acceptance event
 * (`platform/src/modules/terms/terms-components.ts`
 * `TERMS_PRESENTATIONS`). The screen must render the same words — never
 * paraphrase. The unit test `__tests__/terms-presentations.test.ts`
 * recomputes the joined presentation strings from this module and
 * compares them against the platform's pinned hashes, so any drift
 * between the two repos is a failing test, not a silent evidentiary
 * mismatch.
 *
 * Structure note: the platform stores each variant as ONE newline-joined
 * string (headline \n cards \n checkbox \n button). The FE needs the
 * pieces separately to render them as distinct elements, so this module
 * keeps them apart and `presentationText()` reconstructs the exact
 * joined form for the hash test.
 */

export type TermsLocale = "en" | "th";

export type TermsGateVariant = "gate_signatory" | "gate_member";

/** Gate headline (spec § 6.1 item 1). */
export const GATE_HEADLINE: Record<TermsLocale, string> = {
  en: "Welcome to Jurisimus — one thing before you start",
  th: "ยินดีต้อนรับสู่ Jurisimus — อีกขั้นตอนเดียวก่อนเริ่มใช้งาน",
};

/**
 * The three key-terms cards (spec § 6.1 item 2), each a single
 * "title — body" string exactly as hashed. Render with the first
 * " — " as the title/body split; the visible text stays identical.
 */
export const GATE_CARDS: Record<TermsLocale, readonly [string, string, string]> = {
  en: [
    "A workflow tool, not legal advice — Jurisimus organizes and accelerates legal work. It is not a law firm and never provides legal advice.",
    "AI can make mistakes — AI output, including citations, can be wrong. You must verify everything before relying on it or sending it to a client. That professional judgment stays yours.",
    "Your clients stay yours to protect — Confidentiality and professional duties to your clients remain your firm’s responsibility. We protect the platform; you decide what belongs in it.",
  ],
  th: [
    "เครื่องมือช่วยงาน ไม่ใช่คำปรึกษากฎหมาย — Jurisimus ช่วยจัดระเบียบและเร่งงานกฎหมายของคุณ เราไม่ใช่สำนักงานกฎหมาย และไม่ให้คำปรึกษากฎหมายใด ๆ",
    "AI อาจผิดพลาดได้ — ผลลัพธ์จาก AI รวมถึงการอ้างอิงกฎหมาย อาจไม่ถูกต้อง คุณต้องตรวจสอบทุกอย่างก่อนนำไปใช้หรือส่งให้ลูกความ ดุลยพินิจทางวิชาชีพยังคงเป็นของคุณ",
    "ลูกความของคุณยังคงอยู่ในความดูแลของคุณ — การรักษาความลับและหน้าที่ทางวิชาชีพต่อลูกความยังคงเป็นความรับผิดชอบของสำนักงานคุณ เราดูแลแพลตฟอร์ม คุณเป็นผู้ตัดสินใจว่าจะนำสิ่งใดเข้ามา",
  ],
};

/** Capacity-specific checkbox label (spec § 6.1 item 4). */
export const GATE_CHECKBOX: Record<TermsGateVariant, Record<TermsLocale, string>> = {
  gate_signatory: {
    en: "I agree to the Terms of Service on behalf of my firm and personally as an Authorized User, I confirm I am authorized to bind my firm, and I acknowledge receipt of the Privacy Notice.",
    th: "ข้าพเจ้าตกลงตามข้อกำหนดการให้บริการในนามของสำนักงานและในฐานะผู้ใช้ที่ได้รับอนุญาตเป็นการส่วนตัว ข้าพเจ้ายืนยันว่ามีอำนาจผูกพันสำนักงาน และรับทราบการได้รับหนังสือแจ้งความเป็นส่วนตัว",
  },
  gate_member: {
    en: "I agree to be bound by the Terms of Service as an authorized user of my firm, and I acknowledge receipt of the Privacy Notice.",
    th: "ข้าพเจ้าตกลงผูกพันตามข้อกำหนดการให้บริการในฐานะผู้ใช้ที่ได้รับอนุญาตของสำนักงาน และรับทราบการได้รับหนังสือแจ้งความเป็นส่วนตัว",
  },
};

/** "Agree and continue" (spec § 6.1 item 5). */
export const GATE_BUTTON: Record<TermsLocale, string> = {
  en: "Agree and continue",
  th: "ตกลงและดำเนินการต่อ",
};

/**
 * First-AI-use acknowledgment modal (spec § 6.2). The EN body text is
 * the platform's canonical `ai_ack` component text — including its hard
 * line breaks — because the platform hashes
 * `TERMS_CONTENT_EN.ai_ack + '\nI understand — continue'`. Render the
 * body with normal wrapping (line breaks inside a paragraph collapse
 * visually); the words must stay identical.
 */
export const AI_ACK_MODAL: Record<
  TermsLocale,
  { title: string; body: string; button: string }
> = {
  en: {
    title: "Before your first AI action",
    body: "AI responses can contain mistakes, including citations that look real\nbut are wrong. Verifying output before relying on it is your\nprofessional responsibility. Jurisimus’s checking features assist your\nreview; they never replace it.",
    button: "I understand — continue",
  },
  th: {
    title: "ก่อนการใช้งาน AI ครั้งแรกของคุณ",
    body: "คำตอบจาก AI อาจมีข้อผิดพลาด รวมถึงการอ้างอิงที่ดูสมจริงแต่ไม่ถูกต้อง การตรวจสอบผลลัพธ์ก่อนนำไปใช้เป็นความรับผิดชอบทางวิชาชีพของคุณ ฟีเจอร์ตรวจสอบของ Jurisimus ช่วยการตรวจทานของคุณ แต่ไม่สามารถแทนที่ได้",
    button: "เข้าใจแล้ว — ดำเนินการต่อ",
  },
};

/** Standalone privacy-update acknowledgment prompt (non-blocking). */
export const PRIVACY_UPDATE: Record<TermsLocale, string> = {
  en: "We’ve updated our Privacy Notice — please review. I acknowledge receipt of the updated Privacy Notice.",
  th: "เราได้ปรับปรุงหนังสือแจ้งความเป็นส่วนตัว — โปรดตรวจสอบ ข้าพเจ้ารับทราบการได้รับหนังสือแจ้งความเป็นส่วนตัวฉบับปรับปรุง",
};

/**
 * Persistent AI disclaimer under every AI chat input (spec § 6.3).
 * Not part of the hashed presentations — always-visible chrome.
 */
export const AI_DISCLAIMER: Record<TermsLocale, string> = {
  en: "AI can make mistakes. Verify citations and legal conclusions before relying on them.",
  th: "AI อาจให้ข้อมูลผิดพลาดได้ โปรดตรวจสอบการอ้างอิงและข้อสรุปทางกฎหมายก่อนนำไปใช้",
};

/** Non-hashed gate chrome (hold screen, stale-echo banner, sign out). */
export const GATE_CHROME: Record<
  TermsLocale,
  {
    holdTitle: string;
    holdBody: string;
    staleBanner: string;
    signOut: string;
    readToS: string;
    readPrivacy: string;
    submitting: string;
    loadFailed: string;
    retry: string;
  }
> = {
  en: {
    holdTitle: "Almost there",
    holdBody:
      "Your firm’s owner needs to accept the terms before the workspace opens.",
    staleBanner: "Our terms were just updated — please review again.",
    signOut: "Sign out",
    readToS: "Terms of Service",
    readPrivacy: "Privacy Notice",
    submitting: "Recording your acceptance…",
    loadFailed: "We couldn’t load the terms right now.",
    retry: "Try again",
  },
  th: {
    holdTitle: "อีกนิดเดียว",
    holdBody:
      "เจ้าของสำนักงานของคุณต้องยอมรับข้อกำหนดก่อน พื้นที่ทำงานจึงจะเปิดใช้งานได้",
    staleBanner: "ข้อกำหนดของเราเพิ่งได้รับการปรับปรุง — โปรดตรวจสอบอีกครั้ง",
    signOut: "ออกจากระบบ",
    readToS: "ข้อกำหนดการให้บริการ",
    readPrivacy: "หนังสือแจ้งความเป็นส่วนตัว",
    submitting: "กำลังบันทึกการยอมรับของคุณ…",
    loadFailed: "ไม่สามารถโหลดข้อกำหนดได้ในขณะนี้",
    retry: "ลองอีกครั้ง",
  },
};

export type TermsPresentationVariant =
  | TermsGateVariant
  | "ai_ack_modal"
  | "privacy_update";

/**
 * Reconstruct the platform's exact joined presentation string for a
 * variant/locale — the input to the platform's `presentation_hash`.
 * Used only by the drift test; runtime code renders the pieces.
 */
export function presentationText(
  variant: TermsPresentationVariant,
  locale: TermsLocale,
): string {
  if (variant === "gate_signatory" || variant === "gate_member") {
    return [
      GATE_HEADLINE[locale],
      GATE_CARDS[locale].join("\n"),
      GATE_CHECKBOX[variant][locale],
      GATE_BUTTON[locale],
    ].join("\n");
  }
  if (variant === "ai_ack_modal") {
    const m = AI_ACK_MODAL[locale];
    // Platform: EN = `TERMS_CONTENT_EN.ai_ack + '\nI understand — continue'`
    // where the content is `title\n\nbody`; TH = [title, body, button]
    // joined with single newlines.
    return locale === "en"
      ? `${m.title}\n\n${m.body}\n${m.button}`
      : `${m.title}\n${m.body}\n${m.button}`;
  }
  return PRIVACY_UPDATE[locale];
}
