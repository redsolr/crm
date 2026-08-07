"use client";

/**
 * Record-a-call button (2026-08-07) — the tour's capture loop:
 * press record during (or right after) a firm call, stop, and the
 * audio streams through `/api/transcribe` into a prefilled call-note
 * draft the host view opens for review. The founder always edits and
 * saves the note; nothing is written automatically.
 *
 * States: idle → recording (pulsing dot + mm:ss) → transcribing →
 * back to idle (host opens the draft modal). Mic/permission and
 * transcription failures surface inline and reset to idle.
 *
 * Repeatable action ⇒ neutral outline per the design guidelines; the
 * red is the recording STATUS dot (--crm-red), not a CTA.
 */

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export interface CallDraft {
  transcript: string;
  summary: string;
  outcome: string;
}

interface Props {
  /** Record title fed to the extraction prompt ("Call context: …"). */
  contextTitle: string;
  /** Called with the draft once transcription lands. */
  onDraft: (draft: CallDraft) => void;
  className?: string;
}

type RecorderPhase = "idle" | "recording" | "transcribing";

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RecordCallButton({ contextTitle, onDraft, className }: Props) {
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Unmount mid-recording: stop the mic, drop the take.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
      recorderRef.current?.stream
        .getTracks()
        .forEach((track) => track.stop());
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function start() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("[record-call] microphone unavailable:", err);
      setError("Microphone unavailable — check browser permissions.");
      return;
    }
    streamRef.current = stream;
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      void upload(new Blob(chunks, { type: recorder.mimeType }));
    };
    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1_000);
    setPhase("recording");
  }

  function stop() {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPhase("transcribing");
    recorderRef.current?.stop();
  }

  async function upload(blob: Blob) {
    try {
      const form = new FormData();
      form.append("audio", blob, "call.webm");
      form.append("context", contextTitle);
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        throw new Error(`transcription failed (${response.status})`);
      }
      const draft = (await response.json()) as CallDraft;
      setPhase("idle");
      onDraft(draft);
    } catch (err) {
      console.error("[record-call] upload/transcription failed:", err);
      setError("Transcription failed — the recording was not saved.");
      setPhase("idle");
    }
  }

  return (
    <span className={clsx("record-call inline-flex items-center gap-2", className)}>
      {phase === "recording" ? (
        <button
          type="button"
          onClick={stop}
          data-testid="record-call-stop"
          className="record-call-stop inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px] font-medium border border-[var(--crm-red)] text-[var(--crm-red)] bg-[var(--crm-red-subtle)] transition-colors"
        >
          <span className="record-call-dot h-2 w-2 rounded-sm bg-[var(--crm-red)] animate-pulse" />
          Stop · {formatClock(seconds)}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void start()}
          disabled={phase === "transcribing"}
          data-testid="record-call-button"
          title="Record this call — stop to get a transcribed call-note draft"
          className="record-call-start inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px] font-medium border border-[var(--theme-border-secondary)] text-[var(--theme-text-primary)] hover:border-[var(--theme-border-hover)] transition-colors disabled:opacity-55"
        >
          <span
            className={clsx(
              "record-call-dot h-2 w-2 rounded-full",
              phase === "transcribing"
                ? "bg-[var(--theme-text-muted)] animate-pulse"
                : "bg-[var(--crm-red)]",
            )}
          />
          {phase === "transcribing" ? "Transcribing…" : "Record"}
        </button>
      )}
      {error !== null && (
        <span
          className="record-call-error text-[11px] text-[var(--crm-red)]"
          data-testid="record-call-error"
        >
          {error}
        </span>
      )}
    </span>
  );
}
