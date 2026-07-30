/**
 * Interview transcript rendering + AI follow-up prompt plumbing.
 *
 * Two renderings of the same session state:
 *  - `formatTranscriptMarkdown` — the call-note description (grouped
 *    by section, signal tally up top, verbatim notes as blockquotes).
 *  - `buildSuggestionPrompt` — the compact transcript wrapped in
 *    instructions for `POST /api/responses { ask: "text" }`. The ask's
 *    `input.question` is capped at 8000 chars server-side, so the
 *    transcript is truncated oldest-first to stay under budget.
 */

import type {
  AdhocQuestion,
  AnswerMap,
  InterviewQuestion,
  InterviewScript,
} from "./script-schema";
import { isAnswered, tallySignals } from "./script-schema";
import type { InterviewSignal } from "./script-schema";

const SIGNAL_LABELS: Record<InterviewSignal, string> = {
  pain: "Pain",
  buying_signal: "Buying signal",
  objection: "Objection",
  feature_gap: "Feature gap",
};

interface ResolvedEntry {
  question: Pick<InterviewQuestion, "id" | "section" | "prompt" | "choices">;
  choiceLabels: string[];
  note: string;
  adhoc: boolean;
}

/** Resolve queue ids → answered entries in queue order. Skipped
 *  questions are omitted — the transcript records what was learned,
 *  not the script. */
export function resolveEntries(
  script: InterviewScript,
  answers: AnswerMap,
  adhoc: AdhocQuestion[],
  queue: string[],
): ResolvedEntry[] {
  const scriptById = new Map(script.questions.map((q) => [q.id, q]));
  const adhocById = new Map(adhoc.map((a) => [a.id, a]));
  const entries: ResolvedEntry[] = [];
  for (const id of queue) {
    const answer = answers[id];
    if (!isAnswered(answer)) continue;
    const scriptQuestion = scriptById.get(id);
    if (scriptQuestion) {
      entries.push({
        question: scriptQuestion,
        choiceLabels: answer.choice_keys.map(
          (key) =>
            scriptQuestion.choices.find((c) => c.key === key)?.label ?? key,
        ),
        note: answer.note.trim(),
        adhoc: false,
      });
      continue;
    }
    const adhocQuestion = adhocById.get(id);
    if (adhocQuestion) {
      entries.push({
        question: {
          id: adhocQuestion.id,
          section: adhocQuestion.section,
          prompt: adhocQuestion.prompt,
          choices: [],
        },
        choiceLabels: [],
        note: answer.note.trim(),
        adhoc: true,
      });
    }
  }
  return entries;
}

/** Call-note description body. */
export function formatTranscriptMarkdown(
  script: InterviewScript,
  answers: AnswerMap,
  adhoc: AdhocQuestion[],
  queue: string[],
): string {
  const entries = resolveEntries(script, answers, adhoc, queue);
  const lines: string[] = [];

  const signals = tallySignals(script, answers, queue);
  if (signals.length > 0) {
    lines.push(
      `**Signals:** ${signals
        .map((s) => `${SIGNAL_LABELS[s.signal]} ×${s.count}`)
        .join(" · ")}`,
      "",
    );
  }

  let section = "";
  for (const entry of entries) {
    if (entry.question.section !== section) {
      section = entry.question.section;
      lines.push(`## ${section}`, "");
    }
    const marker = entry.adhoc ? " _(ad-hoc)_" : "";
    lines.push(`**${entry.question.prompt}**${marker}`);
    if (entry.choiceLabels.length > 0) {
      lines.push(`→ ${entry.choiceLabels.join("; ")}`);
    }
    if (entry.note) {
      for (const noteLine of entry.note.split("\n")) {
        lines.push(`> ${noteLine}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

/** Compact `Q:/A:` transcript for the AI prompt. */
function formatCompactTranscript(entries: ResolvedEntry[]): string[] {
  return entries.map((entry) => {
    const parts = [`Q: ${entry.question.prompt}`];
    if (entry.choiceLabels.length > 0) {
      parts.push(`A: ${entry.choiceLabels.join("; ")}`);
    }
    if (entry.note) {
      parts.push(`Note: ${entry.note.replace(/\n/g, " ")}`);
    }
    return parts.join(" | ");
  });
}

/** Server-side cap on `input.question` is 8000 chars; leave headroom
 *  for the instruction block. */
const TRANSCRIPT_CHAR_BUDGET = 6500;

export interface SuggestionContext {
  script: InterviewScript;
  answers: AnswerMap;
  adhoc: AdhocQuestion[];
  queue: string[];
  /** The question currently on screen. */
  currentPrompt: string;
  /** What was just tapped / typed for it, if anything. */
  currentAnswerSummary: string;
}

/**
 * Build the `ask: "text"` question for live follow-up suggestions.
 * Transcript lines are dropped OLDEST-first when over budget — the
 * most recent exchanges carry the branch worth probing.
 */
export function buildSuggestionPrompt(context: SuggestionContext): string {
  const entries = resolveEntries(
    context.script,
    context.answers,
    context.adhoc,
    context.queue,
  );
  let transcriptLines = formatCompactTranscript(entries);
  let transcript = transcriptLines.join("\n");
  while (
    transcript.length > TRANSCRIPT_CHAR_BUDGET &&
    transcriptLines.length > 1
  ) {
    transcriptLines = transcriptLines.slice(1);
    transcript = transcriptLines.join("\n");
  }

  // The positioning/goal/never-ask block comes from the SCRIPT's
  // ai_context (the preset owns its goal) — not hardcoded here, so
  // every script's live assists know what that meeting is selling.
  const ai = context.script.ai_context;
  return [
    [ai.positioning, ai.goal, ai.never_ask].filter(Boolean).join(" "),
    "",
    "Interview transcript so far (tapped answers + verbatim notes):",
    transcript || "(nothing captured yet)",
    "",
    `Current question: ${context.currentPrompt}`,
    context.currentAnswerSummary
      ? `Their response so far: ${context.currentAnswerSummary}`
      : "",
    "",
    "Suggest exactly 3 short follow-up questions the interviewer should ask NEXT, given what this person has revealed. Each must be a single conversational question they would answer naturally, digging into the most promising pain or buying signal above. Reply with ONLY a numbered list (1. 2. 3.) — no preamble, no explanations.",
  ].join("\n");
}

/** Parse the model's numbered list into at most 3 suggestions.
 *  Lenient: accepts `1.` / `1)` / `-` markers, strips wrapping quotes. */
export function parseSuggestions(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^(?:\d+[.)]\s*|[-*]\s+)/, "").trim())
    .map((line) => line.replace(/^["“](.*)["”]$/, "$1").trim())
    .filter((line) => line.length > 4 && line.includes("?"))
    .slice(0, 3);
}
