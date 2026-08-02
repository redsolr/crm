/**
 * Unit tests for the Ask panel's pure conversation state machine.
 *
 * The claims under test mirror what the AskPanel promises the user:
 *   - sending shows the question immediately and opens a streaming bubble;
 *   - streamed tokens accumulate into that bubble in order;
 *   - stray chunks after completion/reset can never corrupt the list;
 *   - aborting/erroring before any token leaves no hollow bubble behind.
 */

import {
  askReducer,
  buildAskWireText,
  initialAskState,
  toAskTranscript,
  type AskConversationState,
} from "../ask-messages";

describe("toAskTranscript", () => {
  it("maps persisted turns to transcript bubbles in order", () => {
    expect(
      toAskTranscript([
        { role: "user", content: "What should I ask Thonglor?" },
        { role: "assistant", content: "Ask who owns the budget." },
      ]),
    ).toEqual([
      { role: "user", content: "What should I ask Thonglor?" },
      { role: "assistant", content: "Ask who owns the budget." },
    ]);
  });

  it("drops system rows and empty/null content", () => {
    expect(
      toAskTranscript([
        { role: "system", content: "grounding preamble" },
        { role: "user", content: "" },
        { role: "assistant", content: null },
        { role: "user", content: "kept" },
      ]),
    ).toEqual([{ role: "user", content: "kept" }]);
  });
});

describe("askReducer", () => {
  it("send appends the user message plus an empty assistant placeholder and starts streaming", () => {
    const next = askReducer(initialAskState, {
      type: "send",
      text: "Which deals need attention this week?",
    });

    expect(next.messages).toEqual([
      { role: "user", content: "Which deals need attention this week?" },
      { role: "assistant", content: "" },
    ]);
    expect(next.status).toBe("streaming");
    expect(next.error).toBeNull();
  });

  it("send clears a prior error", () => {
    const errored: AskConversationState = {
      messages: [{ role: "user", content: "earlier" }],
      status: "idle",
      error: "boom",
    };
    const next = askReducer(errored, { type: "send", text: "retry" });
    expect(next.error).toBeNull();
    expect(next.status).toBe("streaming");
  });

  it("chunks accumulate into the assistant placeholder in order", () => {
    let state = askReducer(initialAskState, { type: "send", text: "hi" });
    state = askReducer(state, { type: "chunk", text: "Acme needs " });
    state = askReducer(state, { type: "chunk", text: "a follow-up." });

    expect(state.messages).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "Acme needs a follow-up." },
    ]);
    expect(state.status).toBe("streaming");
  });

  it("complete keeps the streamed content and returns to idle", () => {
    let state = askReducer(initialAskState, { type: "send", text: "hi" });
    state = askReducer(state, { type: "chunk", text: "Answer." });
    state = askReducer(state, { type: "complete" });

    expect(state.messages).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "Answer." },
    ]);
    expect(state.status).toBe("idle");
  });

  it("complete drops a still-empty assistant placeholder (abort before first token)", () => {
    let state = askReducer(initialAskState, { type: "send", text: "hi" });
    state = askReducer(state, { type: "complete" });

    expect(state.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(state.status).toBe("idle");
  });

  it("a chunk arriving while idle is ignored", () => {
    let state = askReducer(initialAskState, { type: "send", text: "hi" });
    state = askReducer(state, { type: "complete" });
    const after = askReducer(state, { type: "chunk", text: "late token" });

    expect(after).toEqual(state);
  });

  it("a late complete while idle is a no-op", () => {
    let state = askReducer(initialAskState, { type: "send", text: "hi" });
    state = askReducer(state, { type: "chunk", text: "Answer." });
    state = askReducer(state, { type: "complete" });
    const after = askReducer(state, { type: "complete" });

    expect(after).toEqual(state);
  });

  it("error removes the empty placeholder, surfaces the message, and returns to idle", () => {
    let state = askReducer(initialAskState, { type: "send", text: "hi" });
    state = askReducer(state, { type: "error", message: "Stream error" });

    expect(state.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(state.status).toBe("idle");
    expect(state.error).toBe("Stream error");
  });

  it("error keeps partial streamed content when tokens already arrived", () => {
    let state = askReducer(initialAskState, { type: "send", text: "hi" });
    state = askReducer(state, { type: "chunk", text: "Partial " });
    state = askReducer(state, { type: "error", message: "connection lost" });

    expect(state.messages).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "Partial " },
    ]);
    expect(state.error).toBe("connection lost");
  });

  it("reset returns to the initial state", () => {
    let state = askReducer(initialAskState, { type: "send", text: "hi" });
    state = askReducer(state, { type: "chunk", text: "Answer." });
    state = askReducer(state, { type: "reset" });

    expect(state).toEqual(initialAskState);
  });

  it("tool_steps accumulate on the streaming assistant bubble in order", () => {
    let state = askReducer(initialAskState, { type: "send", text: "log it" });
    state = askReducer(state, {
      type: "tool_step",
      summary: 'Created account "Bangkok Legal" (id wi_1).',
    });
    state = askReducer(state, {
      type: "tool_step",
      summary: 'Created opportunity "Bangkok Legal — matter_chaos" (id wi_2).',
    });
    state = askReducer(state, { type: "chunk", text: "Done — deal logged." });
    state = askReducer(state, { type: "complete" });

    expect(state.messages).toEqual([
      { role: "user", content: "log it" },
      {
        role: "assistant",
        content: "Done — deal logged.",
        steps: [
          'Created account "Bangkok Legal" (id wi_1).',
          'Created opportunity "Bangkok Legal — matter_chaos" (id wi_2).',
        ],
      },
    ]);
    expect(state.status).toBe("idle");
  });

  it("complete keeps a text-less bubble that carries tool steps (abort after acting)", () => {
    let state = askReducer(initialAskState, { type: "send", text: "log it" });
    state = askReducer(state, {
      type: "tool_step",
      summary: "Moved the deal to trial.",
    });
    state = askReducer(state, { type: "complete" });

    expect(state.messages).toEqual([
      { role: "user", content: "log it" },
      { role: "assistant", content: "", steps: ["Moved the deal to trial."] },
    ]);
  });

  it("a tool_step arriving while idle is ignored", () => {
    let state = askReducer(initialAskState, { type: "send", text: "hi" });
    state = askReducer(state, { type: "complete" });
    const after = askReducer(state, {
      type: "tool_step",
      summary: "late step",
    });

    expect(after).toEqual(state);
  });
});

describe("buildAskWireText", () => {
  it("prepends a delimited [Viewing: …] preamble when a page context is present", () => {
    expect(
      buildAskWireText(
        "Company record: Baker & Partners (SALES-1)",
        "What do we know about them?",
      ),
    ).toBe(
      "[Viewing: Company record: Baker & Partners (SALES-1)]\n\n" +
        "What do we know about them?",
    );
  });

  it("sends the text untouched when the context is null (full-page /sales/ask)", () => {
    expect(buildAskWireText(null, "Which deals need attention?")).toBe(
      "Which deals need attention?",
    );
  });

  it("sends the text untouched when the context is empty", () => {
    expect(buildAskWireText("", "hello")).toBe("hello");
  });

  it("never leaks the preamble into the display path — the reducer stores only the user's text", () => {
    // The wire text and the transcript are composed independently: the
    // `send` event carries the DISPLAY text, buildAskWireText shapes the
    // WIRE text. Folding a send never embeds the preamble.
    const state = askReducer(initialAskState, {
      type: "send",
      text: "What do we know about them?",
    });
    expect(state.messages[0]).toEqual({
      role: "user",
      content: "What do we know about them?",
    });
  });
});
