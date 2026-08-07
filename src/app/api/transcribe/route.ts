import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/server/api-error";
import { openaiClient } from "@/server/llm";
import { extractCallNote, transcribeAudio } from "@/server/transcribe";
import { requireApiSession } from "@/server/api-auth";

/**
 * `POST /api/transcribe` (multipart: `audio` file + optional `context`
 * string) → `{ transcript, summary, outcome }`.
 *
 * The call-recorder flow: the browser records a tour call, this
 * transcribes it and drafts a call note for the founder to review in
 * CreateCallNoteModal. The audio is NOT stored — it streams to the
 * transcription API and only the text survives (deliberate v1: no
 * blob storage surface, nothing to leak, nothing to back up).
 */

/** OpenAI's audio-upload ceiling is 25MB — reject before uploading. */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Long calls take a while to transcribe — allow up to 5 minutes of
 *  function time on Vercel (default would cut long uploads off). */
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    console.warn(
      "[transcribe] request body was not multipart form data:",
      err instanceof Error ? err.message : err,
    );
    return apiError(400, "invalid_body", "Expected multipart form data");
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return apiError(
      422,
      "validation_failed",
      "An `audio` file field is required",
    );
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return apiError(
      413,
      "payload_too_large",
      "Audio exceeds the 25MB transcription limit",
    );
  }
  const contextRaw = form.get("context");
  const context = typeof contextRaw === "string" ? contextRaw : "";

  try {
    const client = openaiClient();
    const transcript = await transcribeAudio(client, audio);
    const draft = await extractCallNote(client, transcript, context);
    return NextResponse.json({
      transcript,
      summary: draft.summary,
      outcome: draft.outcome,
    });
  } catch (err) {
    // Fail loudly (billing discipline: no degraded fake drafts) — the
    // recorder UI surfaces the error and the founder retries.
    console.error("[transcribe] transcription failed:", err);
    return apiError(
      502,
      "transcription_failed",
      err instanceof Error ? err.message : "Transcription failed",
    );
  }
}
