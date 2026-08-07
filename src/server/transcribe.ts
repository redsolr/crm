import type OpenAI from "openai";
import {
  CALL_NOTE_OUTCOME_OPTIONS,
  type CallNoteOutcome,
} from "@/lib/sales/constants";
import { ASK_MODEL, TRANSCRIBE_MODEL } from "./llm";

/**
 * Call-recording pipeline (2026-08-07): audio → transcript →
 * call-note draft. The founder records a tour call in the browser;
 * this turns it into the same signal-coded note shape the interview
 * mode and the agent door write, prefilled for review — the founder
 * edits and saves, the model never writes a record directly.
 *
 * DB-free by design (mirrors ask-tools' testability seam): the OpenAI
 * client is injected, so jest exercises the contract without the route
 * or a network.
 */

export interface CallNoteDraft {
  /** Markdown summary ready for the call-note summary field. */
  summary: string;
  /** One of CALL_NOTE_OUTCOME_OPTIONS, or "" when the model can't tell. */
  outcome: CallNoteOutcome | "";
}

export async function transcribeAudio(
  client: OpenAI,
  file: File,
): Promise<string> {
  const result = await client.audio.transcriptions.create({
    file,
    model: TRANSCRIBE_MODEL,
  });
  return result.text;
}

const EXTRACTION_SYSTEM = [
  "You turn a raw sales-call transcript from a legal-tech founder's",
  "validation tour into a call-note draft. Reply with ONLY a JSON",
  'object: {"summary": string, "outcome": string}.',
  "",
  "summary: markdown with these sections, each only when the call",
  "actually covered it —",
  "  **What they said** — their workflow pain in THEIR words (quote).",
  "  **Signals** — buying signals, objections, pricing reactions.",
  "  **Commitments** — anything either side promised, with owners.",
  "  **Next step** — the concrete follow-up, if one was agreed.",
  "Keep it under 250 words. Never invent facts not in the transcript.",
  "",
  `outcome: one of ${CALL_NOTE_OUTCOME_OPTIONS.join(", ")} — or ""`,
  "if the transcript doesn't make it clear.",
].join("\n");

export function buildExtractionInput(
  transcript: string,
  context: string,
): string {
  const header = context === "" ? "" : `Call context: ${context}\n\n`;
  return `${header}Transcript:\n${transcript}`;
}

const VALID_OUTCOMES = new Set<string>(CALL_NOTE_OUTCOME_OPTIONS);

/** Tolerant parse of the model reply. A malformed reply degrades to
 *  "the whole reply is the summary" — the founder reviews the draft
 *  either way, so a parse hiccup must never lose the content. */
export function parseCallNoteDraft(raw: string): CallNoteDraft {
  const jsonSlice = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  if (jsonSlice.length >= 2) {
    try {
      const parsed: unknown = JSON.parse(jsonSlice);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "summary" in parsed &&
        typeof (parsed as { summary: unknown }).summary === "string"
      ) {
        const outcomeRaw = (parsed as { outcome?: unknown }).outcome;
        const outcome =
          typeof outcomeRaw === "string" && VALID_OUTCOMES.has(outcomeRaw)
            ? (outcomeRaw as CallNoteOutcome)
            : "";
        return { summary: (parsed as { summary: string }).summary, outcome };
      }
    } catch (err) {
      console.warn(
        "[transcribe] draft reply was not valid JSON — using raw text:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  return { summary: raw.trim(), outcome: "" };
}

export async function extractCallNote(
  client: OpenAI,
  transcript: string,
  context: string,
): Promise<CallNoteDraft> {
  const completion = await client.chat.completions.create({
    model: ASK_MODEL,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM },
      { role: "user", content: buildExtractionInput(transcript, context) },
    ],
  });
  return parseCallNoteDraft(completion.choices[0]?.message?.content ?? "");
}
