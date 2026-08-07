import type OpenAI from "openai";
import {
  buildExtractionInput,
  extractCallNote,
  parseCallNoteDraft,
  transcribeAudio,
} from "@/server/transcribe";

/**
 * The call-recording pipeline's CLAIMS (client injected, no network):
 *  - audio goes to the transcription API and the text comes back;
 *  - the extraction reply parses into {summary, outcome} with the
 *    outcome validated against the call-note vocabulary;
 *  - a malformed model reply NEVER loses content — it degrades to
 *    raw-text-as-summary (the founder reviews the draft either way).
 */

function fakeClient(overrides: {
  transcriptText?: string;
  chatReply?: string;
}): OpenAI {
  return {
    audio: {
      transcriptions: {
        create: jest
          .fn()
          .mockResolvedValue({ text: overrides.transcriptText ?? "" }),
      },
    },
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: overrides.chatReply ?? "" } }],
        }),
      },
    },
  } as unknown as OpenAI;
}

describe("transcribeAudio", () => {
  it("returns the transcription text for the uploaded file", async () => {
    const client = fakeClient({ transcriptText: "we drown in matter chaos" });
    const file = new File(["fake-bytes"], "call.webm", {
      type: "audio/webm",
    });
    await expect(transcribeAudio(client, file)).resolves.toBe(
      "we drown in matter chaos",
    );
  });
});

describe("parseCallNoteDraft", () => {
  it("parses a clean JSON reply and keeps a valid outcome", () => {
    const draft = parseCallNoteDraft(
      JSON.stringify({ summary: "**What they said** — pain.", outcome: "positive" }),
    );
    expect(draft).toEqual({
      summary: "**What they said** — pain.",
      outcome: "positive",
    });
  });

  it("parses JSON wrapped in prose/code fences", () => {
    const draft = parseCallNoteDraft(
      'Here you go:\n```json\n{"summary":"S","outcome":"neutral"}\n```',
    );
    expect(draft).toEqual({ summary: "S", outcome: "neutral" });
  });

  it("rejects an outcome outside the call-note vocabulary", () => {
    const draft = parseCallNoteDraft(
      JSON.stringify({ summary: "S", outcome: "amazing!!" }),
    );
    expect(draft.outcome).toBe("");
  });

  it("degrades a non-JSON reply to raw-text-as-summary (content never lost)", () => {
    const draft = parseCallNoteDraft("They liked the demo, follow up Friday.");
    expect(draft).toEqual({
      summary: "They liked the demo, follow up Friday.",
      outcome: "",
    });
  });
});

describe("extractCallNote", () => {
  it("sends the transcript with its context header and returns the parsed draft", async () => {
    const client = fakeClient({
      chatReply: JSON.stringify({ summary: "S", outcome: "positive" }),
    });
    const draft = await extractCallNote(
      client,
      "long transcript",
      "Erawan — tour visit",
    );
    expect(draft).toEqual({ summary: "S", outcome: "positive" });
    const call = (
      client.chat.completions.create as unknown as jest.Mock
    ).mock.calls[0][0] as {
      messages: { role: string; content: string }[];
    };
    expect(call.messages[1].content).toBe(
      buildExtractionInput("long transcript", "Erawan — tour visit"),
    );
    expect(call.messages[1].content).toContain(
      "Call context: Erawan — tour visit",
    );
  });
});
