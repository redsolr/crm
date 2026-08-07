"use client";

/**
 * Live interview mode — full-screen tap-through overlay for the
 * 10-firm validation tour.
 *
 * Design goal: during a live 30-minute call the interviewer taps, and
 * only types when capturing verbatim quotes. Branching is scripted
 * (choices pull in follow-up questions); the AI rail suggests up to 3
 * extra follow-ups from the running transcript on an explicit tap
 * (paid LLM call — never auto-fired). Finishing saves the whole
 * session as a structured call note under the opportunity, so the
 * tour's capture discipline (one page per meeting, verbatim quotes,
 * signal coding) is the default output, not extra homework.
 *
 * Session state persists to localStorage on every change — an
 * accidental tab close mid-meeting resumes exactly where it stopped.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SALES_TYPE_KEYS } from "@/lib/sales/constants";
import { useCreateCallNote } from "@/lib/sales/use-sales-mutations";
import { SelectMenu } from "@/components/ui/select";
import {
  OUTCOME_SELECT_OPTIONS,
  CALL_TYPE_SELECT_OPTIONS,
} from "../select-options";
import { BRAND_CTA_CLASS } from "../form";
import { fireActivation } from "@/lib/sales/activation";
import type { WorkItem } from "@/lib/workItemsApi";
import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import {
  computeQueue,
  isAnswered,
  tallySignals,
  toggleChoice,
  type AdhocQuestion,
  type AnswerMap,
  type InterviewQuestion,
  type InterviewScript,
  type InterviewSignal,
} from "@/lib/interview/script-schema";
import { TOUR_DISCOVERY_SCRIPT } from "@/lib/interview/tour-discovery-script";
import { interviewNoteTitle } from "@/lib/interview/interview-note";
import { formatTranscriptMarkdown } from "@/lib/interview/transcript";
import {
  clearInterviewDraft,
  loadInterviewDraft,
  saveInterviewDraft,
} from "@/lib/interview/draft";
import { useInterviewSuggestions } from "@/queries/responses/use-interview-suggestions";

const SIGNAL_LABELS: Record<InterviewSignal, string> = {
  pain: "Pain",
  buying_signal: "Buying signal",
  objection: "Objection",
  feature_gap: "Feature gap",
};

/** The shell's content column — same portal target as AskPanel and
 *  the peek panel, so the sidebar stays interactive alongside. */
const MAIN_AREA_SELECTOR = ".crm-main";

interface Props {
  bundle: SalesWorkspaceBundle;
  opportunity: WorkItem;
  /** Which script to run — defaults to the tour discovery interview
   *  (the registry in `@/lib/interview/scripts` lists the options). */
  script?: InterviewScript;
  onClose: () => void;
  onSaved?: (callNote: WorkItem) => void;
}

