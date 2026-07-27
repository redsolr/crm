/**
 * Interview script registry.
 *
 * One script exists today (the 10-firm-tour discovery interview); the
 * registry is the seam the Interviews tab's template picker reads so a
 * second script (pilot check-in, churn debrief, …) is an array entry,
 * not a UI change. Scripts stay in-repo typed config — edits go
 * through code review, and a script BUILDER stays deferred until a
 * second script actually exists (deferred-decisions).
 */

import type { InterviewScript } from "./script-schema";
import { TOUR_DISCOVERY_SCRIPT } from "./tour-discovery-script";

export const INTERVIEW_SCRIPTS: readonly InterviewScript[] = [
  TOUR_DISCOVERY_SCRIPT,
];

export function findInterviewScript(key: string): InterviewScript | undefined {
  return INTERVIEW_SCRIPTS.find((s) => s.key === key);
}
