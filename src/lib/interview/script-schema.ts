/**
 * Live-interview script schema + branching engine.
 *
 * An interview script is a flat list of questions; branching is
 * expressed as `follow_up_ids` on choices. Questions marked
 * `follow_up_only` never appear unless a picked choice pulls them in.
 * The visible question queue is a PURE FUNCTION of (script, answers,
 * ad-hoc questions) — `computeQueue` recomputes it deterministically
 * on every change, so deselecting a choice cleanly drops its
 * follow-ups with no splice bookkeeping to get wrong.
 *
 * Signals mirror the workspace label coding scheme the tour uses on
 * call notes (Pain / Buying Signal / Objection / Feature Gap) so the
 * saved transcript doubles as pre-coded interview data.
 */

export type InterviewSignal =
  | "pain"
  | "buying_signal"
  | "objection"
  | "feature_gap";

export interface InterviewChoice {
  /** Stable key recorded in the transcript. */
  key: string;
  /** Tap-chip text — short enough to scan mid-call. */
  label: string;
  /** Follow-up question ids queued right after this question when picked. */
  follow_up_ids?: string[];
  signal?: InterviewSignal;
}

export interface InterviewQuestion {
  id: string;
  /** Section heading — groups the outline and the saved transcript. */
  section: string;
  /** What you actually say out loud. */
  prompt: string;
  /** What to listen for / why this question exists. */
  hint?: string;
  select: "single" | "multi";
  /** Empty array = open question (note capture only, no chips). */
  choices: InterviewChoice[];
  /** Reachable only via a choice's follow_up_ids — never queued as a root. */
  follow_up_only?: boolean;
}

/**
 * The preset's GOAL, carried BY the script — not hardcoded in app
 * code. Feeds the live AI-suggestion prompt (so on-tap follow-ups
 * know what we sell and what this meeting is for) and the modal's
 * goal line. Sales is repetitive by design: by the time the meeting
 * starts, what we're selling and what we're probing for are known —
 * the preset encodes them once per script.
 */
export interface InterviewAiContext {
  /** Who we are + what we sell, one sentence. */
  positioning: string;
  /** What this meeting is trying to achieve. */
  goal: string;
  /** Hard rule the AI must never violate when suggesting questions. */
  never_ask?: string;
}

export interface InterviewScript {
  key: string;
  title: string;
  ai_context: InterviewAiContext;
  /** Prefill for the quick-create modal's use-case select. */
  default_use_case?: string;
  /** Opportunity-title suffix when the founder types no "about"
   *  (e.g. "discovery interview" → "Acme — discovery interview"). */
  default_title_suffix: string;
  questions: InterviewQuestion[];
}

export interface InterviewAnswer {
  question_id: string;
  choice_keys: string[];
  note: string;
}

/** AI-suggested (or manually added) ad-hoc question, anchored after a
 *  script question in the queue. */
export interface AdhocQuestion {
  id: string;
  prompt: string;
  /** Script question id this was suggested from. */
  after_id: string;
  section: string;
}

export type AnswerMap = Record<string, InterviewAnswer>;

/**
 * Deterministic visible-question queue: root questions in script
 * order; after each question, the follow-ups its picked choices
 * trigger (depth-first, so a follow-up's own follow-ups nest under
 * it), then any ad-hoc questions anchored to it.
 */
export function computeQueue(
  script: InterviewScript,
  answers: AnswerMap,
  adhoc: AdhocQuestion[],
): string[] {
  const byId = new Map(script.questions.map((q) => [q.id, q]));
  const adhocByAnchor = new Map<string, AdhocQuestion[]>();
  for (const a of adhoc) {
    const list = adhocByAnchor.get(a.after_id) ?? [];
    list.push(a);
    adhocByAnchor.set(a.after_id, list);
  }

  const queue: string[] = [];
  const visited = new Set<string>();

  const visit = (id: string): void => {
    if (visited.has(id)) return;
    visited.add(id);
    queue.push(id);
    const question = byId.get(id);
    const answer = answers[id];
    if (question && answer) {
      for (const key of answer.choice_keys) {
        const choice = question.choices.find((c) => c.key === key);
        for (const followUpId of choice?.follow_up_ids ?? []) {
          visit(followUpId);
        }
      }
    }
    for (const a of adhocByAnchor.get(id) ?? []) {
      if (!visited.has(a.id)) {
        visited.add(a.id);
        queue.push(a.id);
      }
    }
  };

  for (const question of script.questions) {
    if (!question.follow_up_only) visit(question.id);
  }
  return queue;
}

/** Toggle a choice on an answer, honoring single vs multi select. */
export function toggleChoice(
  question: InterviewQuestion,
  existing: InterviewAnswer | undefined,
  choiceKey: string,
): InterviewAnswer {
  const current = existing ?? {
    question_id: question.id,
    choice_keys: [],
    note: "",
  };
  const already = current.choice_keys.includes(choiceKey);
  let next: string[];
  if (question.select === "single") {
    next = already ? [] : [choiceKey];
  } else {
    next = already
      ? current.choice_keys.filter((k) => k !== choiceKey)
      : [...current.choice_keys, choiceKey];
  }
  return { ...current, choice_keys: next };
}

/** A question counts as answered when it has a picked choice or a note. */
export function isAnswered(answer: InterviewAnswer | undefined): boolean {
  if (!answer) return false;
  return answer.choice_keys.length > 0 || answer.note.trim().length > 0;
}

export interface SignalTally {
  signal: InterviewSignal;
  count: number;
}

/** Tally coded signals across picked choices, in a stable order. */
export function tallySignals(
  script: InterviewScript,
  answers: AnswerMap,
  queue: string[],
): SignalTally[] {
  const byId = new Map(script.questions.map((q) => [q.id, q]));
  const counts = new Map<InterviewSignal, number>();
  for (const id of queue) {
    const question = byId.get(id);
    const answer = answers[id];
    if (!question || !answer) continue;
    for (const key of answer.choice_keys) {
      const signal = question.choices.find((c) => c.key === key)?.signal;
      if (signal) counts.set(signal, (counts.get(signal) ?? 0) + 1);
    }
  }
  const order: InterviewSignal[] = [
    "pain",
    "buying_signal",
    "objection",
    "feature_gap",
  ];
  return order
    .filter((s) => counts.has(s))
    .map((s) => ({ signal: s, count: counts.get(s) ?? 0 }));
}
