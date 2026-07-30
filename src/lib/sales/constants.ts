/**
 * Sales-pipeline template constants.
 *
 * Mirrors `platform/src/modules/projects/project-templates.ts`
 * `SALES_PIPELINE_TEMPLATE`. The strings here are wire-stable; do NOT
 * localize.
 */

/** Value of `control.projects.metadata.template_key` for the Sales
 *  Pipeline project — records what bundle seeded the container.
 *  Used by `useProvisionSalesProject` when minting a new container
 *  via `POST /api/projects { template_key }`. NOT the resolution
 *  key — that's `SALES_MODULE_KEY` (more stable across template
 *  renames). */
export const SALES_TEMPLATE_KEY = "sales-pipeline";

/** Value of `control.projects.metadata.module_key` for the Sales
 *  module container. This IS the discriminator the web-app uses to
 *  (1) find the Sales project for the active org, and (2) hide
 *  module-container projects from the user-facing project switcher.
 *  Stable across template renames per the 2026-05-26 architecture
 *  decision. */
export const SALES_MODULE_KEY = "sales";

/** Work-item-type keys shipped by the template. */
export const SALES_TYPE_KEYS = {
  account: "account",
  contact: "contact",
  opportunity: "opportunity",
  call_note: "call_note",
  commitment: "commitment",
} as const;

/** Pipeline workflow state keys (lives on opportunity). */
export const PIPELINE_STATE_KEYS = {
  identified: "identified",
  contacted: "contacted",
  replied: "replied",
  call_booked: "call_booked",
  call_done: "call_done",
  trial: "trial",
  won: "won",
  lost: "lost",
  not_now: "not_now",
} as const;

/** Commitment workflow state keys. */
export const COMMITMENT_STATE_KEYS = {
  open: "open",
  done: "done",
  dropped: "dropped",
} as const;

/** Memory workflow state keys (account / contact / call_note). */
export const MEMORY_STATE_KEYS = {
  active: "active",
  archived: "archived",
} as const;

/** PostHog activation-ladder event names. The five events fire in
 *  order as the user works through their first Sales motion. */
export const ACTIVATION_EVENTS = {
  first_lead_added: "sales_first_lead_added",
  first_opportunity_created: "sales_first_opportunity_created",
  first_call_logged: "sales_first_call_logged",
  first_commitment_created: "sales_first_commitment_created",
  first_commitment_completed: "sales_first_commitment_completed",
} as const;

/** localStorage key that records which ladder rungs the user has
 *  already crossed. Prevents double-fires on re-render. Stored as a
 *  JSON object `{ [event]: timestamp }` so future analytics can join
 *  on activation cohort. */
export const ACTIVATION_STORAGE_KEY = "sales-activation-ladder";

/** Account attributes. */
export const ACCOUNT_SOURCE_OPTIONS = [
  "cold_outreach",
  "intro",
  "inbound",
  "event",
  "referral",
  "partner",
  "other",
] as const;
export type AccountSource = (typeof ACCOUNT_SOURCE_OPTIONS)[number];

/** Law-firm-tour vocabulary (2026-07-07): segment = firm size. */
export const ACCOUNT_SEGMENT_OPTIONS = [
  "solo",
  "firm_2_5",
  "firm_6_10",
  "firm_11_20",
  "firm_20_plus",
  "in_house",
  "other",
] as const;

export const ACCOUNT_PRACTICE_AREA_OPTIONS = [
  "litigation",
  "corporate",
  "real_estate",
  "labor",
  "ip",
  "family",
  "criminal",
  "tax",
  "general_practice",
  "other",
] as const;

/** Opportunity attributes — legal jobs-to-be-done (tour retune). */
export const OPPORTUNITY_USE_CASE_OPTIONS = [
  "matter_chaos",
  "client_comms",
  "drafting",
  "research",
  "knowledge_management",
  "other",
] as const;
export type OpportunityUseCase = (typeof OPPORTUNITY_USE_CASE_OPTIONS)[number];

export const OPPORTUNITY_LOST_REASON_OPTIONS = [
  "too_expensive",
  "wrong_fit",
  "no_decision",
  "competitor",
  "timing",
  "no_response",
  "other",
] as const;

/** Call-note outcomes. */
export const CALL_NOTE_OUTCOME_OPTIONS = [
  "positive",
  "neutral",
  "negative",
  "no_show",
  "rescheduled",
  "other",
] as const;
export type CallNoteOutcome = (typeof CALL_NOTE_OUTCOME_OPTIONS)[number];

/** Call types — tour analytics (paid feedback vs demo vs pilot check-in). */
export const CALL_NOTE_CALL_TYPE_OPTIONS = [
  "in_person_demo",
  "paid_feedback",
  "intro_call",
  "follow_up",
  "pilot_checkin",
  "other",
] as const;
export type CallNoteCallType = (typeof CALL_NOTE_CALL_TYPE_OPTIONS)[number];

/** Contact decision roles. */
export const CONTACT_DECISION_ROLE_OPTIONS = [
  "founder",
  "decision_maker",
  "champion",
  "evaluator",
  "influencer",
  "blocker",
  "user",
  "other",
] as const;

/** Filter pill IDs. */
export type SalesFilterId =
  | "all"
  | "active"
  | "overdue"
  | "due_today"
  | "no_next_action"
  | "closed";

export const SALES_FILTERS: { id: SalesFilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "overdue", label: "Overdue" },
  { id: "due_today", label: "Due today" },
  { id: "no_next_action", label: "No next action" },
  { id: "closed", label: "Closed" },
];

/** Stage rendering order in the pipeline kanban (Phase 2A: list view
 *  grouped by stage; Phase 2B will introduce drag-and-drop). */
export const PIPELINE_STAGE_ORDER: string[] = [
  PIPELINE_STATE_KEYS.identified,
  PIPELINE_STATE_KEYS.contacted,
  PIPELINE_STATE_KEYS.replied,
  PIPELINE_STATE_KEYS.call_booked,
  PIPELINE_STATE_KEYS.call_done,
  PIPELINE_STATE_KEYS.trial,
  PIPELINE_STATE_KEYS.won,
  PIPELINE_STATE_KEYS.lost,
  PIPELINE_STATE_KEYS.not_now,
];
