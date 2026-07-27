/**
 * The 10-firm validation-tour discovery interview.
 *
 * Encodes the meeting doctrine from
 * `platform/docs/platform/demo-tour-business-context-2026-07-07.md`:
 * first ~10 min on THEIR current workflow before showing anything,
 * ~15 min demo, ~5 min the ask. The real ask is never "would you
 * pay?" — it's "can I set this up for one live matter this week,
 * free?", and every meeting ends with a concrete next step.
 *
 * Choice keys mirror the sales-template attribute vocabulary
 * (`ACCOUNT_SEGMENT_OPTIONS`, `ACCOUNT_PRACTICE_AREA_OPTIONS`) where
 * they overlap, so transcripts stay joinable with account attributes.
 *
 * V1 ships the script in-repo: there is ONE interview (this one), and
 * edits go through code review like any other tour asset. A script
 * builder UI is deliberately deferred until a second script exists.
 */

import type { InterviewScript } from "./script-schema";

const S1 = "Firm profile";
const S2 = "Their current workflow";
const S3 = "Demo reaction";
const S4 = "The ask";

export const TOUR_DISCOVERY_SCRIPT: InterviewScript = {
  key: "tour-discovery-v1",
  title: "Validation-tour discovery interview",
  // The preset's goal — drives the live AI-suggestion prompt and the
  // quick-create prefills. Moved here from a hardcoded string in
  // transcript.ts (2026-07-19) so a second script (pilot check-in,
  // Class-room tutor discovery, …) carries its own positioning.
  ai_context: {
    positioning:
      "You are assisting a live 30-minute discovery interview between the founder of Jurisimus (Matter OS for Thai law firms — clients send chaos, lawyers receive organized legal work) and a Thai law firm.",
    goal: "The goal of the tour is validation: understand the firm's real workflow pain in their own words and land a free pilot on one live matter.",
    never_ask: "Never suggest asking about willingness to pay.",
  },
  // The tour's wedge pain — prefills the quick-create use-case select
  // (still editable there; the interview often reveals the real one).
  default_use_case: "matter_chaos",
  default_title_suffix: "discovery interview",
  questions: [
    // ── S1 · Firm profile (warm-up, ~2 min) ─────────────────────────
    {
      id: "q_firm_size",
      section: S1,
      prompt: "How many lawyers work here day to day?",
      hint: "Warm-up. Also sets which demo firm size to reference.",
      select: "single",
      choices: [
        { key: "solo", label: "Solo" },
        { key: "firm_2_5", label: "2–5" },
        { key: "firm_6_10", label: "6–10" },
        { key: "firm_11_20", label: "11–20" },
        { key: "firm_20_plus", label: "20+" },
        { key: "in_house", label: "In-house team" },
      ],
    },
    {
      id: "q_practice_areas",
      section: S1,
      prompt: "What kind of work is most of your caseload?",
      select: "multi",
      choices: [
        { key: "litigation", label: "Litigation" },
        { key: "corporate", label: "Corporate" },
        { key: "real_estate", label: "Real estate" },
        { key: "labor", label: "Labor" },
        { key: "ip", label: "IP" },
        { key: "family", label: "Family" },
        { key: "criminal", label: "Criminal" },
        { key: "tax", label: "Tax" },
        { key: "general_practice", label: "General practice" },
      ],
    },

    // ── S2 · Their current workflow (the 10-minute block) ───────────
    {
      id: "q_last_matter_intake",
      section: S2,
      prompt:
        "Walk me through the last matter where a client sent you documents — where did they land?",
      hint: "THE opening question. Let them talk; tap everything they mention.",
      select: "multi",
      choices: [
        {
          key: "line_chat",
          label: "LINE chat",
          follow_up_ids: ["fu_line_retrieval"],
        },
        { key: "email", label: "Email" },
        { key: "paper", label: "Paper / in person" },
        { key: "shared_drive", label: "Google Drive / shared drive" },
        {
          key: "mixed_everywhere",
          label: "Mixed — a bit everywhere",
          signal: "pain",
          follow_up_ids: ["fu_intake_owner"],
        },
      ],
    },
    {
      id: "fu_line_retrieval",
      section: S2,
      follow_up_only: true,
      prompt:
        "Three weeks later you need one of those files — how do you find it?",
      hint: "This is the chaos moment. Get the story in their words.",
      select: "single",
      choices: [
        { key: "scroll_chat", label: "Scroll the chat", signal: "pain" },
        {
          key: "re_request_client",
          label: "Ask the client again",
          signal: "pain",
        },
        { key: "saved_manually", label: "Someone saved it to a drive" },
        { key: "assistant_knows", label: "Assistant just knows" },
        {
          key: "cant_reliably",
          label: "Honestly — sometimes we can't",
          signal: "pain",
        },
      ],
    },
    {
      id: "fu_intake_owner",
      section: S2,
      follow_up_only: true,
      prompt: "Who moves client files to where they're supposed to live?",
      select: "single",
      choices: [
        { key: "lawyer_themselves", label: "The lawyer" },
        { key: "assistant", label: "Assistant / secretary" },
        { key: "clerk", label: "Clerk / paralegal" },
        { key: "nobody", label: "Nobody, really", signal: "pain" },
      ],
    },
    {
      id: "q_matter_tracking",
      section: S2,
      prompt:
        "Right now, how do you know the current status of every active matter?",
      select: "single",
      choices: [
        { key: "memory", label: "It's in my head", signal: "pain" },
        { key: "notebook", label: "Notebook / paper file" },
        { key: "spreadsheet", label: "Spreadsheet" },
        {
          key: "case_software",
          label: "Case software",
          follow_up_ids: ["fu_which_software"],
        },
        { key: "ask_staff", label: "I ask my staff" },
      ],
    },
    {
      id: "fu_which_software",
      section: S2,
      follow_up_only: true,
      prompt: "Which software — and what do you still do OUTSIDE it?",
      hint: "The gap between the tool and reality is our wedge.",
      select: "multi",
      choices: [],
    },
    {
      id: "q_deadline_management",
      section: S2,
      prompt: "How do court dates and deadlines get tracked?",
      select: "single",
      choices: [
        { key: "paper_calendar", label: "Paper calendar" },
        { key: "phone_calendar", label: "Phone calendar" },
        { key: "spreadsheet", label: "Spreadsheet" },
        { key: "software", label: "Software" },
        { key: "clerk_owns_it", label: "Clerk owns it" },
        {
          key: "close_call",
          label: "One nearly slipped once…",
          signal: "pain",
          follow_up_ids: ["fu_deadline_story"],
        },
      ],
    },
    {
      id: "fu_deadline_story",
      section: S2,
      follow_up_only: true,
      prompt: "What happened? (Get the story — verbatim.)",
      select: "multi",
      choices: [],
    },
    {
      id: "q_drafting_flow",
      section: S2,
      prompt: "When you draft a contract or a pleading — where do you start?",
      select: "single",
      choices: [
        {
          key: "previous_matter_file",
          label: "A previous matter's file",
          follow_up_ids: ["fu_find_precedent"],
        },
        { key: "blank_word_doc", label: "Blank Word doc" },
        { key: "firm_templates", label: "Firm templates" },
        { key: "junior_drafts", label: "A junior drafts first" },
      ],
    },
    {
      id: "fu_find_precedent",
      section: S2,
      follow_up_only: true,
      prompt: "How do you find that previous matter's file?",
      select: "single",
      choices: [
        { key: "remember_where", label: "I remember where it is" },
        { key: "search_drive", label: "Search the drive" },
        { key: "ask_colleague", label: "Ask a colleague", signal: "pain" },
        {
          key: "redo_from_scratch",
          label: "Faster to redo it",
          signal: "pain",
        },
      ],
    },
    {
      id: "q_delete_one_thing",
      section: S2,
      prompt:
        "If you could delete one part of your working week, which one goes?",
      hint: "Their #1 pain, ranked by them — anchors the demo.",
      select: "single",
      choices: [
        {
          key: "chasing_clients_for_docs",
          label: "Chasing clients for documents",
          signal: "pain",
        },
        { key: "finding_old_files", label: "Finding old files", signal: "pain" },
        {
          key: "status_update_calls",
          label: "“What's the status?” calls",
          signal: "pain",
        },
        {
          key: "repetitive_drafting",
          label: "Repetitive drafting",
          signal: "pain",
        },
        { key: "deadline_anxiety", label: "Deadline anxiety", signal: "pain" },
        { key: "billing_admin", label: "Billing / admin", signal: "pain" },
      ],
    },

    // ── S3 · Demo reaction (fill during / right after the demo) ─────
    {
      id: "q_demo_resonated",
      section: S3,
      prompt: "What got a visible reaction during the demo?",
      select: "multi",
      choices: [
        {
          key: "client_intake_organizing",
          label: "Client chaos → organized intake",
          signal: "buying_signal",
        },
        {
          key: "matter_timeline",
          label: "Matter timeline / status",
          signal: "buying_signal",
        },
        { key: "ai_drafting", label: "AI drafting", signal: "buying_signal" },
        { key: "cite_check", label: "Cite-check", signal: "buying_signal" },
        {
          key: "client_comms",
          label: "Client comms (LINE)",
          signal: "buying_signal",
        },
        {
          key: "search_across_matters",
          label: "Search across matters",
          signal: "buying_signal",
        },
        {
          key: "nothing_strongly",
          label: "Nothing, strongly",
          signal: "objection",
        },
      ],
    },
    {
      id: "q_demo_objections",
      section: S3,
      prompt: "What did they push back on?",
      select: "multi",
      choices: [
        {
          key: "ai_trust",
          label: "Trust in AI output",
          signal: "objection",
          follow_up_ids: ["fu_ai_trust"],
        },
        {
          key: "data_security_pdpa",
          label: "Data security / PDPA",
          signal: "objection",
          follow_up_ids: ["fu_pdpa"],
        },
        { key: "price_sensitivity", label: "Price", signal: "objection" },
        {
          key: "learning_curve_staff",
          label: "Staff learning curve",
          signal: "objection",
        },
        {
          key: "no_time_to_migrate",
          label: "No time to migrate",
          signal: "objection",
        },
        {
          key: "bar_ethics",
          label: "Bar / ethics concerns",
          signal: "objection",
        },
      ],
    },
    {
      id: "fu_ai_trust",
      section: S3,
      follow_up_only: true,
      prompt: "What specifically about AI worries them?",
      select: "multi",
      choices: [
        { key: "wrong_citations", label: "Wrong citations" },
        { key: "client_confidentiality", label: "Client confidentiality" },
        { key: "looks_lazy", label: "Looks lazy to clients" },
        { key: "thai_quality", label: "Thai-language quality" },
      ],
    },
    {
      id: "fu_pdpa",
      section: S3,
      follow_up_only: true,
      prompt: "What would satisfy the security concern?",
      select: "multi",
      choices: [
        { key: "data_in_thailand", label: "Data stored in Thailand" },
        { key: "dpa_document", label: "A DPA to sign" },
        { key: "reference_firm", label: "A reference firm using it" },
        { key: "on_premise_ask", label: "They want on-premise", signal: "feature_gap" },
      ],
    },
    {
      id: "q_feature_asks",
      section: S3,
      prompt:
        "What did they ask for that we don't have? (Their words, verbatim.)",
      hint: "Feature gaps in THEIR words — this is YC-application material.",
      select: "multi",
      choices: [],
    },

    // ── S4 · The ask (~5 min, conversion ladder) ────────────────────
    {
      id: "q_pilot_ask",
      section: S4,
      prompt:
        "THE ASK: “Can I set this up for one live matter this week — free?”",
      hint: "Never ask “would you pay?”. A firm that comes back next week outweighs ten enthusiastic maybes.",
      select: "single",
      choices: [
        {
          key: "yes_specific_matter",
          label: "Yes — named a matter",
          signal: "buying_signal",
          follow_up_ids: ["fu_pilot_matter"],
        },
        {
          key: "yes_hesitant",
          label: "Yes, but hesitant",
          follow_up_ids: ["fu_hesitation"],
        },
        {
          key: "needs_partner_approval",
          label: "Needs partner approval",
          follow_up_ids: ["fu_decision_maker"],
        },
        { key: "no", label: "No", follow_up_ids: ["fu_no_reason"] },
      ],
    },
    {
      id: "fu_pilot_matter",
      section: S4,
      follow_up_only: true,
      prompt: "Which matter? Type, who's on it, when can we set it up?",
      select: "multi",
      choices: [],
    },
    {
      id: "fu_hesitation",
      section: S4,
      follow_up_only: true,
      prompt: "What's the hesitation?",
      select: "single",
      choices: [
        { key: "time", label: "No time this week" },
        { key: "trust", label: "Trust — too new", signal: "objection" },
        { key: "staff", label: "Staff won't adopt", signal: "objection" },
        { key: "unclear_value", label: "Value unclear", signal: "objection" },
      ],
    },
    {
      id: "fu_decision_maker",
      section: S4,
      follow_up_only: true,
      prompt: "Who decides — and what would convince them?",
      select: "multi",
      choices: [],
    },
    {
      id: "fu_no_reason",
      section: S4,
      follow_up_only: true,
      prompt: "What's the real blocker?",
      select: "single",
      choices: [
        { key: "no_pain", label: "No real pain", signal: "objection" },
        { key: "wrong_time", label: "Wrong timing" },
        { key: "price", label: "Price", signal: "objection" },
        { key: "trust", label: "Trust", signal: "objection" },
        { key: "status_quo", label: "Happy with status quo", signal: "objection" },
      ],
    },
    {
      id: "q_next_step",
      section: S4,
      prompt: "Concrete next step agreed before leaving:",
      hint: "Every meeting ends with one. “None” is OUR process failure — log it honestly.",
      select: "single",
      choices: [
        {
          key: "pilot_setup_scheduled",
          label: "Pilot setup scheduled",
          signal: "buying_signal",
        },
        { key: "follow_up_call_booked", label: "Follow-up call booked" },
        { key: "send_materials", label: "Send materials" },
        { key: "intro_to_partner", label: "Intro to deciding partner" },
        { key: "none", label: "None agreed", signal: "pain" },
      ],
    },
    {
      id: "q_verbatim_quotes",
      section: S4,
      prompt: "Best verbatim quotes from this meeting (their words, not yours):",
      hint: "One page per meeting; ten pages ≈ the YC “what have you learned from users” section.",
      select: "multi",
      choices: [],
    },
  ],
};