export function InterviewMode({
  bundle,
  opportunity,
  script = TOUR_DISCOVERY_SCRIPT,
  onClose,
  onSaved,
}: Props) {

  // ── Session state (draft-restored) ────────────────────────────────
  const [draft] = useState(() =>
    loadInterviewDraft(opportunity.id, script.key),
  );
  const [answers, setAnswers] = useState<AnswerMap>(draft?.answers ?? {});
  const [adhoc, setAdhoc] = useState<AdhocQuestion[]>(draft?.adhoc ?? []);
  const [cursor, setCursor] = useState(draft?.cursor ?? 0);
  const [startedAt] = useState(() => draft?.started_at ?? Date.now());
  const [phase, setPhase] = useState<"interview" | "review">("interview");
  const resumed = draft !== null;

  const queue = useMemo(
    () => computeQueue(script, answers, adhoc),
    [script, answers, adhoc],
  );
  const safeCursor = Math.min(cursor, queue.length - 1);

  const scriptById = useMemo(
    () => new Map(script.questions.map((q) => [q.id, q])),
    [script],
  );
  const adhocById = useMemo(
    () => new Map(adhoc.map((a) => [a.id, a])),
    [adhoc],
  );

  const currentId = queue[safeCursor];
  const currentScriptQuestion = scriptById.get(currentId);
  const currentAdhoc = adhocById.get(currentId);
  const currentSection =
    currentScriptQuestion?.section ?? currentAdhoc?.section ?? "";
  const currentAnswer = answers[currentId];
  const answeredCount = queue.filter((id) => isAnswered(answers[id])).length;

  // ── Draft persistence ─────────────────────────────────────────────
  const hasProgress =
    Object.keys(answers).length > 0 || adhoc.length > 0 || safeCursor > 0;
  useEffect(() => {
    if (!hasProgress) return;
    saveInterviewDraft(opportunity.id, {
      script_key: script.key,
      answers,
      adhoc,
      cursor: safeCursor,
      started_at: startedAt,
    });
  }, [
    opportunity.id,
    script.key,
    answers,
    adhoc,
    safeCursor,
    startedAt,
    hasProgress,
  ]);

  // ── Elapsed timer (30-min meeting budget) ─────────────────────────
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const elapsedSeconds = Math.max(0, Math.floor((nowTick - startedAt) / 1000));
  const elapsed = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  // ── Escape closes (draft is already saved) ────────────────────────
  // `defaultPrevented` skips Escapes another surface already consumed
  // (the ⌘K palette prevents default when closing itself) — with the
  // sidebar now live alongside the interview, those can coexist.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // ── AI suggestions ────────────────────────────────────────────────
  const suggest = useInterviewSuggestions();
  const suggestReset = suggest.reset;
  useEffect(() => {
    // Suggestions are moment-specific; moving to another question
    // clears them so a stale probe never anchors to the wrong spot.
    suggestReset();
  }, [safeCursor, suggestReset]);

  function requestSuggestions() {
    const summaryParts: string[] = [];
    if (currentScriptQuestion && currentAnswer) {
      summaryParts.push(
        ...currentAnswer.choice_keys.map(
          (key) =>
            currentScriptQuestion.choices.find((c) => c.key === key)?.label ??
            key,
        ),
      );
    }
    if (currentAnswer?.note.trim()) summaryParts.push(currentAnswer.note.trim());
    suggest.mutate({
      script,
      answers,
      adhoc,
      queue,
      currentPrompt: currentScriptQuestion?.prompt ?? currentAdhoc?.prompt ?? "",
      currentAnswerSummary: summaryParts.join("; "),
    });
  }

  function askSuggestion(prompt: string) {
    // Anchor to the current script question; if the current question
    // is itself ad-hoc, chain after the same anchor.
    const anchorId = currentScriptQuestion
      ? currentId
      : currentAdhoc?.after_id ?? currentId;
    const next: AdhocQuestion = {
      id: `adhoc-${adhoc.length + 1}`,
      prompt,
      after_id: anchorId,
      section: currentSection || "Ad-hoc",
    };
    const nextAdhoc = [...adhoc, next];
    setAdhoc(nextAdhoc);
    const nextQueue = computeQueue(script, answers, nextAdhoc);
    setCursor(Math.max(0, nextQueue.indexOf(next.id)));
  }

  // ── Answer handlers ───────────────────────────────────────────────
  function tapChoice(question: InterviewQuestion, choiceKey: string) {
    setAnswers((prev) => ({
      ...prev,
      [question.id]: toggleChoice(question, prev[question.id], choiceKey),
    }));
  }

  function setNote(questionId: string, note: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        question_id: questionId,
        choice_keys: prev[questionId]?.choice_keys ?? [],
        note,
      },
    }));
  }

  function goNext() {
    if (safeCursor >= queue.length - 1) {
      setPhase("review");
    } else {
      setCursor(safeCursor + 1);
    }
  }

  function goBack() {
    if (phase === "review") {
      setPhase("interview");
      return;
    }
    setCursor(Math.max(0, safeCursor - 1));
  }

  function jumpToSection(section: string) {
    const index = queue.findIndex(
      (id) =>
        (scriptById.get(id)?.section ?? adhocById.get(id)?.section) === section,
    );
    if (index >= 0) {
      setPhase("interview");
      setCursor(index);
    }
  }

  // ── Save as call note ─────────────────────────────────────────────
  const createCallNote = useCreateCallNote();
  const pilotChoice = answers.q_pilot_ask?.choice_keys[0];
  const defaultOutcome =
    pilotChoice === "yes_specific_matter"
      ? "positive"
      : pilotChoice === "no"
        ? "negative"
        : pilotChoice
          ? "neutral"
          : "";
  const [outcome, setOutcome] = useState<string>("");
  const [callType, setCallType] = useState<string>("in_person_demo");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const transcript = useMemo(
    () => formatTranscriptMarkdown(script, answers, adhoc, queue),
    [script, answers, adhoc, queue],
  );
  const signals = useMemo(
    () => tallySignals(script, answers, queue),
    [script, answers, queue],
  );

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const callNoteType = bundle.workItemTypes.find(
      (t) => t.key === SALES_TYPE_KEYS.call_note,
    );
    const defs = callNoteType
      ? bundle.attributeDefinitionsByType[callNoteType.id] ?? []
      : [];
    const effectiveOutcome = outcome || defaultOutcome;
    const summaryLine = [
      `Interview: ${answeredCount}/${queue.length} answered`,
      ...signals.map((s) => `${SIGNAL_LABELS[s.signal]} ×${s.count}`),
    ].join(" · ");
    try {
      const callNote = await createCallNote.mutateAsync({
        title: interviewNoteTitle(opportunity.title),
        workspace_id: bundle.workspace.id,
        parent_id: opportunity.id,
        description: transcript || undefined,
        definitions: defs,
        attributes: {
          call_date: new Date().toISOString().slice(0, 10),
          outcome: effectiveOutcome || undefined,
          call_type: callType || undefined,
          summary: summaryLine,
        },
      });
      fireActivation("first_call_logged", {
        call_note_id: callNote.id,
        outcome: effectiveOutcome || "unspecified",
      });
      clearInterviewDraft(opportunity.id);
      onSaved?.(callNote);
      onClose();
    } catch (error) {
      console.error("[InterviewMode] save failed:", error);
      setSaveError("Could not save the interview. It stays drafted locally.");
    } finally {
      setSaving(false);
    }
  }

  // ── Sections for the outline rail ─────────────────────────────────
  const sections = useMemo(() => {
    const seen: { name: string; total: number; answered: number }[] = [];
    for (const id of queue) {
      const name =
        scriptById.get(id)?.section ?? adhocById.get(id)?.section ?? "";
      let entry = seen.find((s) => s.name === name);
      if (!entry) {
        entry = { name, total: 0, answered: 0 };
        seen.push(entry);
      }
      entry.total += 1;
      if (isAnswered(answers[id])) entry.answered += 1;
    }
    return seen;
  }, [queue, answers, scriptById, adhocById]);

  // Portal into the content column (`.crm-main`, AskPanel/peek-panel
  // parity) so the sidebar stays visible and usable during a live
  // call — the interview covers the VIEW, not the app. Unlike
  // AskPanel (always-mounted, must re-query on open) this component
  // mounts when the interview launches, so the shell is committed and
  // a lazy initializer resolves the target once. Falls back to a
  // full-screen fixed overlay outside the shell.
  const [portalTarget] = useState<HTMLElement>(
    () =>
      document.querySelector<HTMLElement>(MAIN_AREA_SELECTOR) ?? document.body,
  );
  const inMain = portalTarget !== document.body;

  const overlay = (
    <div
      className={`interview-mode ${inMain ? "absolute inset-0 z-40" : "fixed inset-0 z-[100]"} flex flex-col bg-[var(--theme-bg-primary)]`}
      data-testid="interview-mode"
    >
      {/* ── Header ── */}
      <header className="interview-header flex items-center gap-3 px-5 py-3 border-b border-[var(--theme-border-secondary)]">
        <span className="text-[13px] font-semibold text-[var(--theme-text-primary)] truncate">
          Interview — {opportunity.title}
        </span>
        {resumed && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-muted)]">
            Resumed draft
          </span>
        )}
        <span className="flex-1" />
        <span
          className="interview-timer text-[13px] tabular-nums text-[var(--theme-text-secondary)]"
          data-testid="interview-timer"
          title="Elapsed — meeting budget is 30 min"
        >
          {elapsed}
        </span>
        <span className="text-[13px] text-[var(--theme-text-muted)] tabular-nums">
          {answeredCount}/{queue.length}
        </span>
        <button
          onClick={onClose}
          className="text-[13px] px-3 py-1.5 rounded-md border border-[var(--theme-border-secondary)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] transition-colors"
          data-testid="interview-exit-button"
          title="Draft is saved locally — resume anytime"
        >
          Save &amp; exit
        </button>
      </header>

      {phase === "interview" ? (
        <div className="interview-body flex flex-1 min-h-0">
          {/* ── Question panel ── */}
          <main className="interview-question-panel flex-1 min-w-0 overflow-y-auto px-6 py-8 flex flex-col">
            <div className="max-w-2xl w-full mx-auto flex-1 flex flex-col">
              {/* Equal spacers above/below center the question block
                  vertically (Typeform-style — the eye stays in one
                  place across all 13 taps); the nav row stays pinned
                  to the bottom. Spacers collapse first on overflow. */}
              <div className="flex-1" />
              <p className="text-[11px] uppercase tracking-wider text-[var(--theme-text-muted)] mb-2">
                {currentSection}
                {currentAdhoc && " · AI follow-up"}
              </p>
              <h2
                className="interview-prompt text-xl font-semibold text-[var(--theme-text-primary)] leading-snug"
                data-testid="interview-prompt"
              >
                {currentScriptQuestion?.prompt ?? currentAdhoc?.prompt}
              </h2>
              {currentScriptQuestion?.hint && (
                <p className="text-[13px] text-[var(--theme-text-muted)] mt-2">
                  {currentScriptQuestion.hint}
                </p>
              )}

              {currentScriptQuestion &&
                currentScriptQuestion.choices.length > 0 && (
                  <div className="interview-choices flex flex-wrap gap-2 mt-6">
                    {currentScriptQuestion.choices.map((choice) => {
                      const selected =
                        currentAnswer?.choice_keys.includes(choice.key) ??
                        false;
                      return (
                        <button
                          key={choice.key}
                          onClick={() =>
                            tapChoice(currentScriptQuestion, choice.key)
                          }
                          data-testid={`interview-choice-${choice.key}`}
                          aria-pressed={selected}
                          className={`interview-choice-chip px-4 py-2.5 rounded-xl text-sm border ${
                            selected
                              ? `${BRAND_CTA_CLASS} border-transparent`
                              : "transition-colors bg-[var(--theme-bg-hover)] border-[var(--theme-border-hover)] text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-active)] hover:border-[var(--theme-text-muted)]"
                          }`}
                        >
                          {choice.label}
                        </button>
                      );
                    })}
                  </div>
                )}

              {/* Verbatim note — the only typing in the whole flow */}
              <div className="interview-note mt-6">
                {currentScriptQuestion &&
                currentScriptQuestion.choices.length > 0 ? (
                  <input
                    type="text"
                    value={currentAnswer?.note ?? ""}
                    onChange={(e) => setNote(currentId, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") goNext();
                    }}
                    placeholder="Their words, verbatim (optional) — Enter to continue"
                    data-testid="interview-note-input"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--theme-bg-tertiary)] border border-[var(--theme-border-hover)] text-sm text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-text-muted)]"
                  />
                ) : (
                  <textarea
                    value={currentAnswer?.note ?? ""}
                    onChange={(e) => setNote(currentId, e.target.value)}
                    rows={4}
                    placeholder="Capture their answer — verbatim beats summary"
                    data-testid="interview-note-input"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--theme-bg-tertiary)] border border-[var(--theme-border-hover)] text-sm text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-text-muted)]"
                  />
                )}
              </div>

              <div className="flex-1" />

              {/* ── Navigation ── */}
              <div className="interview-nav flex items-center gap-2 mt-8">
                <button
                  onClick={goBack}
                  disabled={safeCursor === 0}
                  data-testid="interview-back-button"
                  className="w-28 py-2.5 rounded-lg text-sm text-center border border-[var(--theme-border-hover)] text-[var(--theme-text-primary)] disabled:opacity-40 hover:bg-[var(--theme-bg-hover)] transition-colors"
                >
                  ← Back
                </button>
                <span className="flex-1" />
                {/* Skip and Next are SEPARATE, ALWAYS-PRESENT actions
                    (2026-07-19): a morphing single button meant one
                    spot performed two semantically different taps, and
                    a conditionally-rendered Skip read as layout
                    flicker. Both render every question in fixed spots;
                    Next (brand gradient) advances WITH data and is
                    disabled until answered — capture discipline,
                    advancing empty is the conscious ghost-button tap. */}
                {/* All three nav buttons share one width (w-28) so the
                    row reads as a unit and nothing shifts; "Finish →"
                    on the Next side already signals the last question,
                    so Skip keeps one short label throughout. */}
                <button
                  onClick={goNext}
                  data-testid="interview-skip-button"
                  className="interview-skip-button w-28 py-2.5 rounded-lg text-sm text-center border border-[var(--theme-border-hover)] text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-hover)] hover:border-[var(--theme-text-muted)] transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={goNext}
                  disabled={!isAnswered(currentAnswer)}
                  data-testid="interview-next-button"
                  className={`interview-next-button w-28 py-2.5 rounded-lg text-sm font-medium text-center ${BRAND_CTA_CLASS} disabled:opacity-55 disabled:cursor-not-allowed`}
                >
                  {safeCursor >= queue.length - 1 ? "Finish →" : "Next →"}
                </button>
              </div>
            </div>
          </main>

          {/* ── Right rail: outline + AI ── */}
          <aside className="interview-rail w-72 shrink-0 border-l border-[var(--theme-border-secondary)] overflow-y-auto px-4 py-5 hidden md:flex md:flex-col gap-6">
            <nav className="interview-outline space-y-1">
              {sections.map((section) => (
                <button
                  key={section.name}
                  onClick={() => jumpToSection(section.name)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors ${
                    section.name === currentSection
                      ? "bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-primary)]"
                      : "text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)]"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate">{section.name}</span>
                    <span className="text-[11px] tabular-nums text-[var(--theme-text-muted)]">
                      {section.answered}/{section.total}
                    </span>
                  </span>
                </button>
              ))}
            </nav>

            <div className="interview-ai-panel space-y-3">
              <button
                onClick={requestSuggestions}
                disabled={suggest.isPending}
                data-testid="interview-suggest-button"
                className="w-full px-3 py-2 rounded-lg text-[13px] border border-[var(--theme-border-hover)] text-[var(--theme-accent)] hover:bg-[var(--theme-bg-tertiary)] transition-colors disabled:opacity-50"
              >
                {suggest.isPending ? "Thinking…" : "✦ Suggest follow-ups"}
              </button>
              {suggest.isError && (
                <p className="text-[12px] text-red-400">
                  Suggestions unavailable — keep going, the script has you
                  covered.
                </p>
              )}
              {suggest.data?.map((suggestion, index) => (
                <div
                  key={`${safeCursor}-${index}`}
                  data-testid="interview-suggestion-item"
                  className="interview-suggestion rounded-lg border border-[var(--theme-border-secondary)] p-3 space-y-2"
                >
                  <p className="text-[13px] text-[var(--theme-text-primary)] leading-snug">
                    {suggestion}
                  </p>
                  <button
                    onClick={() => askSuggestion(suggestion)}
                    data-testid="interview-suggestion-ask"
                    className="text-[12px] px-2.5 py-1 rounded-md bg-[var(--theme-bg-tertiary)] border border-[var(--theme-border-secondary)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] transition-colors"
                  >
                    + Ask this
                  </button>
                </div>
              ))}
              {suggest.data && suggest.data.length === 0 && (
                <p className="text-[12px] text-[var(--theme-text-muted)]">
                  No usable suggestions came back — try again after the next
                  answer.
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : (
        /* ── Review & save ── */
        <div
          className="interview-review flex-1 min-h-0 overflow-y-auto px-6 py-8"
          data-testid="interview-review"
        >
          <div className="max-w-2xl mx-auto space-y-5">
            <h2 className="text-xl font-semibold text-[var(--theme-text-primary)]">
              Review &amp; save
            </h2>
            <p className="text-[13px] text-[var(--theme-text-secondary)]">
              {answeredCount} of {queue.length} questions answered
              {signals.length > 0 && (
                <>
                  {" · "}
                  {signals
                    .map((s) => `${SIGNAL_LABELS[s.signal]} ×${s.count}`)
                    .join(" · ")}
                </>
              )}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium text-[var(--theme-text-secondary)] uppercase tracking-wider mb-1.5">
                  Outcome
                </span>
                <SelectMenu
                  value={outcome || defaultOutcome}
                  onChange={setOutcome}
                  options={OUTCOME_SELECT_OPTIONS}
                  placeholder="—"
                  emptyOptionLabel="—"
                  testId="interview-outcome-select"
                  ariaLabel="Outcome"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--theme-bg-tertiary)] border border-[var(--theme-border-hover)] text-sm text-[var(--theme-text-primary)] focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-[var(--theme-text-secondary)] uppercase tracking-wider mb-1.5">
                  Call type
                </span>
                <SelectMenu
                  value={callType}
                  onChange={setCallType}
                  options={CALL_TYPE_SELECT_OPTIONS}
                  testId="interview-call-type-select"
                  ariaLabel="Call type"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--theme-bg-tertiary)] border border-[var(--theme-border-hover)] text-sm text-[var(--theme-text-primary)] focus:outline-none"
                />
              </label>
            </div>

            <div className="interview-transcript-preview rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)] p-4 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--theme-text-primary)] font-sans">
                {transcript || "Nothing captured yet."}
              </pre>
            </div>

            {saveError && <p className="text-sm text-red-400">{saveError}</p>}

            <div className="flex items-center gap-2">
              <button
                onClick={goBack}
                className="px-4 py-2.5 rounded-lg text-sm border border-[var(--theme-border-secondary)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] transition-colors"
              >
                ← Back to interview
              </button>
              <span className="flex-1" />
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                data-testid="interview-save-button"
                className={`px-6 py-2.5 rounded-lg text-sm font-medium ${BRAND_CTA_CLASS} disabled:opacity-50`}
              >
                {saving ? "Saving…" : "Save call note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(overlay, portalTarget);
}
