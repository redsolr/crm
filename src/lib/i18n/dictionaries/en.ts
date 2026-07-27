import type { Dictionary } from "../dictionary";

/**
 * English marketing copy — the reference dictionary. Tone: quiet luxury,
 * counsel-grade. Claims must stay honest to shipped capabilities; if a
 * feature changes, this file changes in the same PR.
 */
export const en = {
  meta: {
    title: "Jurisimus — Command of Every Matter",
    description:
      "An AI workspace built to the standard of legal work. Research grounded in your own documents, matters managed with precision, and notes that work offline.",
  },
  nav: {
    plans: "Plans",
    roadmap: "Roadmap",
    about: "About",
    docs: "Docs",
    signIn: "Sign in",
    getStarted: "Request a demo",
    languageLabel: "Language",
  },
  hero: {
    eyebrow: "An AI workspace built to the standard of legal work",
    titleLine1: "Command of",
    titleLine2: "every matter.",
    subtitle:
      "Research grounded in your own documents. Matters, deadlines, and drafts in one quiet workspace — prepared when you are, even offline.",
    cta: "Request a demo",
    secondaryCta: "View plans",
    note: "In-person or video call — your firm can be live the same day.",
  },
  credibility: {
    items: [
      {
        title: "Grounded answers",
        text: "AI that reads your matter — documents, notes, context — before it responds.",
      },
      {
        title: "Fully offline",
        text: "Notes, documents, and tasks keep working in the courtroom or in the air.",
      },
      {
        title: "Isolated by design",
        text: "Every organization's data is segregated and access-controlled.",
      },
      {
        title: "Web & iOS",
        text: "The same workspace at your desk and in your pocket.",
      },
    ],
  },
  features: {
    eyebrow: "The practice",
    title: "Four disciplines. One workspace.",
    subtitle:
      "Research, matters, documents, and institutional memory — designed as one.",
    items: [
      {
        title: "Research, grounded",
        text: "Converse with Claude and GPT models that read your workspace first — documents, notes, and matter context — so answers draw on what you actually have. Branch lines of inquiry, or go incognito when discretion demands it.",
      },
      {
        title: "Matters, in order",
        text: "Assignments, deadlines, and workstreams across seven views — board, backlog, timeline, calendar, and more. Nest sub-tasks, set priorities, and see at a glance what needs your attention.",
      },
      {
        title: "Documents & notes, anywhere",
        text: "Hierarchical folders and clean drafting pages that work without a connection. Edits queue and sync when you're back — nothing is lost between the office and the courtroom.",
      },
      {
        title: "Memory that compounds",
        text: "Save the findings that matter from any conversation. A knowledge graph connects people, entities, and issues across matters — so the firm's memory outlives any single engagement.",
      },
    ],
  },
  industries: {
    eyebrow: "Who it serves",
    title: "Built for counsel. At home in any serious practice.",
    items: [
      {
        title: "Legal",
        text: "Manage matters, track assignments, and research with AI that respects your context. Works offline at court, in chambers, and at client sites.",
      },
      {
        title: "Consulting",
        text: "Engagements and deliverables in one place. Draft proposals, analyze documents, and structure recommendations.",
      },
      {
        title: "Finance",
        text: "Deals and workstreams, organized. Centralize research and keep teams aligned across time zones.",
      },
      {
        title: "Any serious work",
        text: "If your work is thinking, writing, and judgment — Jurisimus adapts its vocabulary, views, and AI to match.",
      },
    ],
  },
  pricing: {
    eyebrow: "Engagement",
    title: "Pricing",
    subtitle:
      "One plan, every module included. Clients and viewers are always free.",
    perLawyerMonth: "per lawyer / month",
    annualNote: "/year — 2 months free · minimum 1 seat",
    detailsLink: "See full pricing details",
    getStarted: "Request a demo",
    loadError: "Unable to load pricing. Please try again later.",
  },
  faq: {
    eyebrow: "Questions",
    title: "Asked, answered.",
    items: [
      {
        question: "How does offline mode work?",
        answer:
          "Every action is applied instantly to a local database. If you're offline, changes queue and replay automatically when connectivity returns. Works for folders, notes, tasks, sprints, epics, and tags.",
      },
      {
        question: "Which AI models are available?",
        answer:
          "We support Anthropic (Claude) and OpenAI through a pluggable provider system. Every seat gets every model — usage draws from your firm's pooled monthly AI allowance, with prepaid credit packs for extra usage.",
      },
      {
        question: "Where does my data live?",
        answer:
          "Your data lives in PostgreSQL on AWS with encryption at rest. On mobile, a local copy is cached for offline access. Authentication is handled by WorkOS. Each organization's data is fully isolated.",
      },
      {
        question: "What does incognito mode do?",
        answer:
          "Incognito chats are excluded from history, memory, and AI personalization. Messages are stored server-side for safety compliance but never surface in any user-facing feature.",
      },
    ],
  },
  closing: {
    title: "Begin with your next matter.",
    subtitle: "See it on your own cases — we set your firm up on the spot.",
    cta: "Request a demo",
  },
  demoRequest: {
    title: "Request a demo",
    subtitle:
      "Tell us a little about your practice. We'll reach out to arrange an in-person or video demo — and set your firm up live during the session.",
    nameLabel: "Your name",
    firmLabel: "Firm name",
    emailLabel: "Email",
    emailHint: "Any email works — Gmail is fine.",
    firmSizeLabel: "Firm size",
    firmSizeOptions: {
      solo: "Solo",
      small: "2–10 lawyers",
      medium: "11–50 lawyers",
      large: "50+ lawyers",
    },
    needLabel: "What do you want to see?",
    needPlaceholder:
      "e.g. client intake from LINE, drafting with cite-check, matter tracking…",
    submit: "Request a demo",
    submitting: "Sending…",
    successTitle: "Request received.",
    successBody:
      "We'll be in touch shortly to arrange your demo. If it's urgent, email us directly.",
    errorGeneric: "Something went wrong — please try again.",
    rateLimited: "Too many requests from this network today — please email us instead.",
    signInInstead: "Already on Jurisimus? Sign in",
    privacyNotice:
      "We use these details only to arrange your demo and respond to your request.",
    privacyNoticeLinkLabel: "Privacy Notice",
  },
  footer: {
    tagline: "An AI workspace built to the standard of legal work.",
    productHeading: "Product",
    companyHeading: "Company",
    legalHeading: "Legal",
    links: {
      plans: "Plans",
      roadmap: "Roadmap",
      changelog: "Changelog",
      status: "Status",
      about: "About",
      support: "Support",
      help: "Help",
      privacy: "Privacy",
      terms: "Terms",
    },
    rights: "All rights reserved.",
  },
} satisfies Dictionary;
