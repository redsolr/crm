/**
 * `notifyTermsGate403` — the client-side fan-out of the platform's
 * terms-gate 403 envelope. The routing decision (full-screen gate vs
 * ai_ack modal) is the claim: an ai_ack-only 403 must NEVER yank the
 * user off their page (spec § 6.2), and everything else must.
 */

import {
  consumePendingTermsGateNavigation,
  notifyTermsGate403,
  parseTermsGate403,
  TERMS_ACCEPTANCE_REQUIRED_EVENT,
  TERMS_AI_ACK_REQUIRED_EVENT,
} from "@/lib/terms/gate-events";

function gateBody(
  actions: Array<{ document_key: string; blocking: boolean }>,
  blockedOnOwner = false,
): unknown {
  return {
    error: {
      type: "permission_error",
      code: "terms_acceptance_required",
      message: "gated",
      doc_url: "https://docs.jurisimus.com/errors/terms_acceptance_required",
      meta: {
        required_actions: actions.map((a) => ({
          capacity: "authorized_user",
          version: "1.0.0-draft",
          ...a,
        })),
        blocked_on_owner: blockedOnOwner,
        urls: { terms: "/legal/terms" },
      },
    },
  };
}

describe("parseTermsGate403", () => {
  it("returns null for non-terms envelopes", () => {
    expect(parseTermsGate403(null)).toBeNull();
    expect(parseTermsGate403({})).toBeNull();
    expect(
      parseTermsGate403({ error: { code: "permission_denied" } }),
    ).toBeNull();
  });

  it("parses the gate envelope, tolerating a missing meta", () => {
    expect(
      parseTermsGate403({ error: { code: "terms_acceptance_required" } }),
    ).toEqual({ required_actions: [], blocked_on_owner: false });
  });
});

describe("notifyTermsGate403 event routing", () => {
  const seen: string[] = [];
  const onGate = () => seen.push("gate");
  const onAiAck = () => seen.push("ai-ack");

  beforeEach(() => {
    seen.length = 0;
    window.addEventListener(TERMS_ACCEPTANCE_REQUIRED_EVENT, onGate);
    window.addEventListener(TERMS_AI_ACK_REQUIRED_EVENT, onAiAck);
  });

  afterEach(() => {
    window.removeEventListener(TERMS_ACCEPTANCE_REQUIRED_EVENT, onGate);
    window.removeEventListener(TERMS_AI_ACK_REQUIRED_EVENT, onAiAck);
    consumePendingTermsGateNavigation(); // drain the latch between tests
  });

  it("dispatches the full gate for a tos-shaped 403", () => {
    notifyTermsGate403(
      gateBody([
        { document_key: "tos", blocking: true },
        { document_key: "privacy_notice", blocking: false },
      ]),
    );
    expect(seen).toEqual(["gate"]);
  });

  it("dispatches the ai_ack modal for an ai_ack-only 403 — never the redirect", () => {
    notifyTermsGate403(gateBody([{ document_key: "ai_ack", blocking: false }]));
    expect(seen).toEqual(["ai-ack"]);
  });

  it("mixed actions (ai_ack + tos) take the full gate", () => {
    notifyTermsGate403(
      gateBody([
        { document_key: "ai_ack", blocking: false },
        { document_key: "tos", blocking: true },
      ]),
    );
    expect(seen).toEqual(["gate"]);
  });

  it("blocked_on_owner with no actions takes the full gate (hold screen)", () => {
    notifyTermsGate403(gateBody([], true));
    expect(seen).toEqual(["gate"]);
  });

  it("does nothing for non-terms 403s", () => {
    expect(
      notifyTermsGate403({ error: { code: "permission_denied" } }),
    ).toBeNull();
    expect(seen).toEqual([]);
  });

  it("latches pending navigation for pre-listener full-gate 403s (one-shot)", () => {
    // A dispatch with no listener mounted yet must survive as the
    // pending latch — TermsGateListener consumes it on mount. The read
    // is one-shot so a later remount can't replay it.
    notifyTermsGate403(gateBody([{ document_key: "tos", blocking: true }]));
    expect(consumePendingTermsGateNavigation()).toBe(true);
    expect(consumePendingTermsGateNavigation()).toBe(false);
  });

  it("ai_ack-only 403s never latch the gate navigation", () => {
    notifyTermsGate403(gateBody([{ document_key: "ai_ack", blocking: false }]));
    expect(consumePendingTermsGateNavigation()).toBe(false);
  });
});
