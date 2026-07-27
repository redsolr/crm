/**
 * Interview engine — claims under test:
 *
 * 1. Branching: picking a choice with `follow_up_ids` inserts the
 *    follow-ups right after the question; DESELECTING removes them
 *    (the queue is a pure function of answers, not splice history).
 * 2. Follow-up-only questions never appear unanswered as roots.
 * 3. Ad-hoc (AI-suggested) questions slot in after their anchor.
 * 4. The transcript records what was learned: answered questions in
 *    queue order, grouped by section, verbatim notes as blockquotes,
 *    skipped questions omitted.
 * 5. Suggestion parsing tolerates real LLM formatting (numbers,
 *    bullets, quotes, preamble) and never returns more than 3.
 * 6. The suggestion prompt stays under the server's 8000-char
 *    `input.question` cap, dropping OLDEST transcript lines first.
 */

import {
  computeQueue,
  isAnswered,
  tallySignals,
  toggleChoice,
  type AnswerMap,
  type InterviewScript,
} from "@/lib/interview/script-schema";
import {
  buildSuggestionPrompt,
  formatTranscriptMarkdown,
  parseSuggestions,
} from "@/lib/interview/transcript";
import { TOUR_DISCOVERY_SCRIPT } from "@/lib/interview/tour-discovery-script";

const SCRIPT: InterviewScript = {
  key: "test-script",
  title: "Test",
  ai_context: {
    positioning: "You assist a test interview for Acme Testing Co.",
    goal: "Find out whether the widget pain is real.",
    never_ask: "Never suggest asking about the weather.",
  },
  default_title_suffix: "test interview",
  questions: [
    {
      id: "q1",
      section: "A",
      prompt: "First?",
      select: "multi",
      choices: [
        { key: "a", label: "Choice A", follow_up_ids: ["fu1"] },
        { key: "b", label: "Choice B" },
      ],
    },
    {
      id: "fu1",
      section: "A",
      follow_up_only: true,
      prompt: "Follow-up?",
      select: "single",
      choices: [
        { key: "x", label: "X", signal: "pain", follow_up_ids: ["fu2"] },
      ],
    },
    {
      id: "fu2",
      section: "A",
      follow_up_only: true,
      prompt: "Nested follow-up?",
      select: "multi",
      choices: [],
    },
    {
      id: "q2",
      section: "B",
      prompt: "Second?",
      select: "single",
      choices: [{ key: "y", label: "Y", signal: "buying_signal" }],
    },
  ],
};

function answer(
  questionId: string,
  choiceKeys: string[],
  note = "",
): AnswerMap {
  return { [questionId]: { question_id: questionId, choice_keys: choiceKeys, note } };
}

describe("computeQueue", () => {
  it("shows only root questions when nothing is answered", () => {
    expect(computeQueue(SCRIPT, {}, [])).toEqual(["q1", "q2"]);
  });

  it("inserts follow-ups right after the triggering question, recursively", () => {
    const answers: AnswerMap = {
      ...answer("q1", ["a"]),
      ...answer("fu1", ["x"]),
    };
    expect(computeQueue(SCRIPT, answers, [])).toEqual([
      "q1",
      "fu1",
      "fu2",
      "q2",
    ]);
  });

  it("drops follow-ups when the triggering choice is deselected", () => {
    const q1 = SCRIPT.questions[0];
    let a = toggleChoice(q1, undefined, "a");
    expect(computeQueue(SCRIPT, { q1: a }, [])).toEqual(["q1", "fu1", "q2"]);
    a = toggleChoice(q1, a, "a"); // deselect (multi toggle)
    expect(computeQueue(SCRIPT, { q1: a }, [])).toEqual(["q1", "q2"]);
  });

  it("slots ad-hoc questions after their anchor, after its follow-ups", () => {
    const answers = answer("q1", ["a"]);
    const queue = computeQueue(SCRIPT, answers, [
      { id: "adhoc-1", prompt: "AI probe?", after_id: "q1", section: "A" },
    ]);
    expect(queue).toEqual(["q1", "fu1", "adhoc-1", "q2"]);
  });
});

describe("toggleChoice", () => {
  it("single select replaces; tapping again clears", () => {
    const q2 = SCRIPT.questions[3];
    let a = toggleChoice(q2, undefined, "y");
    expect(a.choice_keys).toEqual(["y"]);
    a = toggleChoice(q2, a, "y");
    expect(a.choice_keys).toEqual([]);
  });

  it("multi select accumulates and preserves the note", () => {
    const q1 = SCRIPT.questions[0];
    let a = toggleChoice(q1, { question_id: "q1", choice_keys: [], note: "kept" }, "a");
    a = toggleChoice(q1, a, "b");
    expect(a.choice_keys).toEqual(["a", "b"]);
    expect(a.note).toBe("kept");
  });
});

describe("isAnswered / tallySignals", () => {
  it("counts a note-only response as answered", () => {
    expect(isAnswered({ question_id: "x", choice_keys: [], note: "quote" })).toBe(true);
    expect(isAnswered({ question_id: "x", choice_keys: [], note: "  " })).toBe(false);
    expect(isAnswered(undefined)).toBe(false);
  });

  it("tallies signals only for questions in the visible queue", () => {
    const answers: AnswerMap = {
      ...answer("q1", ["a"]),
      ...answer("fu1", ["x"]), // pain
      ...answer("q2", ["y"]), // buying_signal
    };
    const queue = computeQueue(SCRIPT, answers, []);
    expect(tallySignals(SCRIPT, answers, queue)).toEqual([
      { signal: "pain", count: 1 },
      { signal: "buying_signal", count: 1 },
    ]);
  });
});

