/**
 * The call-note shape an interview saves as.
 *
 * An interview persists as a plain `call_note` work item under its
 * opportunity (no bespoke table, no new type) — what marks it AS an
 * interview is the title prefix. Writer (InterviewMode's save) and
 * readers (the Interviews tab list) both use these helpers so the
 * marker can't drift.
 */

export const INTERVIEW_NOTE_TITLE_PREFIX = "Interview — ";

export function interviewNoteTitle(opportunityTitle: string): string {
  return `${INTERVIEW_NOTE_TITLE_PREFIX}${opportunityTitle}`;
}

export function isInterviewNote(title: string): boolean {
  return title.startsWith(INTERVIEW_NOTE_TITLE_PREFIX);
}