describe("formatTranscriptMarkdown", () => {
  it("groups by section, renders chips and blockquoted notes, omits skipped", () => {
    const answers: AnswerMap = {
      ...answer("q1", ["a", "b"], "their exact words"),
      ...answer("fu1", ["x"]),
      // q2 skipped
    };
    const queue = computeQueue(SCRIPT, answers, []);
    const md = formatTranscriptMarkdown(SCRIPT, answers, [], queue);
    expect(md).toContain("**Signals:** Pain ×1");
    expect(md).toContain("## A");
    expect(md).toContain("→ Choice A; Choice B");
    expect(md).toContain("> their exact words");
    expect(md).not.toContain("## B");
    expect(md).not.toContain("Second?");
  });

  it("marks ad-hoc questions and renders their notes", () => {
    const adhoc = [
      { id: "adhoc-1", prompt: "AI probe?", after_id: "q1", section: "A" },
    ];
    const answers: AnswerMap = {
      ...answer("q1", ["b"]),
      ...answer("adhoc-1", [], "freeform answer"),
    };
    const queue = computeQueue(SCRIPT, answers, adhoc);
    const md = formatTranscriptMarkdown(SCRIPT, answers, adhoc, queue);
    expect(md).toContain("**AI probe?** _(ad-hoc)_");
    expect(md).toContain("> freeform answer");
  });
});

describe("parseSuggestions", () => {
  it("parses a clean numbered list", () => {
    expect(
      parseSuggestions(
        "1. How do you find old files?\n2. Who owns intake?\n3. What breaks first?",
      ),
    ).toEqual([
      "How do you find old files?",
      "Who owns intake?",
      "What breaks first?",
    ]);
  });

  it("tolerates bullets, quotes, preamble, and caps at 3", () => {
    const text = [
      "Here are some ideas:",
      '- "What happens when the assistant is sick?"',
      "2) How long does retrieval take?",
      "3. Who pays for a missed deadline?",
      "4. A fourth suggestion that should be dropped?",
    ].join("\n");
    const parsed = parseSuggestions(text);
    expect(parsed).toEqual([
      "What happens when the assistant is sick?",
      "How long does retrieval take?",
      "Who pays for a missed deadline?",
    ]);
  });

  it("returns empty for unusable output", () => {
    expect(parseSuggestions("I cannot help with that.")).toEqual([]);
  });
});

describe("buildSuggestionPrompt", () => {
  it("stays under the 8000-char server cap by dropping oldest lines", () => {
    const longNote = "x".repeat(400);
    const answers: AnswerMap = {};
    for (const q of TOUR_DISCOVERY_SCRIPT.questions) {
      answers[q.id] = {
        question_id: q.id,
        choice_keys: q.choices.slice(0, 1).map((c) => c.key),
        note: longNote,
      };
    }
    const queue = computeQueue(TOUR_DISCOVERY_SCRIPT, answers, []);
    const prompt = buildSuggestionPrompt({
      script: TOUR_DISCOVERY_SCRIPT,
      answers,
      adhoc: [],
      queue,
      currentPrompt: "Current question?",
      currentAnswerSummary: "their answer",
    });
    expect(prompt.length).toBeLessThan(8000);
    // Most recent exchange survives truncation.
    expect(prompt).toContain("Current question?");
  });

  it("never suggests asking about willingness to pay", () => {
    const prompt = buildSuggestionPrompt({
      script: TOUR_DISCOVERY_SCRIPT,
      answers: {},
      adhoc: [],
      queue: computeQueue(TOUR_DISCOVERY_SCRIPT, {}, []),
      currentPrompt: "Q?",
      currentAnswerSummary: "",
    });
    expect(prompt).toContain("Never suggest asking about willingness to pay");
  });

  it("derives positioning/goal/never-ask from the SCRIPT's ai_context", () => {
    // The preset owns its goal — a second script (other product, other
    // meeting type) must produce a prompt about ITS business, with no
    // Jurisimus text leaking in from anywhere hardcoded.
    const prompt = buildSuggestionPrompt({
      script: SCRIPT,
      answers: {},
      adhoc: [],
      queue: computeQueue(SCRIPT, {}, []),
      currentPrompt: "Q?",
      currentAnswerSummary: "",
    });
    expect(prompt).toContain("Acme Testing Co");
    expect(prompt).toContain("widget pain");
    expect(prompt).toContain("Never suggest asking about the weather");
    expect(prompt).not.toContain("Jurisimus");
  });
});

describe("tour discovery script integrity", () => {
  it("every follow_up_id points at an existing follow_up_only question", () => {
    const ids = new Set(TOUR_DISCOVERY_SCRIPT.questions.map((q) => q.id));
    for (const q of TOUR_DISCOVERY_SCRIPT.questions) {
      for (const c of q.choices) {
        for (const fu of c.follow_up_ids ?? []) {
          expect(ids.has(fu)).toBe(true);
          const target = TOUR_DISCOVERY_SCRIPT.questions.find(
            (t) => t.id === fu,
          );
          expect(target?.follow_up_only).toBe(true);
        }
      }
    }
  });

  it("question ids and per-question choice keys are unique", () => {
    const ids = TOUR_DISCOVERY_SCRIPT.questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of TOUR_DISCOVERY_SCRIPT.questions) {
      const keys = q.choices.map((c) => c.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("every follow_up_only question is reachable from some choice", () => {
    const reachable = new Set(
      TOUR_DISCOVERY_SCRIPT.questions.flatMap((q) =>
        q.choices.flatMap((c) => c.follow_up_ids ?? []),
      ),
    );
    for (const q of TOUR_DISCOVERY_SCRIPT.questions) {
      if (q.follow_up_only) {
        expect(reachable.has(q.id)).toBe(true);
      }
    }
  });
});
